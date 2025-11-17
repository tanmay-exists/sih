# backend/ml/websocket3.py
# (Now includes EEG, ML Verdicts, and 2-Way Gaze)

import serial
import serial.tools.list_ports
import time
import csv
import subprocess
import os
import threading
from datetime import datetime
import asyncio
import websockets
import json
from collections import deque

# --- Eye-Tracking Imports ---
import cv2
import mediapipe as mp
import numpy as np
import base64

# --- MediaPipe Global Initialization ---
# We initialize this once to be thread-safe
mp_face_mesh = mp.solutions.face_mesh

# --- Configuration Parameters ---
COM_PORT = '/dev/ttyACM0'  
BAUD_RATE = 115200
SAMPLE_RATE = 256
DURATION_MIN = 4

# WebSocket Configuration - THREE SEPARATE PORTS
WEBSOCKET_HOST = 'localhost'
EEG_PORT = 8765       # Port for EEG signal values
VERDICT_PORT = 8766   # Port for ML model verdicts
GAZE_PORT = 8767      # --- NEW: 2-Way Port for Gaze data ---

EEG_SEND_RATE = 10    # Send EEG samples every 10 samples (25.6 Hz effective rate)

# Calculate the total number of samples to record per file
MAX_SAMPLES_PER_FILE = SAMPLE_RATE * DURATION_MIN * 60

# Define the two filenames for alternating writes
FILENAME_1 = 'eeg_recording_file_1.csv'
FILENAME_2 = 'eeg_recording_file_2.csv'

# Model testing script
MODEL_TEST_SCRIPT = 'predict4.py'

# Results log file
RESULTS_LOG = 'classification_results_log.txt'

# --- Global WebSocket state ---
eeg_clients = set()
verdict_clients = set()
gaze_clients = set()  # --- NEW ---

eeg_loop = None
verdict_loop = None
gaze_loop = None      # --- NEW ---

latest_verdict = {
    'state': 'UNKNOWN',
    'confidence': 'N/A',
    'beta_activity': 'N/A',
    'timestamp': None,
    'session': 0
}
latest_gaze = "STARTING" # --- NEW ---

# -------------------------------------------------------------------
# WebSocket Server Functions for EEG Signal (Port 8765)
# -------------------------------------------------------------------
async def handle_eeg_client(websocket):
    """Handle WebSocket client connection for EEG signals"""
    global eeg_clients
    eeg_clients.add(websocket)
    client_address = websocket.remote_address
    print(f"\n🌐 [EEG] Client connected: {client_address}")
    log_result(f"EEG client connected: {client_address}")
    
    try:
        # Send initial state
        await websocket.send(json.dumps({
            'type': 'connection',
            'status': 'connected',
            'message': 'Connected to EEG Signal Stream',
            'port_type': 'eeg_signal'
        }))
        
        # Keep connection alive and handle incoming messages
        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
            except:
                pass
                
    except websockets.exceptions.ConnectionClosed:
        print(f"\n🌐 [EEG] Client disconnected: {client_address}")
        log_result(f"EEG client disconnected: {client_address}")
    finally:
        eeg_clients.discard(websocket)

async def broadcast_eeg_sample(sample_data):
    """Broadcast EEG sample to all connected EEG clients"""
    if eeg_clients:
        message = json.dumps({
            'type': 'eeg_sample',
            'timestamp': datetime.now().isoformat(),
            'value': sample_data
        })
        
        # Create a list of clients to iterate over, to avoid issues if set changes
        disconnected = set()
        for client in eeg_clients:
            try:
                await client.send(message)
            except:
                disconnected.add(client)
        
        # Remove disconnected clients
        for client in disconnected:
            eeg_clients.discard(client)

def start_eeg_websocket_server(loop):
    """Start WebSocket server for EEG signals in the event loop"""
    global eeg_loop
    eeg_loop = loop
    asyncio.set_event_loop(loop)
    
    async def start_server_async():
        server = await websockets.serve(
            handle_eeg_client, 
            WEBSOCKET_HOST, 
            EEG_PORT,
            ping_interval=20,
            ping_timeout=10
        )
        print(f"✓ EEG WebSocket server started on ws://{WEBSOCKET_HOST}:{EEG_PORT}")
        log_result(f"EEG WebSocket server started on ws://{WEBSOCKET_HOST}:{EEG_PORT}")
        return server
    
    loop.run_until_complete(start_server_async())
    loop.run_forever()

