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
import sys # Added for sys.exit in connection error handling

# --- Configuration Parameters ---
# Define the list of potential COM ports (Windows, Linux, Mac). 
# The script will try these ports in order until one succeeds.
POTENTIAL_PORTS = ['COM3', 'COM4', '/dev/ttyUSB0', '/dev/ttyACM0', '/dev/tty.usbmodem1234']

BAUD_RATE = 115200
SAMPLE_RATE = 256
DURATION_MIN = 4

# WebSocket Configuration
WEBSOCKET_HOST = 'localhost'
WEBSOCKET_PORT = 8765
EEG_SEND_RATE = 10  # Send EEG samples every 10 samples (25.6 Hz effective rate)

# Calculate the total number of samples to record per file
MAX_SAMPLES_PER_FILE = SAMPLE_RATE * DURATION_MIN * 60

# Define the two filenames for alternating writes
FILENAME_1 = 'eeg_recording_file_1.csv'
FILENAME_2 = 'eeg_recording_file_2.csv'

# Model testing script
MODEL_TEST_SCRIPT = 'predict3.py'

# Results log file
RESULTS_LOG = 'classification_results_log.txt'

# Global WebSocket state
websocket_clients = set()
eeg_sample_buffer = deque(maxlen=1000)
websocket_loop = None
latest_verdict = {
    'state': 'UNKNOWN',
    'confidence': 'N/A',
    'beta_activity': 'N/A',
    'timestamp': None,
    'session': 0
}

