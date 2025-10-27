import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from scipy.signal import welch, butter, filtfilt
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler

# Sampling frequency and chunk size
fs = 500
chunk_size = 200
 
# --- Preprocessing: bandpass filter ---
def bandpass_filter(data, lowcut=1.0, highcut=40.0, fs=500, order=4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return filtfilt(b, a, data)
 
# --- Simulated EEG data with label ---
def simulate_eeg(focus=True):
    t = np.linspace(0, chunk_size/fs, chunk_size, endpoint=False)
 
    if focus:
        # More beta power (20 Hz ± jitter), less alpha
        delta = 0.3 * np.sin(2*np.pi*np.random.uniform(1, 3) * t)
        theta = 0.2 * np.sin(2*np.pi*6 * t)
        alpha = 0.2 * np.sin(2*np.pi*np.random.uniform(9, 11) * t)
        beta = 0.8 * np.sin(2*np.pi*np.random.uniform(18, 22) * t)
    else:
        # Less beta, more alpha
        delta = 0.5 * np.sin(2*np.pi*np.random.uniform(1, 3) * t)
        theta = 0.3 * np.sin(2*np.pi*6 * t)
        alpha = 0.6 * np.sin(2*np.pi*np.random.uniform(9, 11) * t)
        beta = 0.3 * np.sin(2*np.pi*np.random.uniform(18, 22) * t)
 
    noise = 0.2 * np.random.randn(chunk_size)
    return delta + theta + alpha + beta + noise
 
# --- Feature extraction ---
def extract_features(data):
    filtered = bandpass_filter(data, fs=fs)
    freqs, psd = welch(filtered, fs, nperseg=chunk_size)
 
    bands = {
        'delta': (0.5, 4),
        'theta': (4, 8),
        'alpha': (8, 12),
        'beta': (12, 30)
    }
 
    features = []
    for low, high in bands.values():
        idx = np.logical_and(freqs >= low, freqs <= high)
        band_vals = psd[idx]
        if band_vals.size == 0:
            features.append(0)  # avoid NaN if no data in band
        else:
            features.append(np.mean(band_vals))
 
    return np.array(features)
 
# --- Generate training data ---
X_train = []
y_train = []
 
for _ in range(100):
    eeg_focused = simulate_eeg(focus=True)
    eeg_unfocused = simulate_eeg(focus=False)
 
    X_train.append(extract_features(eeg_focused))
    y_train.append(1)  # Focused
 
    X_train.append(extract_features(eeg_unfocused))
    y_train.append(0)  # Not focused
 
X_train = np.array(X_train)
y_train = np.array(y_train)
 
# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
 
# Train simple classifier
clf = SVC(kernel='linear', probability=True)
clf.fit(X_train_scaled, y_train)
 
# --- Real-time plotting and prediction ---
fig, ax = plt.subplots(figsize=(10, 5))
xdata = np.linspace(0, 1, fs)
ydata = np.zeros(fs)
 
line, = ax.plot(xdata, ydata)
ax.set_ylim(-5, 5)  # expanded range to avoid clipping
ax.set_xlabel('Time (s)')
ax.set_ylabel('Amplitude (µV)')
ax.set_title('Real-time EEG Signal with Focus Prediction')

focus_text = ax.text(
    0.02, 0.95, '',
    transform=ax.transAxes,
    fontsize=12,
    verticalalignment='top'
)

# Text for displaying the timer
timer_text = ax.text(
    0.02, 0.85, '',
    transform=ax.transAxes,
    fontsize=12,
    verticalalignment='top'
)

# Text for displaying the last verdict
last_verdict_text = ax.text(
    0.02, 0.75, '',
    transform=ax.transAxes,
    fontsize=12,
    verticalalignment='top'
)

# --- Simulated real EEG input ---
def get_real_eeg_data():
    # For demo, alternate focus and no focus every 10 calls
    get_real_eeg_data.counter += 1
    if (get_real_eeg_data.counter // 10) % 2 == 0:
        return simulate_eeg(focus=True)
    else:
        return simulate_eeg(focus=False)

get_real_eeg_data.counter = -1

# --- Variables to track focus over time ---
focus_window = 1200  # 4 minutes (120 chunks)
focus_history = []  # To store predictions over the last 4 minutes
time_remaining = focus_window  # Timer for remaining time in the current 4-minute window
# Initialize the last focus verdict before the update function
last_focus_verdict = "No verdict yet"  # Default value


# --- Update loop ---
def update(frame):
    global ydata, focus_history, time_remaining, last_focus_verdict

    new_data = get_real_eeg_data()

    # Update EEG buffer
    ydata = np.roll(ydata, -chunk_size)
    ydata[-chunk_size:] = new_data
    line.set_ydata(ydata)

    # Feature extraction & scaling
    features = extract_features(new_data).reshape(1, -1)
    features_scaled = scaler.transform(features)

    # Predict focus
    pred_label = clf.predict(features_scaled)[0]
    focus_history.append(pred_label)

    # Update the timer
    time_remaining -= 1

    # Every 4 minutes (120 chunks)
    if len(focus_history) >= focus_window:
        # Get majority decision (0 = not focused, 1 = focused)
        focus_verdict = 1 if np.sum(focus_history) > (focus_window // 2) else 0
        focus_str = 'Focused' if focus_verdict == 1 else 'Not Focused'

        # Confidence based on majority of predictions
        confidence = np.sum(focus_history) / focus_window

        # Update last verdict
        last_focus_verdict = f'{focus_str}\nConfidence: {confidence:.2f}'

        # Reset focus history after decision
        focus_history = []
        time_remaining = focus_window  # Reset timer for the next 4-minute window

    # Update timer and last verdict text
    timer_text.set_text(f'Time Remaining: {time_remaining} chunks ({time_remaining / fs:.2f} s)')
    last_verdict_text.set_text(f'Last Verdict: {last_focus_verdict}')

    return line, focus_text, timer_text, last_verdict_text

# Run animation
ani = FuncAnimation(fig, update, interval=200)
plt.show()
