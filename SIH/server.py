import numpy as np
import os
import asyncio
import websockets
import json
from scipy.signal import welch, butter, filtfilt
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler

# --- Configuration Constants (from original script) ---
FS = 5000  # Sampling frequency
CHUNK_SIZE = 200  # Number of samples per update
FOCUS_WINDOW_CHUNKS = 1200  # Make a decision every 1200 chunks (48 seconds)
DATA_FILE = 'simulated_20min_eeg.npz'

class FocusMonitor:
    """
    Encapsulates the EEG processing pipeline.
    The core logic is identical to the original script, but the Matplotlib
    visualization parts have been removed in favor of a method that returns
    state as a dictionary for WebSocket transmission.
    """
    def __init__(self, data_filepath):
        # --- Load Pre-generated Data ---
        self._load_data(data_filepath)
        self.data_stream = self._data_provider()

        # --- ML Model and Scaler ---
        self.scaler = StandardScaler()
        self.clf = SVC(kernel='linear', probability=True)
        self._train_model()

        # --- Real-time Data & State ---
        self.eeg_buffer = np.zeros(FS * 2)  # Buffer for plotting
        self.focus_history = []
        self.time_remaining = FOCUS_WINDOW_CHUNKS
        self.last_focus_verdict = "No verdict yet"

    def _load_data(self, filepath):
        """Loads the long EEG signal from the specified .npz file."""
        print(f"Loading data from '{filepath}'...")
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Data file not found. Please run generate_data.py to create '{filepath}'.")
        
        data = np.load(filepath)
        self.full_eeg_signal = data['signal']
        print("✅ Data loaded successfully.")

    def _data_provider(self):
        """Generator that yields consecutive chunks of the loaded EEG signal."""
        current_pos = 0
        while True:
            yield self.full_eeg_signal[current_pos : current_pos + CHUNK_SIZE]
            current_pos += CHUNK_SIZE
            if current_pos + CHUNK_SIZE > len(self.full_eeg_signal):
                print("🔄 Reached end of data file, looping back to the beginning.")
                current_pos = 0

    def _bandpass_filter(self, data, lowcut=1.0, highcut=40.0, order=4):
        nyq = 0.5 * FS
        low = lowcut / nyq
        high = highcut / nyq
        b, a = butter(order, [low, high], btype='band')
        return filtfilt(b, a, data)

    def _extract_features(self, data):
        """Extracts band power features from a data chunk."""
        filtered = self._bandpass_filter(data)
        freqs, psd = welch(filtered, FS, nperseg=len(data))
        
        bands = {'delta': (0.5, 4), 'theta': (4, 8), 'alpha': (8, 12), 'beta': (12, 30)}
        features = []
        for low, high in bands.values():
            idx = np.logical_and(freqs >= low, freqs <= high)
            band_power = np.mean(psd[idx]) if idx.any() else 0
            features.append(band_power)
            
        return np.array(features)

    def _train_model(self):
        """Generates temporary synthetic data to train a baseline SVM classifier."""
        print("Training baseline model...")
        X_train, y_train = [], []
        for _ in range(150):
            t = np.linspace(0, CHUNK_SIZE/FS, CHUNK_SIZE, endpoint=False)
            # Focused
            alpha_f = 0.3 * np.sin(2 * np.pi * 10 * t)
            beta_f = 0.8 * np.sin(2 * np.pi * 20 * t)
            X_train.append(self._extract_features(alpha_f + beta_f + 0.1 * np.random.randn(CHUNK_SIZE)))
            y_train.append(1)
            # Unfocused
            alpha_u = 0.8 * np.sin(2 * np.pi * 10 * t)
            beta_u = 0.3 * np.sin(2 * np.pi * 20 * t)
            X_train.append(self._extract_features(alpha_u + beta_u + 0.1 * np.random.randn(CHUNK_SIZE)))
            y_train.append(0)

        X_train_scaled = self.scaler.fit_transform(X_train)
        self.clf.fit(X_train_scaled, y_train)
        print("✅ Model trained successfully.")

    def update_and_get_state(self):
        """
        Runs one step of the analysis and returns the current state as a dictionary.
        This is the core logic from the original `update` function.
        """
        new_data = next(self.data_stream)
        
        self.eeg_buffer = np.roll(self.eeg_buffer, -CHUNK_SIZE)
        self.eeg_buffer[-CHUNK_SIZE:] = new_data

        features = self._extract_features(new_data).reshape(1, -1)
        features_scaled = self.scaler.transform(features)
        pred_label = self.clf.predict(features_scaled)[0]
        
        if pred_label == 1:
            current_focus_text = 'FOCUSED'
            current_focus_color = '#10B981' # Green
        else:
            current_focus_text = 'NOT FOCUSED'
            current_focus_color = '#EF4444' # Red

        self.focus_history.append(pred_label)
        self.time_remaining -= 1

        if self.time_remaining <= 0:
            focus_sum = np.sum(self.focus_history)
            verdict = 1 if focus_sum > (len(self.focus_history) / 2) else 0
            confidence = focus_sum / len(self.focus_history) if verdict == 1 else 1 - (focus_sum / len(self.focus_history))
            
            verdict_str = 'Focused' if verdict == 1 else 'Not Focused'
            self.last_focus_verdict = f'{verdict_str} (Confidence: {confidence:.2f})'
            
            self.focus_history = []
            self.time_remaining = FOCUS_WINDOW_CHUNKS
            
        seconds_left = self.time_remaining * CHUNK_SIZE / FS
        timer_text = f'Next verdict in: {seconds_left:.1f} s'
        last_verdict_text = f'Last Verdict: {self.last_focus_verdict}'
        
        progress = (FOCUS_WINDOW_CHUNKS - self.time_remaining) / FOCUS_WINDOW_CHUNKS
        
        return {
            "eeg_buffer": self.eeg_buffer.tolist(),
            "time_axis": np.linspace(0, len(self.eeg_buffer)/FS, len(self.eeg_buffer)).tolist(),
            "current_focus_text": current_focus_text,
            "current_focus_color": current_focus_color,
            "timer_text": timer_text,
            "last_verdict_text": last_verdict_text,
            "progress_percent": progress * 100,
        }

