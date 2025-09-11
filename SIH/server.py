import asyncio
import json
import numpy as np
from scipy.signal import welch, butter, filtfilt
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
import websockets
import os
from functools import partial

# --- Configuration Constants ---
FS = 500  # Sampling frequency
CHUNK_SIZE = 200  # Number of samples per update (0.4s)
VERDICT_WINDOW_CHUNKS = 25 # Issue a verdict every 25 chunks (10 seconds)

class FocusMonitor:
    # ... (The FocusMonitor class remains exactly the same as before) ...
    """
    Encapsulates the EEG processing pipeline, modified to provide data for a server.
    """
    def __init__(self, data_filepath):
        self._load_data(data_filepath)
        self.data_stream = self._data_provider()
        self.scaler = StandardScaler()
        self.clf = SVC(kernel='linear', probability=True)
        self._train_model()

    def _load_data(self, filepath):
        print(f"Loading data from '{filepath}'...")
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Data file not found: '{filepath}'")
        data = np.load(filepath)
        self.full_eeg_signal = data['signal']
        print("✅ Data loaded successfully.")

    def _data_provider(self):
        current_pos = 0
        while True:
            yield self.full_eeg_signal[current_pos : current_pos + CHUNK_SIZE]
            current_pos += CHUNK_SIZE
            if current_pos + CHUNK_SIZE > len(self.full_eeg_signal):
                print("🔄 Reached end of data, looping back.")
                current_pos = 0

    def _bandpass_filter(self, data, lowcut=1.0, highcut=40.0, order=4):
        nyq = 0.5 * FS
        low = lowcut / nyq
        high = highcut / nyq
        b, a = butter(order, [low, high], btype='band')
        return filtfilt(b, a, data)

    def _extract_features(self, data):
        filtered = self._bandpass_filter(data)
        freqs, psd = welch(filtered, FS, nperseg=len(data))
        bands = {'beta': (12, 30)} # Focusing on beta for this example
        features = []
        for low, high in bands.values():
            idx = np.logical_and(freqs >= low, freqs <= high)
            band_power = np.mean(psd[idx]) if idx.any() else 0
            features.append(band_power)
        return np.array(features)

    def _train_model(self):
        # Simplified training for demonstration
        print("Training baseline model...")
        X_train, y_train = [], []
        # Focused (higher beta)
        X_train.append([0.8])
        y_train.append(1)
        # Unfocused (lower beta)
        X_train.append([0.2])
        y_train.append(0)
        
        for _ in range(50):
            X_train.append([0.7 + np.random.rand() * 0.2]) # High beta
            y_train.append(1)
            X_train.append([0.1 + np.random.rand() * 0.2]) # Low beta
            y_train.append(0)

        X_train_scaled = self.scaler.fit_transform(X_train)
        self.clf.fit(X_train_scaled, y_train)
        print("✅ Model trained successfully.")
    
    # --- MODIFIED METHOD ---
    def process_chunk(self):
        """Processes one chunk and returns the raw signal and prediction label."""
        new_data = next(self.data_stream)
        raw_features = self._extract_features(new_data)
        
        features_for_ml = raw_features.reshape(1, -1)
        features_scaled = self.scaler.transform(features_for_ml)
        pred_label = self.clf.predict(features_scaled)[0]
        
        # Return the raw data and the prediction label (0 or 1)
        return new_data, pred_label

# --- UPDATED HANDLER ---
async def eeg_handler(monitor, connection):
    """
    Handles the WebSocket connection, manages verdict state, and sends data.
    """
    print("🟢 Client connected.")
    
    # State for managing verdicts
    prediction_history = []
    verdict_countdown = VERDICT_WINDOW_CHUNKS
    current_verdict = "NO VERDICT"

    try:
        while True:
            # 1. Get raw data and an instantaneous prediction
            new_data, pred_label = monitor.process_chunk()
            
            # 2. Update state for the verdict window
            prediction_history.append(pred_label)
            verdict_countdown -= 1

            # 3. Check if it's time to issue a new verdict
            if verdict_countdown <= 0:
                focused_count = sum(prediction_history)
                total_predictions = len(prediction_history)
                
                # Make a decision based on the majority of predictions in the window
                if focused_count > total_predictions / 2:
                    current_verdict = "FOCUSED"
                else:
                    current_verdict = "NOT FOCUSED"
                
                # Reset for the next window
                prediction_history = []
                verdict_countdown = VERDICT_WINDOW_CHUNKS

            # 4. Create and send the data payload to the client
            data_payload = {
                "signal": new_data.tolist(),
                "status": current_verdict, # Always send the overall verdict
            }
            await connection.send(json.dumps(data_payload))
            await asyncio.sleep(CHUNK_SIZE / FS)
            
    except websockets.exceptions.ConnectionClosed:
        print("🔴 Client disconnected.")
    except Exception as e:
        print(f"An error occurred: {e}")

# --- UPDATED MAIN EXECUTION BLOCK ---
async def main():
    DATA_FILE = 'simulated_20min_eeg.npz'
    
    # Initialize the monitor and train the model ONCE
    print("Initializing Focus Monitor...")
    monitor = FocusMonitor(data_filepath=DATA_FILE)
    
    # Pass the single monitor instance to all connection handlers
    handler_with_monitor = partial(eeg_handler, monitor)
    
    host = "localhost"
    port = 8765
    async with websockets.serve(handler_with_monitor, host, port):
        print(f"🚀 WebSocket server started at ws://{host}:{port}")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer is shutting down.")