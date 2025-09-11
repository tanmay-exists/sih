import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from scipy.signal import welch, butter, filtfilt
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
import os

# --- Configuration Constants ---
FS = 500  # Sampling frequency
CHUNK_SIZE = 200  # Number of samples per update
FOCUS_WINDOW_CHUNKS = 1200  # Make a decision every 120 chunks (48 seconds)


class FocusMonitor:
    """
    Encapsulates the EEG processing pipeline, now reading from a pre-generated data file.
    """
    def __init__(self, fig, ax, data_filepath):
        self.fig = fig
        self.ax = ax
        
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
        
        # --- Plotting Elements ---
        self.line, = self.ax.plot(np.linspace(0, len(self.eeg_buffer)/FS, len(self.eeg_buffer)), self.eeg_buffer)
        self.ax.set_ylim(-4, 4)
        self.ax.set_xlabel('Time (s)')
        self.ax.set_ylabel('Amplitude (µV)')
        self.ax.set_title('Real-time EEG Analysis from File')
        
        self.current_focus_text = self.ax.text(0.98, 0.95, '', transform=self.ax.transAxes, fontsize=14, fontweight='bold', ha='right', va='top')
        self.timer_text = self.ax.text(0.02, 0.95, '', transform=self.ax.transAxes, fontsize=12, va='top')
        self.last_verdict_text = self.ax.text(0.02, 0.85, '', transform=self.ax.transAxes, fontsize=12, va='top')
        self.progress_text = self.ax.text(0.02, 0.75, '', transform=self.ax.transAxes, fontsize=12, va='top')

    def _load_data(self, filepath):
        """Loads the long EEG signal from the specified .npz file."""
        print(f"Loading data from '{filepath}'...")
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Data file not found. Please generate '{filepath}' first.")
        
        data = np.load(filepath)
        self.full_eeg_signal = data['signal']
        print("✅ Data loaded successfully.")

    def _data_provider(self):
        """Generator that yields consecutive chunks of the loaded EEG signal."""
        current_pos = 0
        while True:
            # Yield the next chunk
            yield self.full_eeg_signal[current_pos : current_pos + CHUNK_SIZE]
            current_pos += CHUNK_SIZE
            
            # If we reach the end of the signal, loop back to the start
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
        # Generate some quick data for training purposes, similar to the original simulation
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

    def update(self, frame):
        """The main animation loop, now using the data provider."""
        # 1. Get new data from the file stream
        new_data = next(self.data_stream)
        
        # Update the plot buffer
        self.eeg_buffer = np.roll(self.eeg_buffer, -CHUNK_SIZE)
        self.eeg_buffer[-CHUNK_SIZE:] = new_data
        self.line.set_ydata(self.eeg_buffer)

        # 2. Extract features and predict
        features = self._extract_features(new_data).reshape(1, -1)
        features_scaled = self.scaler.transform(features)
        pred_label = self.clf.predict(features_scaled)[0]
        
        # 3. Update immediate focus text
        if pred_label == 1:
            self.current_focus_text.set_text('🟢 FOCUSED')
            self.current_focus_text.set_color('green')
        else:
            self.current_focus_text.set_text('🔴 NOT FOCUSED')
            self.current_focus_text.set_color('red')

        # 4. Manage the verdict window
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
            
        # 5. Update all display texts
        seconds_left = self.time_remaining * CHUNK_SIZE / FS
        self.timer_text.set_text(f'Next verdict in: {seconds_left:.1f} s')
        self.last_verdict_text.set_text(f'Last 4min Verdict: {self.last_focus_verdict}')
        
        progress = (FOCUS_WINDOW_CHUNKS - self.time_remaining) / FOCUS_WINDOW_CHUNKS
        progress_bar = '█' * int(progress * 20) + '-' * (20 - int(progress * 20))
        self.progress_text.set_text(f'Progress: [{progress_bar}]')
        
        return self.line, self.current_focus_text, self.timer_text, self.last_verdict_text, self.progress_text

# --- Main script execution ---
if __name__ == '__main__':
    DATA_FILE = 'simulated_20min_eeg.npz'
    
    fig, ax = plt.subplots(figsize=(12, 6))
    plt.tight_layout(pad=3)
    
    try:
        # Create an instance of our monitor with the data file
        monitor = FocusMonitor(fig, ax, data_filepath=DATA_FILE)
        
        # Run the animation
        ani = FuncAnimation(
            fig, 
            monitor.update, 
            interval=100,  # Animation update interval in ms
            blit=True
        )
        plt.show()
    except FileNotFoundError as e:
        print(f"\nERROR: {e}")
        print("Please run the data generation script first to create the required file.")