# -------------------------------------------------------------------
# WebSocket Server Functions for Verdict (Port 8766)
# -------------------------------------------------------------------
async def handle_verdict_client(websocket):
    """Handle WebSocket client connection for ML verdicts"""
    global verdict_clients
    verdict_clients.add(websocket)
    client_address = websocket.remote_address
    print(f"\n🌐 [VERDICT] Client connected: {client_address}")
    log_result(f"Verdict client connected: {client_address}")
    
    try:
        # Send initial state
        await websocket.send(json.dumps({
            'type': 'connection',
            'status': 'connected',
            'message': 'Connected to ML Verdict Stream',
            'verdict_interval': f'{DURATION_MIN} minutes',
            'port_type': 'verdict'
        }))
        
        # Send latest verdict if available
        if latest_verdict['timestamp']:
            await websocket.send(json.dumps({
                'type': 'verdict',
                'timestamp': datetime.now().isoformat(),
                'focus_state': latest_verdict['state'],
                'confidence': latest_verdict['confidence'],
                'beta_activity': latest_verdict['beta_activity'],
                'session': latest_verdict['session'],
                'analysis_timestamp': latest_verdict['timestamp']
            }))
        
        # Keep connection alive and handle incoming messages
        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
            except:
                pass
                
    except websockets.exceptions.ConnectionClosed:
        print(f"\n🌐 [VERDICT] Client disconnected: {client_address}")
        log_result(f"Verdict client disconnected: {client_address}")
    finally:
        verdict_clients.discard(websocket)

async def broadcast_verdict(verdict_data):
    """Broadcast focus verdict to all connected verdict clients"""
    if verdict_clients:
        message = json.dumps({
            'type': 'verdict',
            'timestamp': datetime.now().isoformat(),
            'focus_state': verdict_data['focus_state'],
            'confidence': verdict_data['confidence'],
            'beta_activity': verdict_data['beta_activity'],
            'session': verdict_data['session'],
            'analysis_timestamp': verdict_data['analysis_timestamp']
        })
        
        disconnected = set()
        for client in verdict_clients:
            try:
                await client.send(message)
            except:
                disconnected.add(client)
        
        for client in disconnected:
            verdict_clients.discard(client)

def start_verdict_websocket_server(loop):
    """Start WebSocket server for verdicts in the event loop"""
    global verdict_loop
    verdict_loop = loop
    asyncio.set_event_loop(loop)
    
    async def start_server_async():
        server = await websockets.serve(
            handle_verdict_client, 
            WEBSOCKET_HOST, 
            VERDICT_PORT,
            ping_interval=20,
            ping_timeout=10
        )
        print(f"✓ Verdict WebSocket server started on ws://{WEBSOCKET_HOST}:{VERDICT_PORT}")
        log_result(f"Verdict WebSocket server started on ws://{WEBSOCKET_HOST}:{VERDICT_PORT}")
        return server
    
    loop.run_until_complete(start_server_async())
    loop.run_forever()

# -------------------------------------------------------------------
# --- NEW: Gaze Helper Functions (CPU-bound logic) ---
# -------------------------------------------------------------------

def decode_frame(base64_str):
    """Decodes a Base64 string (from data:image/jpeg;base64,...) to an OpenCV image (numpy array)"""
    try:
        # Split the header from the data
        header, data = base64_str.split(',', 1)
        # Decode the Base64 data
        decoded_data = base64.b64decode(data)
        # Convert to numpy array
        np_arr = np.frombuffer(decoded_data, np.uint8)
        # Decode numpy array into OpenCV image
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        log_result(f"Error decoding frame: {e}")
        return None

