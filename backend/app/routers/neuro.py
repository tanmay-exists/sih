# neuro.py (with enhanced logging)

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, Query
from app.dependencies import get_db_client, get_current_user_ws
import asyncio
from collections import deque
import threading
import time
import csv
import subprocess
import os
from datetime import datetime
import json
import serial
import random
import math
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

COM_PORT = os.getenv("COM_PORT")
BAUD_RATE = int(os.getenv("BAUD_RATE"))
SAMPLE_RATE = int(os.getenv("SAMPLE_RATE"))
DURATION_MIN = int(os.getenv("DURATION_MIN"))
EEG_SEND_RATE = int(os.getenv("EEG_SEND_RATE"))
SIMULATION_MODE = os.getenv("SIMULATION_MODE") == "True"

MAX_SAMPLES_PER_FILE = SAMPLE_RATE * DURATION_MIN * 60
FILENAME_1 = 'eeg_recording_file_1.csv'
FILENAME_2 = 'eeg_recording_file_2.csv'
MODEL_TEST_SCRIPT = 'app/ml/predict4.py'  # Path from backend root
RESULTS_LOG = 'classification_results_log.txt'

# --- SOLUTION STEP 2 (Option A) ---
# Get the absolute path to the 'app/ml' directory
# This assumes your uvicorn server runs from the 'backend' folder
SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__)) # /backend/app/routers
ML_DIR = os.path.join(SCRIPT_DIR, '..', 'ml') # /backend/app/ml
ML_DIR_ABSOLUTE = os.path.abspath(ML_DIR)

router = APIRouter(prefix="/neuro", tags=["neuro"])

# Global state
eeg_loop_running = False
eeg_thread = None
websocket_clients = {}  # user_id: set of websockets
eeg_sample_buffer = deque(maxlen=1000)
latest_verdict = {'state': 'UNKNOWN', 'confidence': 'N/A', 'beta_activity': 'N/A', 'timestamp': None, 'session': 0}
MAIN_LOOP = None


def log_result(message):
    timestamp = datetime.now().strftime("%Y-m-%d %H:%M:%S")
    with open(RESULTS_LOG, 'a') as f:
        f.write(f"[{timestamp}] {message}\n")

def parse_classification_result(output_text):
    try:
        result = json.loads(output_text.strip())
        if result.get('status') == 'success':
            return result['focus_state'], result['confidence'], result['beta_activity']
        return "ERROR", "N/A", "N/A"
    except:
        return "ERROR", "N/A", "N/A"

async def broadcast_to_user(user_id: str, message: dict):
    clients = websocket_clients.get(user_id, set())
    disconnected = set()
    for client in clients:
        try:
            await client.send_json(message)
        except:
            disconnected.add(client)
    for d in disconnected:
        clients.discard(d)
    if not clients:
        websocket_clients.pop(user_id, None)

