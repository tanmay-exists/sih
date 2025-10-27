import numpy as np
import torch
import torch.nn as nn
import joblib
from scipy import signal
import argparse
import os
import sys
import json

# Configuration
SAMPLE_RATE = 256
DURATION = 240
NUM_SAMPLES = SAMPLE_RATE * DURATION
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

CLASS_LABELS = {
    0: 'FOCUSED',
    1: 'NOT FOCUSED'
}

# ============================================================
# FEATURE EXTRACTION (MUST MATCH TRAINING)
# ============================================================
def extract_statistical_features(data):
    """Extract comprehensive statistical features"""
    features = []
    
    features.append(np.mean(data))
    features.append(np.std(data))
    features.append(np.median(data))
    features.append(np.percentile(data, 25))
    features.append(np.percentile(data, 75))
    features.append(np.max(data) - np.min(data))
    features.append(np.mean(np.abs(data)))
    
    features.append(np.mean((data - np.mean(data))**3))
    features.append(np.mean((data - np.mean(data))**4))
    
    diff1 = np.diff(data)
    features.append(np.mean(np.abs(diff1)))
    features.append(np.std(diff1))
    features.append(np.max(np.abs(diff1)))
    
    diff2 = np.diff(diff1)
    features.append(np.mean(np.abs(diff2)))
    features.append(np.std(diff2))
    
    zero_crossings = np.sum(np.diff(np.signbit(data - np.mean(data))))
    features.append(zero_crossings / len(data))
    
    return np.array(features, dtype=np.float32)