def process_frame_for_gaze(frame):
    """
    This is the SLOW, BLOCKING function.
    It runs MediaPipe on a single frame and returns a text status.
    """
    gaze_text = "No Face"
    try:
        # We create a new FaceMesh instance *for this thread*
        # This is safer than sharing one instance across threads
        with mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5) as face_mesh:
            
            # Performance optimization
            frame.flags.writeable = False
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            results = face_mesh.process(rgb_frame)

            if results.multi_face_landmarks:
                face_landmarks = results.multi_face_landmarks[0]
                
                # --- Simplified Gaze Calculation Logic ---
                left_pupil_landmark = face_landmarks.landmark[473]
                right_pupil_landmark = face_landmarks.landmark[468]
                left_iris_coords = [face_landmarks.landmark[i] for i in range(474, 478)]
                left_iris_center_x = sum(l.x for l in left_iris_coords) / len(left_iris_coords)
                right_iris_coords = [face_landmarks.landmark[i] for i in range(469, 472)]
                right_iris_center_x = sum(l.x for l in right_iris_coords) / len(right_iris_coords)
                left_gaze_ratio = (left_pupil_landmark.x - left_iris_center_x) / (left_iris_coords[2].x - left_iris_coords[0].x)
                right_gaze_ratio = (right_pupil_landmark.x - right_iris_center_x) / (right_iris_coords[2].x - right_iris_coords[0].x)
                avg_gaze_ratio = (left_gaze_ratio + right_gaze_ratio) / 2

                if avg_gaze_ratio > 0.02: gaze_text = "Looking Right"
                elif avg_gaze_ratio < -0.02: gaze_text = "Looking Left"
                else: gaze_text = "Looking Center"
            
            return gaze_text
            
    except Exception as e:
        log_result(f"Error in gaze processing: {e}")
        return "Error"

# -------------------------------------------------------------------
# --- MODIFIED: WebSocket Server Functions for Gaze (Port 8767) ---
# -------------------------------------------------------------------
async def handle_gaze_client(websocket):
    """Handle 2-way Gaze connection. Receives frames, sends back results."""
    global gaze_clients, latest_gaze
    gaze_clients.add(websocket)
    client_address = websocket.remote_address
    print(f"\n🌐 [GAZE] Client connected: {client_address}")
    log_result(f"Gaze client connected: {client_address}")
    
    loop = asyncio.get_event_loop()
    
    try:
        # Send initial state
        await websocket.send(json.dumps({
            'type': 'connection', 'status': 'connected', 'message': 'Connected to Gaze Tracking Stream'
        }))
            
        # This loop handles INCOMING messages (video frames)
        async for message in websocket:
            data = json.loads(message)
            
            if data.get('type') == 'video_frame':
                # 1. Decode the frame
                frame = decode_frame(data['data'])
                if frame is None:
                    continue
                
                # 2. Run the SLOW processing in a separate thread pool
                #    so it doesn't block the asyncio server.
                gaze_status = await loop.run_in_executor(
                    None,  # Uses the default ThreadPoolExecutor
                    process_frame_for_gaze, # The blocking function
                    frame  # The argument to the function
                )
                
                # 3. Send the result back to the client
                if gaze_status != latest_gaze:
                    latest_gaze = gaze_status
                    response = {
                        'type': 'gaze_update',
                        'status': gaze_status,
                        'timestamp': datetime.now().isoformat()
                    }
                    await websocket.send(json.dumps(response))

    except websockets.exceptions.ConnectionClosed:
        print(f"\n🌐 [GAZE] Client disconnected: {client_address}")
        log_result(f"Gaze client disconnected: {client_address}")
    finally:
        gaze_clients.discard(websocket)

def start_gaze_websocket_server(loop):
    """Start WebSocket server for gaze data in the event loop"""
    global gaze_loop
    gaze_loop = loop
    asyncio.set_event_loop(loop)
    
    async def start_server_async():
        server = await websockets.serve(
            handle_gaze_client, 
            WEBSOCKET_HOST, 
            GAZE_PORT,
            ping_interval=20,
            ping_timeout=10,
            max_size=1_000_000  # Allow larger messages (1MB) for video frames
        )
        print(f"✓ Gaze WebSocket server (2-way) started on ws://{WEBSOCKET_HOST}:{GAZE_PORT}")
        log_result(f"Gaze WebSocket server started on ws://{WEBSOCKET_HOST}:{GAZE_PORT}")
        return server
    
    loop.run_until_complete(start_server_async())
    loop.run_forever()

# -------------------------------------------------------------------
# --- Thread-safe communication (EEG & Verdict) ---
# -------------------------------------------------------------------
def send_eeg_sample_sync(value):
    """Thread-safe way to send EEG sample"""
    try:
        if eeg_clients and eeg_loop:
            asyncio.run_coroutine_threadsafe(
                broadcast_eeg_sample(float(value)),
                eeg_loop
            )
    except Exception as e:
        pass

def send_verdict_sync(verdict_data):
    """Thread-safe way to send verdict"""
    global latest_verdict
    latest_verdict = verdict_data
    
    try:
        if verdict_clients and verdict_loop:
            asyncio.run_coroutine_threadsafe(
                broadcast_verdict(verdict_data),
                verdict_loop
            )
    except Exception as e:
        log_result(f"Error sending verdict via WebSocket: {e}")

