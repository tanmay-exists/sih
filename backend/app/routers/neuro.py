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
MODEL_TEST_SCRIPT = 'app/ml/predict4.py'  # Adjust path
RESULTS_LOG = 'classification_results_log.txt'

router = APIRouter(prefix="/neuro", tags=["neuro"])

# Global state (per user? For simplicity, shared; scale with dict if multi-user)
eeg_loop_running = False
eeg_thread = None
websocket_clients = {}  # user_id: set of websockets
eeg_sample_buffer = deque(maxlen=1000)
latest_verdict = {'state': 'UNKNOWN', 'confidence': 'N/A', 'beta_activity': 'N/A', 'timestamp': None, 'session': 0}

def log_result(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
        else:
            ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
            time.sleep(2)
        
        current_file_index = 1
        session_number = 0
        
        while eeg_loop_running:
            session_number += 1
            active_filename = FILENAME_1 if current_file_index == 1 else FILENAME_2
            previous_filename = FILENAME_2 if current_file_index == 1 else FILENAME_1
            
            if session_number > 1:
                # Classify previous
                result = subprocess.run(['python', MODEL_TEST_SCRIPT, previous_filename], capture_output=True, text=True)
                output = result.stdout.strip() or result.stderr.strip()
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
                
                # Broadcast
                asyncio.run_coroutine_threadsafe(broadcast_to_user(user_id, verdict_data), asyncio.get_event_loop())
                
                # Save session to DB
                db = client["NLHistory"]
                asyncio.run_coroutine_threadsafe(
                    db["sessions"].insert_one({
                        "userId": user_id,
                        "timestamp": datetime.fromisoformat(verdict_data['timestamp']),
                        "duration": DURATION_MIN * 60
                    }),
                    asyncio.get_event_loop()
                )
            
            # Record new file
            with open(active_filename, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(['channel1', 'channel2'])
                samples = 0
                start_time = time.time()
                
                while samples < MAX_SAMPLES_PER_FILE and eeg_loop_running:
                    if SIMULATION_MODE:
                        t = time.time()
                        value = 500 * math.sin(2 * math.pi * 10 * (t % 1)) + random.uniform(-50, 50)
                    else:
                        line = ser.readline().decode('utf-8').strip()
                        try:
                            value = float(line)
                        except:
                            continue
                    
                    writer.writerow([value, value])
                    samples += 1
                    
                    if samples % EEG_SEND_RATE == 0:
                        asyncio.run_coroutine_threadsafe(
                            broadcast_to_user(user_id, {
                                'type': 'eeg_sample',
                                'timestamp': datetime.now().isoformat(),
                                'value': value
                            }),
                            asyncio.get_event_loop()
                        )
                    
                    time.sleep(1 / SAMPLE_RATE)  # Approximate rate
            
            current_file_index = 3 - current_file_index  # Toggle 1<->2
        
    except Exception as e:
        log_result(f"EEG monitoring error: {e}")
    finally:
        if ser:
            ser.close()
        eeg_loop_running = False

@router.websocket("/ws/eeg")
async def eeg_websocket(websocket: WebSocket, token: str = Query(...), client: AsyncIOMotorClient = Depends(get_db_client)):
    user = await get_current_user_ws(token, client)
    user_id = user["userId"]
    
    await websocket.accept()
    if user_id not in websocket_clients:
        websocket_clients[user_id] = set()
    websocket_clients[user_id].add(websocket)
    
    global eeg_thread
    if not eeg_loop_running:
        eeg_thread = threading.Thread(target=run_eeg_monitoring, args=(user_id, client), daemon=True)
        eeg_thread.start()
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle pings or other msgs if needed
    except WebSocketDisconnect:
        websocket_clients[user_id].discard(websocket)
        if not websocket_clients.get(user_id):
            eeg_loop_running = False  # No global declaration needed here