# --- WebSocket Server Logic ---
CONNECTED_CLIENTS = set()
monitor = FocusMonitor(data_filepath=DATA_FILE)

async def handler(websocket):
    """Handles new WebSocket connections."""
    CONNECTED_CLIENTS.add(websocket)
    print(f"Client connected. Total clients: {len(CONNECTED_CLIENTS)}")
    try:
        await websocket.wait_closed()
    finally:
        CONNECTED_CLIENTS.remove(websocket)
        print(f"Client disconnected. Total clients: {len(CONNECTED_CLIENTS)}")

async def broadcast_updates():
    """Continuously runs the monitor and broadcasts state to all clients."""
    while True:
        if CONNECTED_CLIENTS:
            state = monitor.update_and_get_state()
            message = json.dumps(state)
            # Use asyncio.gather for concurrent sending
            await asyncio.gather(
                *(client.send(message) for client in CONNECTED_CLIENTS)
            )
        # Match the interval from the original FuncAnimation
        await asyncio.sleep(0.1) # 100ms interval

async def main():
    """Starts the WebSocket server and the broadcast loop."""
    print("\n--- Starting WebSocket Server ---")
    print("URL: ws://localhost:8765")
    print("Open index.html in a browser to connect.")
    
    server = await websockets.serve(handler, "localhost", 8765)
    await broadcast_updates()
    await server.wait_closed()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except FileNotFoundError as e:
        print(f"\nERROR: {e}")
    except KeyboardInterrupt:
        print("\nServer stopped manually.")