# (Gaze_sync sender is no longer needed, it's handled in the 2-way socket)

# -------------------------------------------------------------------
# --- Helper Functions (EEG) ---
# -------------------------------------------------------------------

def parse_classification_result(output_text):
    try:
        result = json.loads(output_text.strip())
        if result.get('status') == 'success':
            return result['focus_state'], result['confidence'], result['beta_activity']
        else:
            return "ERROR", "N/A", "N/A"
    except:
        return "ERROR", "N/A", "N/A"

def display_focus_notification(focus_state, confidence, beta_pct, filename, duration_min):
    """Display prominent FINAL VERDICT for 4-minute recording"""
    reset_code = "\033[0m"
    
    if focus_state == "FOCUSED":
        border = "🟢" * 35
        color_code = "\033[92m"
        message = "FINAL VERDICT: USER WAS FOCUSED"
        advice = "✅ The user maintained good concentration during this 4-minute period."
        recommendation = "💡 Keep up the good work! This focus level is ideal for productivity."
    elif focus_state == "ERROR":
        border = "🟡" * 35
        color_code = "\033[93m"
        message = "FINAL VERDICT: ANALYSIS ERROR"
        advice = "⚠️ There was an error analyzing this recording."
        recommendation = "💡 Check the logs for details. Recording will continue."
    else:  # NOT FOCUSED or any other state
        border = "🔴" * 35
        color_code = "\033[91m"
        message = "FINAL VERDICT: USER WAS NOT FOCUSED"
        advice = "⚠️ The user showed low concentration during this 4-minute period."
        recommendation = "💡 Consider: Taking a break, changing environment, or trying focus techniques."
    
    print("\n\n")
    print("="*80)
    print("="*80)
    print(border)
    print(f"{color_code}")
    print(f"╔{'═' * 78}╗")
    print(f"║{' ' * 78}║")
    print(f"║{message.center(78)}║")
    print(f"║{' ' * 78}║")
    print(f"╚{'═' * 78}╝")
    print(f"{reset_code}")
    print(border)
    print("="*80)
    print("")
    print(f"  📁 File Analyzed: {filename}")
    print(f"  ⏱️  Recording Duration: {duration_min} minutes")
    print(f"  🎯 Confidence Level: {confidence}")
    print(f"  🧠 Beta Wave Activity: {beta_pct}")
    print("")
    print(f"  {advice}")
    print(f"  {recommendation}")
    print("")
    print(border)
    print("="*80)
    print("="*80 + "\n\n")