def run_eeg_monitoring(user_id: str, client: AsyncIOMotorClient):
    global eeg_loop_running, eeg_thread
    if eeg_loop_running:
        return  # Already running
    
    eeg_loop_running = True
    ser = None
    try:
        if SIMULATION_MODE:
            ser = None
            log_result("Starting EEG monitoring in SIMULATION MODE.")
        else:
            log_result(f"Attempting to connect to serial port {COM_PORT} at {BAUD_RATE} bps...")
            ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
            log_result("Serial connection successful.")
            time.sleep(2) # Wait for device to initialize
        
        current_file_index = 1
        session_number = 0
        
        while eeg_loop_running:
            session_number += 1
            active_filename = FILENAME_1 if current_file_index == 1 else FILENAME_2
            previous_filename = FILENAME_2 if current_file_index == 1 else FILENAME_1
            
            if session_number > 1:
                log_result(f"Starting classification for {previous_filename}...")
                log_result(f"Running model from directory: {ML_DIR_ABSOLUTE}")
                result = subprocess.run(
                    ['python', MODEL_TEST_SCRIPT, previous_filename], 
                    capture_output=True, 
                    text=True,
                    cwd=ML_DIR_ABSOLUTE  # <--- THIS IS THE FIX
                )
                
                output = result.stdout.strip() or result.stderr.strip()
                log_result(f"Model output for {previous_filename}:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}")
                
                focus_state, confidence, beta_pct = parse_classification_result(output)
                
                verdict_data = {
                    'type': 'verdict',
                    'state': focus_state,
                    'confidence': confidence,
                    'beta_activity': beta_pct,
                    'timestamp': datetime.now().isoformat(),
                    'session': session_number - 1
                }
                latest_verdict.update(verdict_data)
                log_result(f"Broadcasting verdict: {focus_state}, {confidence}")

                # Broadcast
                if MAIN_LOOP:
                    asyncio.run_coroutine_threadsafe(
                        broadcast_to_user(user_id, verdict_data),
                        MAIN_LOOP
                    )

                # Save session to DB
                if MAIN_LOOP:
                    db = client["NLHistory"]
                    asyncio.run_coroutine_threadsafe(
                        db["sessions"].insert_one({
                            "userId": user_id,
                            "timestamp": datetime.fromisoformat(verdict_data['timestamp']),
                            "duration": DURATION_MIN * 60
                        }),
                        MAIN_LOOP 
                    )
            
            # Record new file
            log_result(f"Starting recording session #{session_number} to {active_filename}...")
            with open(active_filename, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(['channel1', 'channel2'])
                samples = 0
                
                while samples < MAX_SAMPLES_PER_FILE and eeg_loop_running:
                    value = 0.0 # Default value

                    if SIMULATION_MODE:
                        t = time.time()
                        value = 500 * math.sin(2 * math.pi * 10 * (t % 1)) + random.uniform(-50, 50)
                    else:
                        # --- START OF MODIFIED SECTION ---
                        try:
                            # 1. Read the raw bytes
                            line_bytes = ser.readline()
                            
                            if not line_bytes:
                                # This is a timeout (1s), not an error. 
                                # Just continue and try reading again.
                                continue

                            # 2. Try to decode
                            line_str = line_bytes.decode('utf-8').strip()
                            
                            if not line_str:
                                # Received an empty line, skip
                                continue 
                            
                            # 3. Try to convert
                            value = float(line_str)
                            
                        except UnicodeDecodeError:
                            log_result(f"CRITICAL ERROR: UnicodeDecodeError. Data is not UTF-8. Raw: {line_bytes}")
                            continue
                        except (ValueError, IndexError):
                            # This is the most likely error.
                            log_result(f"WARNING: ValueError. Could not convert '{line_str}' to float. Skipping.")
                            continue
                        except Exception as e:
                            log_result(f"CRITICAL ERROR in serial loop: {e}. Raw bytes: {line_bytes}")
                            continue
                        # --- END OF MODIFIED SECTION ---
                    
                    # Write the duplicated value, which the model expects
                    writer.writerow([value, value])
                    samples += 1

                    if samples % EEG_SEND_RATE == 0:
                        if MAIN_LOOP:
                            asyncio.run_coroutine_threadsafe(
                                broadcast_to_user(user_id, {
                                    'type': 'eeg_sample',
                                    'timestamp': datetime.now().isoformat(),
                                    'value': value # Send the single value to the graph
                                }),
                                MAIN_LOOP
                            )
                    
                    # Don't sleep if using ser.readline(), it blocks already
                    if SIMULATION_MODE:
                        time.sleep(1 / SAMPLE_RATE)
            
            log_result(f"Finished recording session #{session_number}. Wrote {samples} samples.")
            current_file_index = 3 - current_file_index  # Toggle 1<->2
            
    except serial.SerialException as e:
        log_result(f"FATAL SERIAL ERROR: {e}. Check port and connection.")
        # Try to send an error message to the client
        if MAIN_LOOP:
            asyncio.run_coroutine_threadsafe(
                broadcast_to_user(user_id, {'type': 'error', 'message': f'Serial Connection Failed: {e}'}),
                MAIN_LOOP
            )
    except Exception as e:
        log_result(f"EEG monitoring error: {e}")
        import traceback
        log_result(traceback.format_exc())
    finally:
        if ser:
            ser.close()
            log_result("Serial port closed.")
        eeg_loop_running = False
        log_result("EEG monitoring loop stopped.")

@router.websocket("/ws/eeg")
async def eeg_websocket(websocket: WebSocket, token: str = Query(...), client: AsyncIOMotorClient = Depends(get_db_client)):
    global eeg_loop_running, eeg_thread, MAIN_LOOP
    user = await get_current_user_ws(token, client)
    user_id = user["userId"]
    
    await websocket.accept()
    if user_id not in websocket_clients:
        websocket_clients[user_id] = set()
    websocket_clients[user_id].add(websocket)
    
    global eeg_thread
    if not eeg_loop_running:
        if MAIN_LOOP is None:
            MAIN_LOOP = asyncio.get_event_loop()
            
        eeg_thread = threading.Thread(target=run_eeg_monitoring, args=(user_id, client), daemon=True)
        eeg_thread.start()
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle pings or other msgs if needed
            if data == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        websocket_clients[user_id].discard(websocket)
        if not websocket_clients.get(user_id):
            # No clients left for this user, stop the loop
            # Note: This simple logic stops it for everyone.
            # A better system would track *all* users.
            eeg_loop_running = False