# --- WebSocket Server Functions ---
async def handle_client(websocket):
    """Handle WebSocket client connection"""
    global websocket_clients
    websocket_clients.add(websocket)
    client_address = websocket.remote_address
    print(f"\n🌐 WebSocket client connected: {client_address}")
    log_result(f"WebSocket client connected: {client_address}")
    
    try:
        # Send initial state
        await websocket.send(json.dumps({
            'type': 'connection',
            'status': 'connected',
            'message': 'Connected to EEG Monitor',
            'sample_rate': SAMPLE_RATE,
            'verdict_interval': f'{DURATION_MIN} minutes'
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
        print(f"\n🌐 WebSocket client disconnected: {client_address}")
        log_result(f"WebSocket client disconnected: {client_address}")
    finally:
        websocket_clients.discard(websocket)

async def broadcast_eeg_sample(sample_data):
    """Broadcast EEG sample to all connected clients"""
    if websocket_clients:
        message = json.dumps({
            'type': 'eeg_sample',
            'timestamp': datetime.now().isoformat(),
            'value': sample_data
        })
        
        disconnected = set()
        for client in websocket_clients:
            try:
                await client.send(message)
            except:
                disconnected.add(client)
        
        for client in disconnected:
            websocket_clients.discard(client)

async def broadcast_verdict(verdict_data):
    """Broadcast focus verdict to all connected clients"""
    if websocket_clients:
        message = json.dumps({
            'type': 'verdict',
            'timestamp': datetime.now().isoformat(),
            'focus_state': verdict_data['state'],
            'confidence': verdict_data['confidence'],
            'beta_activity': verdict_data['beta_activity'],
            'session': verdict_data['session'],
            'analysis_timestamp': verdict_data['timestamp']
        })
        
        disconnected = set()
        for client in websocket_clients:
            try:
                await client.send(message)
            except:
                disconnected.add(client)
        
        for client in disconnected:
            websocket_clients.discard(client)

def start_websocket_server(loop):
    """Start WebSocket server in the event loop"""
    global websocket_loop
    websocket_loop = loop
    asyncio.set_event_loop(loop)
    
    async def start_server_async():
        server = await websockets.serve(
            handle_client, 
            WEBSOCKET_HOST, 
            WEBSOCKET_PORT,
            ping_interval=20,
            ping_timeout=10
        )
        print(f"✓ WebSocket server started on ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}")
        log_result(f"WebSocket server started on ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}")
        return server
    
    loop.run_until_complete(start_server_async())
    loop.run_forever()

def send_eeg_sample_sync(value):
    """Thread-safe way to send EEG sample"""
    try:
        eeg_sample_buffer.append({
            'timestamp': datetime.now().isoformat(),
            'value': float(value)
        })
        
        if websocket_clients and websocket_loop:
            asyncio.run_coroutine_threadsafe(
                broadcast_eeg_sample(float(value)),
                websocket_loop
            )
    except Exception as e:
        pass

def send_verdict_sync(verdict_data):
    """Thread-safe way to send verdict"""
    global latest_verdict
    latest_verdict = verdict_data
    
    try:
        if websocket_clients and websocket_loop:
            asyncio.run_coroutine_threadsafe(
                broadcast_verdict(verdict_data),
                websocket_loop
            )
    except Exception as e:
        log_result(f"Error sending verdict via WebSocket: {e}")

# --- Helper Functions ---
def parse_classification_result(output_text):
    """Parse the simplified model output - SUPER SIMPLE VERSION"""
    try:
        # The output is now just one line: either "FOCUSED" or "NOT FOCUSED"
        output_clean = output_text.strip().upper()
        
        print(f"\n[PARSER DEBUG] Raw output: '{output_text}'")
        print(f"[PARSER DEBUG] Cleaned output: '{output_clean}'")
        
        # Look for the structured output keys (recommended in previous steps)
        focus_state = "UNKNOWN"
        confidence = "N/A"
        beta_percentage = "N/A"
        
        for line in output_clean.split('\n'):
            if line.startswith("FOCUS_STATE:"):
                focus_state = line.split(":")[1].strip()
            elif line.startswith("CONFIDENCE:"):
                confidence = line.split(":")[1].strip()
            elif line.startswith("BETA_REL_POWER:"):
                beta_percentage = line.split(":")[1].strip()

        # Fallback for old simple output (if structured output is missing)
        if focus_state == "UNKNOWN":
            if "FOCUSED" in output_clean and "NOT FOCUSED" not in output_clean:
                focus_state = "FOCUSED"
            else:
                focus_state = "NOT FOCUSED"
                
        # Set descriptive values based on state
        if focus_state == "FOCUSED":
            emoji = "🎯"
            description = "Beta-dominant brain activity detected"
            state_color = "\033[92m"
        else:
            emoji = "😴"
            description = "Non-beta or low focus state detected"
            state_color = "\033[91m"
            
        print(f"[PARSER DEBUG] ✓ Result: {focus_state}")
        
        return focus_state, confidence, beta_percentage, emoji, description, state_color
    
    except Exception as e:
        print(f"[PARSER DEBUG] Exception: {e}")
        return "ERROR", "N/A", "N/A", "⚠️", f"Error parsing result: {str(e)}", "\033[93m"


def display_focus_notification(focus_state, confidence, beta_pct, filename, duration_min):
    """Display prominent FINAL VERDICT for 4-minute recording"""
    reset_code = "\033[0m"
    
    if focus_state == "FOCUSED":
        border = "🟢" * 35
        color_code = "\033[92m"
        message = "FINAL VERDICT: USER WAS FOCUSED"
        advice = "✅ The user maintained good concentration during this 4-minute period."
        recommendation = "💡 Keep up the good work! This focus level is ideal for productivity."
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
        
        # DEBUG OUTPUT - Shows exactly what predict.py returned
        print("\n" + "="*70)
        print("DEBUG: Raw Model Output")
        print("="*70)
        print(f"STDOUT: '{result.stdout}'")
        print(f"STDERR: '{result.stderr}'")
        print(f"Return Code: {result.returncode}")
        print("="*70 + "\n")
        
        # Parse the output regardless of return code
        output_to_parse = result.stdout if result.stdout.strip() else result.stderr
        
        log_result(f"Analysis completed for {filename}")
        log_result(f"\nRaw model output:\n{output_to_parse}")
        
        focus_state, confidence, beta_pct, emoji, description, color = parse_classification_result(output_to_parse)
        
        # Additional debug info
        print(f"DEBUG Parsed Results:")
        print(f"    Focus State: {focus_state}")
        print(f"    Confidence: {confidence}")
        print(f"    Beta Activity: {beta_pct}\n")
        
        # Display notification ONCE
        display_focus_notification(focus_state, confidence, beta_pct, filename, DURATION_MIN)
        
        log_result(f"\n{emoji} FINAL VERDICT: {focus_state}")
        log_result(f"    Confidence: {confidence}")
        log_result(f"    Beta Activity: {beta_pct}")
        log_result(f"    Analysis: {description}")
        log_result(f"    Timestamp: {timestamp}")
        
        # Send verdict via WebSocket
        verdict_data = {
            'state': focus_state,
            'confidence': confidence,
            'beta_activity': beta_pct,
            'timestamp': timestamp,
            'session': session_num
        }
        send_verdict_sync(verdict_data)
        
        log_result(f"{'='*70}\n")
        
    except subprocess.TimeoutExpired:
        log_result(f"ERROR: Analysis timeout for {filename}")
        display_focus_notification("NOT FOCUSED", "N/A", "N/A", filename, DURATION_MIN)
    except FileNotFoundError:
        log_result(f"ERROR: Model test script '{MODEL_TEST_SCRIPT}' not found!")
        display_focus_notification("NOT FOCUSED", "N/A", "N/A", filename, DURATION_MIN)
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

# --- Main Script ---
ser = None
active_threads = []

try:
    # Check if model test script exists
    if not os.path.exists(MODEL_TEST_SCRIPT):
        print(f"WARNING: Model test script '{MODEL_TEST_SCRIPT}' not found!")
        print("Classification will not work. Please ensure the script is in the same directory.")
        response = input("Continue recording anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    # Start WebSocket server in background thread
    print("\n🌐 Starting WebSocket server...")
    ws_loop = asyncio.new_event_loop()
    ws_thread = threading.Thread(
        target=start_websocket_server,
        args=(ws_loop,),
        daemon=True
    )
    ws_thread.start()
    time.sleep(1)  # Give server time to start
    
    # Initialize results log
    log_result("="*70)
    log_result("EEG RECORDING AND CLASSIFICATION SESSION STARTED")
    log_result("="*70)
    
    # Establish Serial Connection (New Robust Logic)
    ser = None
    connected_port = None
    
    for port_name in POTENTIAL_PORTS:
        try:
            print(f"\n🔌 Attempting to connect to port {port_name} at {BAUD_RATE} bps...")
            
            # Attempt to open the port
            ser = serial.Serial(port_name, BAUD_RATE, timeout=1)
            connected_port = port_name
            print(f"✓ Connection successful on port: {connected_port}. Waiting for device initialization...")
            time.sleep(2)
            break  # Connection successful, exit the loop
            
        except serial.SerialException as e:
            # Port not found, permission denied, or other serial error
            print(f"❌ Port {port_name} failed. Details: {e}")
            ser = None
            continue

    if ser is None:
        # If the loop completes without a connection, print full error and exit
        print("\n❌ Serial Error: Could not establish a connection on any known port.")
        print(f"💡 Tried ports: {POTENTIAL_PORTS}")
        print("\n📋 Available COM ports (for manual check):")
        ports = serial.tools.list_ports.comports()
        for port in ports:
            print(f"   - {port}")
        log_result(f"CRITICAL Serial connection failure. Tried ports: {POTENTIAL_PORTS}")
        sys.exit(1) # Exit immediately before the main loop starts
        
    # --- Start Monitoring Loop ---
    
    print("\n" + "="*70)
    print("CONTINUOUS EEG MONITORING STARTED")
    print("="*70)
    print(f"✅ Connected to: {connected_port}")
    print(f"⏱️  Analysis Interval: Every {DURATION_MIN} minutes")
    print(f"📊 Files alternating: {FILENAME_1} ↔ {FILENAME_2}")
    print(f"🌐 WebSocket: ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}")
    print(f"🔄 Will run continuously until stopped (Ctrl+C)")
    print("="*70)
    
    current_file_index = 1
    session_number = 0
    sample_counter = 0
    
    # Main Continuous Loop
    while True:
        session_number += 1
        
        active_filename = FILENAME_1 if current_file_index == 1 else FILENAME_2
        previous_filename = FILENAME_2 if current_file_index == 1 else FILENAME_1
        
        print(f"\n{'='*70}")
        print(f"SESSION #{session_number} - CONTINUOUS MONITORING")
        print(f"{'='*70}")
        print(f"📝 Recording to: {active_filename}")
        print(f"⏱️  Duration: {DURATION_MIN} minutes ({MAX_SAMPLES_PER_FILE} samples)")
        
        if session_number > 1:
            print(f"\n🔍 Analyzing previous 4-minute recording: {previous_filename}")
            print(f"    (Analysis runs in background while recording continues)")
            print(f"    You will see the FINAL VERDICT shortly...")
            
            thread = classify_file_async(previous_filename, session_number - 1)
            active_threads.append(thread)
        else:
            print(f"\n📌 First session - no previous file to analyze yet")
            print(f"    Next session will analyze this file")
            
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
                        
                        elapsed_time = time.time() - start_time
                        progress = (samples_recorded / MAX_SAMPLES_PER_FILE) * 100
                        expected_time = (MAX_SAMPLES_PER_FILE / SAMPLE_RATE)
                        remaining_time = expected_time - elapsed_time
                        
                        print(f"📝 {active_filename} | "
                              f"Progress: {progress:.1f}% | "
                              f"Samples: {samples_recorded}/{MAX_SAMPLES_PER_FILE} | "
                              f"Time remaining: {remaining_time:.0f}s | "
                              f"Value: {value:.2f}",
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
            print(f"    File size: {os.path.getsize(active_filename) / 1024:.1f} KB")
            
            log_result(f"Recording session #{session_number} completed: {active_filename} "
                       f"({samples_recorded} samples in {elapsed_time:.1f}s)")
            
            current_file_index = 2 if current_file_index == 1 else 1
            
            print(f"\n⏳ Switching to next file in 2 seconds...")
            print(f"    Next recording: {'file_1' if current_file_index == 1 else 'file_2'}.csv")
            time.sleep(2)

except serial.SerialException as e:
    # This block now handles errors that occur AFTER a successful connection (e.g., device unplugged)
    print(f"\n❌ Serial Error: The connection was lost or an unrecoverable error occurred.")
    print(f"    Details: {e}")
    print("\n💡 Troubleshooting:")
    print("    1. Check if device is connected")
    print("    2. Verify correct COM port (check the top of the script)")
    print("    3. Close other programs using the port")
    print("    4. Try unplugging and reconnecting the device")
    print("\n📋 Available COM ports:")
    ports = serial.tools.list_ports.comports()
    for port in ports:
        print(f"    - {port}")
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
    print("="*70)
    
    if ser and ser.is_open:
        ser.close()
        print("✓ Serial port closed")
    
    if active_threads:
        print(f"\n⏳ Waiting for {len(active_threads)} classification thread(s) to complete...")
        for i, thread in enumerate(active_threads, 1):
            if thread.is_alive():
                print(f"    Thread {i}: Waiting...")
                thread.join(timeout=10)
                if thread.is_alive():
                    print(f"    Thread {i}: Timeout (still running in background)")
                else:
                    print(f"    Thread {i}: Completed")
    
    # Clean up WebSocket server
    if websocket_loop:
        print("\n🌐 Shutting down WebSocket server...")
        # Note: This may not always work gracefully across all Python versions/environments
        try:
             websocket_loop.call_soon_threadsafe(websocket_loop.stop)
        except Exception as e:
             # Loop might already be stopped or shutting down
             pass 
    
    log_result("="*70)
    log_result("EEG RECORDING AND CLASSIFICATION SESSION ENDED")
    log_result("="*70)
    
    print(f"\n📊 Complete session log saved to: {RESULTS_LOG}")
    print("✓ Script terminated")
    print("="*70)