def extract_frequency_features(data, sample_rate=256, num_features=19):
    """Extract frequency domain features - adjustable to match model"""
    freqs, psd = signal.welch(data, fs=sample_rate, nperseg=min(256, len(data)))
    
    bands = {
        'delta': (0.5, 4),
        'theta': (4, 8),
        'alpha': (8, 13),
        'beta': (13, 30),
        'gamma': (30, 50)
    }
    
    def band_power(freqs, psd, band):
        idx = np.logical_and(freqs >= band[0], freqs <= band[1])
        return np.trapezoid(psd[idx], freqs[idx]) if np.any(idx) else 0
    
    band_powers = {}
    for band_name, band_range in bands.items():
        band_powers[band_name] = band_power(freqs, psd, band_range)
    
    total_power = sum(band_powers.values()) + 1e-10
    
    # Build features based on required count
    features = []
    
    # Always include: Relative powers (5)
    for band_name in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
        features.append(band_powers[band_name] / total_power)
    
    # Always include: Absolute powers log scale (5)
    for band_name in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
        features.append(np.log10(band_powers[band_name] + 1e-10))
    
    # Always include: Band ratios (4)
    features.append(band_powers['beta'] / (band_powers['alpha'] + 1e-10))
    features.append(band_powers['beta'] / (band_powers['theta'] + 1e-10))
    features.append(band_powers['beta'] / (band_powers['delta'] + 1e-10))
    features.append((band_powers['alpha'] + band_powers['theta']) / (band_powers['delta'] + 1e-10))
    
    # Always include: Spectral stats (3)
    features.append(np.mean(psd))
    features.append(np.std(psd))
    features.append(np.max(psd))
    
    # Always include: Dominant frequency (1)
    dominant_freq = freqs[np.argmax(psd)]
    features.append(dominant_freq)
    
    # Always include: Spectral entropy (1)
    psd_norm = psd / (np.sum(psd) + 1e-10)
    spectral_entropy = -np.sum(psd_norm * np.log2(psd_norm + 1e-10))
    features.append(spectral_entropy)
    
    # Total so far: 19 features
    
    # If model expects 24 features, add 5 more
    if num_features >= 20:
        # Additional features
        features.append(np.median(psd))  # Median power
        features.append(np.percentile(psd, 25))  # 25th percentile
        features.append(np.percentile(psd, 75))  # 75th percentile
        features.append(freqs[np.argmax(psd[:len(psd)//2])])  # Low freq dominant
        features.append(np.sum(psd > np.mean(psd)) / len(psd))  # Peak ratio
    
    return np.array(features[:num_features], dtype=np.float32), band_powers, total_power


def detect_model_feature_sizes(model_path):
    """Detect the feature sizes from saved model"""
    checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
    
    # Find the stat and freq feature sizes from the weights
    stat_size = checkpoint['stat_fc1.weight'].shape[1]
    freq_size = checkpoint['freq_fc1.weight'].shape[1]
    
    return stat_size, freq_size

# ============================================================
# MODEL ARCHITECTURE (MUST MATCH TRAINING)
# ============================================================
class OptimizedBetaClassifier(nn.Module):
    def __init__(self, stat_feat_size=15, freq_feat_size=24):
        super(OptimizedBetaClassifier, self).__init__()
        
        self.conv1 = nn.Conv1d(1, 128, kernel_size=7, padding=3)
        self.bn1 = nn.BatchNorm1d(128)
        self.pool1 = nn.MaxPool1d(4)
        self.drop1 = nn.Dropout(0.3)
        
        self.conv2 = nn.Conv1d(128, 256, kernel_size=5, padding=2)
        self.bn2 = nn.BatchNorm1d(256)
        self.pool2 = nn.MaxPool1d(4)
        self.drop2 = nn.Dropout(0.35)
        
        self.conv3 = nn.Conv1d(256, 512, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(512)
        self.pool3 = nn.MaxPool1d(4)
        self.drop3 = nn.Dropout(0.4)
        
        self.attention = nn.Sequential(
            nn.Linear(512, 256),
            nn.Tanh(),
            nn.Linear(256, 512),
            nn.Softmax(dim=1)
        )
        
        self.stat_fc1 = nn.Linear(stat_feat_size, 128)
        self.stat_bn1 = nn.BatchNorm1d(128)
        self.stat_drop1 = nn.Dropout(0.3)
        self.stat_fc2 = nn.Linear(128, 256)
        self.stat_bn2 = nn.BatchNorm1d(256)
        
        self.freq_fc1 = nn.Linear(freq_feat_size, 128)
        self.freq_bn1 = nn.BatchNorm1d(128)
        self.freq_drop1 = nn.Dropout(0.3)
        self.freq_fc2 = nn.Linear(128, 256)
        self.freq_bn2 = nn.BatchNorm1d(256)
        
        self.fusion_fc1 = nn.Linear(512 + 256 + 256, 512)
        self.fusion_bn1 = nn.BatchNorm1d(512)
        self.fusion_drop1 = nn.Dropout(0.5)
        
        self.fusion_fc2 = nn.Linear(512, 256)
        self.fusion_bn2 = nn.BatchNorm1d(256)
        self.fusion_drop2 = nn.Dropout(0.4)
        
        self.fusion_fc3 = nn.Linear(256, 128)
        self.fusion_bn3 = nn.BatchNorm1d(128)
        self.fusion_drop3 = nn.Dropout(0.3)
        
        self.output = nn.Linear(128, 1)
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, x_time, x_stat, x_freq):
        x = torch.relu(self.bn1(self.conv1(x_time)))
        x = self.drop1(self.pool1(x))
        
        x = torch.relu(self.bn2(self.conv2(x)))
        x = self.drop2(self.pool2(x))
        
        x = torch.relu(self.bn3(self.conv3(x)))
        x = self.drop3(self.pool3(x))
        
        x = torch.mean(x, dim=2)
        
        attention_weights = self.attention(x)
        x = x * attention_weights
        
        stat = torch.relu(self.stat_bn1(self.stat_fc1(x_stat)))
        stat = self.stat_drop1(stat)
        stat = torch.relu(self.stat_bn2(self.stat_fc2(stat)))
        
        freq = torch.relu(self.freq_bn1(self.freq_fc1(x_freq)))
        freq = self.freq_drop1(freq)
        freq = torch.relu(self.freq_bn2(self.freq_fc2(freq)))
        
        combined = torch.cat([x, stat, freq], dim=1)
        
        combined = torch.relu(self.fusion_bn1(self.fusion_fc1(combined)))
        combined = self.fusion_drop1(combined)
        
        combined = torch.relu(self.fusion_bn2(self.fusion_fc2(combined)))
        combined = self.fusion_drop2(combined)
        
        combined = torch.relu(self.fusion_bn3(self.fusion_fc3(combined)))
        combined = self.fusion_drop3(combined)
        
        out = self.sigmoid(self.output(combined))
        
        return out

# ============================================================
# PREDICTION - FIXED LOGIC
# ============================================================
def load_and_preprocess_file(filepath, time_scaler, stat_scaler, freq_scaler, freq_feat_size):
    """Load and preprocess a single file - SILENT MODE"""
    # Load data
    try:
        data = np.genfromtxt(filepath, delimiter=',', skip_header=1)
    except:
        data = np.genfromtxt(filepath, delimiter=',')
    
    # Handle multi-column
    if data.ndim == 2:
        if data.shape[1] == 2 and np.allclose(data[:, 0], data[:, 1]):
            data = data[:, 0]
        else:
            data = data[:, 0]
    
    # Clean data
    data = data[~np.isnan(data)]
    
    # Pad or truncate
    if len(data) >= NUM_SAMPLES:
        data = data[:NUM_SAMPLES]
    else:
        data = np.pad(data, (0, NUM_SAMPLES - len(data)))
    
    # Extract features
    stat_features = extract_statistical_features(data)
    freq_features, band_powers, total_power = extract_frequency_features(data, SAMPLE_RATE, freq_feat_size)
    
    # Scale features
    data_scaled = time_scaler.transform(data.reshape(1, -1))
    data_tensor = torch.FloatTensor(data_scaled.reshape(1, 1, -1)).to(DEVICE)
    
    stat_scaled = stat_scaler.transform(stat_features.reshape(1, -1))
    stat_tensor = torch.FloatTensor(stat_scaled).to(DEVICE)
    
    freq_scaled = freq_scaler.transform(freq_features.reshape(1, -1))
    freq_tensor = torch.FloatTensor(freq_scaled).to(DEVICE)
    
    return data_tensor, stat_tensor, freq_tensor, band_powers, total_power

def predict(model, data_tensor, stat_tensor, freq_tensor):
    """Make prediction - FIXED LOGIC"""
    model.eval()
    with torch.no_grad():
        output = model(data_tensor, stat_tensor, freq_tensor)
        prob = output.item()
        
        # CRITICAL FIX: The model outputs probability for class 1 (NOT FOCUSED)
        # If prob < 0.5, it means model is more confident in class 0 (FOCUSED)
        # If prob > 0.5, it means model is more confident in class 1 (NOT FOCUSED)
        
        if prob < 0.5:
            # Lower probability = Class 0 = FOCUSED (Beta dominant)
            predicted_class = 0
            confidence = 1 - prob  # Confidence in FOCUSED
        else:
            # Higher probability = Class 1 = NOT FOCUSED (Non-Beta)
            predicted_class = 1
            confidence = prob  # Confidence in NOT FOCUSED
    
    return predicted_class, confidence, prob

def main():
    parser = argparse.ArgumentParser(description="Test Beta vs Non-Beta EEG Classifier")
    parser.add_argument("filepath", type=str, help="Path to EEG CSV file")
    args = parser.parse_args()
    
    # Check files exist
    required_files = {
        'Model': 'beta_classifier_best.pth',
        'Time Scaler': 'beta_time_scaler.pkl',
        'Stat Scaler': 'beta_stat_scaler.pkl',
        'Freq Scaler': 'beta_freq_scaler.pkl',
        'Input File': args.filepath
    }
    
    for name, path in required_files.items():
        if not os.path.exists(path):
            error_result = {
                "status": "error",
                "message": f"{name} not found at '{path}'"
            }
            print(json.dumps(error_result))
            sys.exit(1)
    
    try:
        # Detect feature sizes from model (SILENT)
        stat_feat_size, freq_feat_size = detect_model_feature_sizes('beta_classifier_best.pth')
        
        # Load model and scalers (SILENT)
        time_scaler = joblib.load('beta_time_scaler.pkl')
        stat_scaler = joblib.load('beta_stat_scaler.pkl')
        freq_scaler = joblib.load('beta_freq_scaler.pkl')
        
        model = OptimizedBetaClassifier(stat_feat_size=stat_feat_size, freq_feat_size=freq_feat_size).to(DEVICE)
        model.load_state_dict(torch.load('beta_classifier_best.pth', map_location=DEVICE, weights_only=False))
        model.eval()
        
        # Load and process file (SILENT)
        data_tensor, stat_tensor, freq_tensor, band_powers, total_power = load_and_preprocess_file(
            args.filepath, time_scaler, stat_scaler, freq_scaler, freq_feat_size
        )
        
        # Predict (SILENT)
        predicted_class, confidence, raw_prob = predict(model, data_tensor, stat_tensor, freq_tensor)
        
        # Calculate beta percentage
        beta_percentage = (band_powers['beta'] / total_power) * 100
        
        # Create JSON output
        result = {
            "status": "success",
            "focus_state": CLASS_LABELS[predicted_class],
            "confidence": f"{confidence * 100:.1f}%",
            "beta_activity": f"{beta_percentage:.1f}%",
            "raw_probability": float(raw_prob),
            "predicted_class": int(predicted_class)
        }
        
        # Output JSON to stdout
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "status": "error",
            "message": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