def log_result(message):
    """Log classification results with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_message = f"[{timestamp}] {message}"
    
    with open(RESULTS_LOG, 'a') as f:
        f.write(log_message + "\n")

def run_model_classification(filename, session_num):
    """Run the model classification on a completed 4-minute file"""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        log_result(f"{'='*70}")
        log_result(f"Analyzing 4-minute EEG recording: {filename}")
        log_result(f"{'='*70}")
        
        result = subprocess.run(
            ['python', MODEL_TEST_SCRIPT, filename],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # DEBUG OUTPUT - Shows exactly what predict4.py returned
        print("\n" + "="*70)
        print("DEBUG: Raw Model Output")
        print("="*70)
        print(f"STDOUT: '{result.stdout}'")
        print(f"STDERR: '{result.stderr}'")
        print(f"Return Code: {result.returncode}")
        print("="*70 + "\n")
        
        # Parse the JSON output
        output_to_parse = result.stdout.strip()
        
        if not output_to_parse:
            # If stdout is empty, check stderr
            output_to_parse = result.stderr.strip()
        
        log_result(f"Analysis completed for {filename}")
        log_result(f"\nRaw model output:\n{output_to_parse}")
        
        focus_state, confidence, beta_pct = parse_classification_result(output_to_parse)
        
        # Additional debug info
        print(f"DEBUG Parsed Results:")
        print(f"    Focus State: {focus_state}")
        print(f"    Confidence: {confidence}")
        print(f"    Beta Activity: {beta_pct}\n")
        
        # Display notification ONCE
        display_focus_notification(focus_state, confidence, beta_pct, filename, DURATION_MIN)
        
        log_result(f"\nFINAL VERDICT: {focus_state}")
        log_result(f"    Confidence: {confidence}")
        log_result(f"    Beta Activity: {beta_pct}")
        log_result(f"    Timestamp: {timestamp}")
        
        # Send verdict via WebSocket (separate port)
        verdict_data = {
            'focus_state': focus_state,
            'confidence': confidence,
            'beta_activity': beta_pct,
            'analysis_timestamp': timestamp,
            'session': session_num
        }
        send_verdict_sync(verdict_data)
        
        log_result(f"{'='*70}\n")
        
    except subprocess.TimeoutExpired:
        log_result(f"ERROR: Analysis timeout for {filename}")
        display_focus_notification("ERROR", "N/A", "N/A", filename, DURATION_MIN)
    except FileNotFoundError:
        log_result(f"ERROR: Model test script '{MODEL_TEST_SCRIPT}' not found!")
        display_focus_notification("ERROR", "N/A", "N/A", filename, DURATION_MIN)
    except Exception as e:
        log_result(f"ERROR during analysis of {filename}: {str(e)}")
        import traceback
        traceback.print_exc()
        display_focus_notification("ERROR", "N/A", "N/A", filename, DURATION_MIN)

def classify_file_async(filename, session_num):
    """Start classification in a background thread"""
    classification_thread = threading.Thread(
        target=run_model_classification,
        args=(filename, session_num),
        daemon=True
    )
    classification_thread.start()
    return classification_thread

# -------------------------------------------------------------------
# --- Main Script ---
# -------------------------------------------------------------------
ser = None
active_threads = []

try:
    # Check if model test script exists
    if not os.path.exists(MODEL_TEST_SCRIPT):
        print(f"WARNING: Model test script '{MODEL_TEST_SCRIPT}' not found!")
        print("Classification will not work. Please ensure the script is in the same directory.")
        response = input("Continue recording anyway? (y/n): ")
        if response.lower() != 'y':
            exit()
    
    # --- Start ALL THREE WebSocket servers ---
    print("\n🌐 Starting WebSocket servers...")
    
    # EEG Signal Server (8765)
    eeg_ws_loop = asyncio.new_event_loop()
    eeg_ws_thread = threading.Thread(target=start_eeg_websocket_server, args=(eeg_ws_loop,), daemon=True)
    eeg_ws_thread.start()
    
    # Verdict Server (8766)
    verdict_ws_loop = asyncio.new_event_loop()
    verdict_ws_thread = threading.Thread(target=start_verdict_websocket_server, args=(verdict_ws_loop,), daemon=True)
    verdict_ws_thread.start()
    
    # --- MODIFIED: Gaze Server (8767, 2-way) ---
    gaze_ws_loop = asyncio.new_event_loop()
    gaze_ws_thread = threading.Thread(target=start_gaze_websocket_server, args=(gaze_ws_loop,), daemon=True)
    gaze_ws_thread.start()
    
    time.sleep(1) # Give servers time to start
    
    # --- (The eye_thread is NO LONGER started here) ---
    
    # Initialize results log
    log_result("="*70 + "\nHARDWARE SERVER SESSION STARTED (EEG + GAZE)" + "\n" + "="*70)
    
    # Establish Serial Connection
    print(f"\n🔌 Attempting to connect to port {COM_PORT} at {BAUD_RATE} bps...")
    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
    print("✓ Connection successful. Waiting for device initialization...")
    time.sleep(2)
    
    print("\n" + "="*70)
    print("CONTINUOUS EEG MONITORING STARTED")
    print("="*70)
    print(f"⏱️  Analysis Interval: Every {DURATION_MIN} minutes")
    print(f"🌐 EEG Signal WebSocket: ws://{WEBSOCKET_HOST}:{EEG_PORT}")
    print(f"🌐 Verdict WebSocket: ws://{WEBSOCKET_HOST}:{VERDICT_PORT}")
    print(f"🌐 Gaze WebSocket (2-way): ws://{WEBSOCKET_HOST}:{GAZE_PORT}")
    print(f"🔄 Will run continuously until stopped (Ctrl+C)" + "\n" + "="*70) # <-- FIX 2
    
    current_file_index = 1
    session_number = 0
    sample_counter = 0
    
    # Main Continuous Loop (for EEG)
    while True:
        session_number += 1
        active_filename = FILENAME_1 if current_file_index == 1 else FILENAME_2
        previous_filename = FILENAME_2 if current_file_index == 1 else FILENAME_1
        
        print(f"\n{'='*70}")
        print(f"SESSION #{session_number} - EEG MONITORING")
        print(f"{'='*70}")
        print(f"📝 Recording to: {active_filename}")
        
        if session_number > 1:
            print(f"\n🔍 Analyzing previous recording: {previous_filename} (in background)")
            thread = classify_file_async(previous_filename, session_number - 1)
            active_threads.append(thread)
        else:
            print(f"\n📌 First session - no previous file to analyze yet")
        
        print(f"\n📊 Recording started at {datetime.now().strftime('%H:%M:%S')}")
        print(f"{'='*70}\n")
        
        # Open CSV File for Writing
        with open(active_filename, mode='w', newline='') as csvfile:
            csv_writer = csv.writer(csvfile)
            csv_writer.writerow(['channel1', 'channel2'])
            
            samples_recorded = 0
            start_time = time.time()
            
            while samples_recorded < MAX_SAMPLES_PER_FILE:
                line_bytes = ser.readline()
                
                if line_bytes:
                    try:
                        line_str = line_bytes.decode('utf-8').strip()
                        value = float(line_str)
                        
                        csv_writer.writerow([value, value])
                        samples_recorded += 1
                        sample_counter += 1
                        
                        # Send EEG sample via WebSocket periodically
                        if sample_counter % EEG_SEND_RATE == 0:
                            send_eeg_sample_sync(value)
                        
                        progress = (samples_recorded / MAX_SAMPLES_PER_FILE) * 100
                        print(f"📝 {active_filename} | "
                              f"Progress: {progress:.1f}% | "
                              f"Samples: {samples_recorded}/{MAX_SAMPLES_PER_FILE}",
                              end='\r')
                        
                    except ValueError:
                        print(f"\n⚠ Warning: Invalid data, skipping: {line_bytes}")
                        continue
                    except UnicodeDecodeError:
                        print(f"\n⚠ Warning: Decode error, skipping: {line_bytes}")
                        continue
        
        elapsed_time = time.time() - start_time
        print(f"\n\n✓ Recording complete!")
        print(f"    File: {active_filename}")
        print(f"    Samples recorded: {samples_recorded}")
        print(f"    Duration: {elapsed_time:.1f} seconds")
        
        log_result(f"Recording session #{session_number} completed: {active_filename} "
                   f"({samples_recorded} samples in {elapsed_time:.1f}s)")
        
        current_file_index = 2 if current_file_index == 1 else 1
        
        print(f"\n⏳ Switching to next file...")
        time.sleep(2)

except serial.SerialException as e:
    print(f"\n❌ Serial Error: Could not open port {COM_PORT}")
    print(f"    Details: {e}")
    print("\n💡 Troubleshooting:")
    print("    1. Check if device is connected")
    print("    2. Verify correct COM port")
    print("    3. Close other programs using the port")
    log_result(f"Serial connection error: {e}")

except KeyboardInterrupt:
    print("\n\n⏹ Recording stopped by user (Ctrl+C)")
    log_result("Recording stopped by user")

except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
    log_result(f"Unexpected error: {e}")
    import traceback
    traceback.print_exc()

finally:
    print("\n" + "="*70)
    print("SHUTDOWN SEQUENCE")
    print("="*70) # <-- FIX 1
    
    if ser and ser.is_open:
        ser.close()
        print("✓ Serial port closed")
    
    if active_threads:
        print(f"\n⏳ Waiting for {len(active_threads)} classification thread(s) to complete...")
        for i, thread in enumerate(active_threads, 1):
            if thread.is_alive():
                thread.join(timeout=10)
    
    # --- MODIFIED: Clean up ALL THREE WebSocket servers ---
    if eeg_loop:
        print("\n🌐 Shutting down EEG WebSocket server...")
        eeg_loop.call_soon_threadsafe(eeg_loop.stop)
    
    if verdict_loop:
        print("🌐 Shutting down Verdict WebSocket server...")
        verdict_loop.call_soon_threadsafe(verdict_loop.stop)

    if gaze_loop:
        print("🌐 Shutting down Gaze WebSocket server...")
        gaze_loop.call_soon_threadsafe(gaze_loop.stop)
    
    log_result("="*70 + "\nHARDWARE SERVER SESSION ENDED" + "\n" + "="*70)
    
    print(f"\n📊 Complete session log saved to: {RESULTS_LOG}")
    print("✓ Script terminated")
    print("="*70)
