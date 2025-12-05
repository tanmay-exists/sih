import os
import torch
import torch.nn as nn
import numpy as np
import joblib
from lime import lime_tabular
import matplotlib.pyplot as plt
from scipy import signal
from tqdm import tqdm
import random

# ============================================================
# 1. CONFIGURATION
# ============================================================
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
PREDICTION_BATCH_SIZE = 16 
SAMPLE_RATE = 256
DURATION = 240
NUM_SAMPLES = SAMPLE_RATE * DURATION

# ============================================================
# 2. MODEL ARCHITECTURE
# ============================================================
class OptimizedBetaClassifier(nn.Module):
    def __init__(self, stat_feat_size=15, freq_feat_size=19):
        super(OptimizedBetaClassifier, self).__init__()
        
        # Temporal CNN Path
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
        
        # Attention
        self.attention = nn.Sequential(
            nn.Linear(512, 256), nn.Tanh(),
            nn.Linear(256, 512), nn.Softmax(dim=1)
        )
        
        # Stat Path
        self.stat_fc1 = nn.Linear(stat_feat_size, 128)
        self.stat_bn1 = nn.BatchNorm1d(128)
        self.stat_drop1 = nn.Dropout(0.3)
        self.stat_fc2 = nn.Linear(128, 256)
        self.stat_bn2 = nn.BatchNorm1d(256)
        
        # Freq Path
        self.freq_fc1 = nn.Linear(freq_feat_size, 128)
        self.freq_bn1 = nn.BatchNorm1d(128)
        self.freq_drop1 = nn.Dropout(0.3)
        self.freq_fc2 = nn.Linear(128, 256)
        self.freq_bn2 = nn.BatchNorm1d(256)
        
        # Fusion
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
        
        return self.sigmoid(self.output(combined))

# ============================================================
# 3. FEATURE EXTRACTION HELPERS
# ============================================================
def extract_statistical_features(data):
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

def extract_frequency_features(data, sample_rate=256):
    freqs, psd = signal.welch(data, fs=sample_rate, nperseg=min(256, len(data)))
    bands = {'delta': (0.5, 4), 'theta': (4, 8), 'alpha': (8, 13), 'beta': (13, 30), 'gamma': (30, 50)}
    
    def band_power(freqs, psd, band):
        idx = np.logical_and(freqs >= band[0], freqs <= band[1])
        return np.trapezoid(psd[idx], freqs[idx]) if np.any(idx) else 0
    
    band_powers = {k: band_power(freqs, psd, v) for k, v in bands.items()}
    total_power = sum(band_powers.values()) + 1e-10
    
    features = []
    # Relative (5)
    for b in ['delta', 'theta', 'alpha', 'beta', 'gamma']: features.append(band_powers[b] / total_power)
    # Absolute (5)
    for b in ['delta', 'theta', 'alpha', 'beta', 'gamma']: features.append(np.log10(band_powers[b] + 1e-10))
    # Ratios (4)
    features.append(band_powers['beta'] / (band_powers['alpha'] + 1e-10))
    features.append(band_powers['beta'] / (band_powers['theta'] + 1e-10))
    features.append(band_powers['beta'] / (band_powers['delta'] + 1e-10))
    features.append((band_powers['alpha'] + band_powers['theta']) / (band_powers['delta'] + 1e-10))
    # Spectral (3)
    features.append(np.mean(psd)); features.append(np.std(psd)); features.append(np.max(psd))
    # Dominant (1)
    features.append(freqs[np.argmax(psd)])
    # Entropy (1)
    psd_norm = psd / (np.sum(psd) + 1e-10)
    features.append(-np.sum(psd_norm * np.log2(psd_norm + 1e-10)))
    
    return np.array(features, dtype=np.float32)

def get_background_data(folder_path, num_samples=30):
    """
    Loads real data to teach LIME what 'normal' features look like.
    This fixes the 'Identical Weights' issue.
    """
    print(f"Sampling {num_samples} files from {folder_path} for LIME background...")
    files = [f for f in os.listdir(folder_path) if f.endswith('.csv')]
    
    if len(files) > num_samples:
        files = random.sample(files, num_samples)
        
    background_features = []
    
    for f in tqdm(files, desc="Processing background"):
        try:
            path = os.path.join(folder_path, f)
            d = np.genfromtxt(path, delimiter=',', skip_header=1)
            if d.ndim == 2: d = d[:, 0]
            d = d[:NUM_SAMPLES]
            
            if len(d) < NUM_SAMPLES: # Skip if too short
                continue
                
            s = extract_statistical_features(d)
            fr = extract_frequency_features(d, SAMPLE_RATE)
            background_features.append(np.concatenate([s, fr]))
        except Exception:
            continue
            
    return np.array(background_features)

# ============================================================
# 4. EXPLANATION LOGIC
# ============================================================
def main_explain():
    print("Loading resources...")
    
    try:
        time_scaler = joblib.load('beta_time_scaler.pkl')
        stat_scaler = joblib.load('beta_stat_scaler.pkl')
        freq_scaler = joblib.load('beta_freq_scaler.pkl')
    except FileNotFoundError:
        print("❌ Error: Scaler files (.pkl) not found. Run training first.")
        return

    model = OptimizedBetaClassifier(stat_feat_size=15, freq_feat_size=19).to(DEVICE)
    try:
        model.load_state_dict(torch.load('beta_classifier_best.pth'))
    except FileNotFoundError:
        print("❌ Error: Model file 'beta_classifier_best.pth' not found.")
        return
        
    model.eval()
    print("✓ Model and Scalers loaded.")

    target_folder = "eeg_dataset" 
    if not os.path.exists(target_folder):
        print(f"❌ Dataset folder {target_folder} not found.")
        return

    # --- NEW: LOAD REAL BACKGROUND DATA ---
    # This replaces the np.zeros((1,34)) that caused your issue
    training_data_matrix = get_background_data(target_folder, num_samples=30)
    
    # Pick one file to explain
    files = [f for f in os.listdir(target_folder) if f.endswith('.csv')]
    filename = random.choice(files)
    filepath = os.path.join(target_folder, filename)
    print(f"\nAnalyzing file: {filename}")

    raw_data = np.genfromtxt(filepath, delimiter=',', skip_header=1)
    if raw_data.ndim == 2: raw_data = raw_data[:, 0]
    raw_data = raw_data[:NUM_SAMPLES]
    
    base_stat = extract_statistical_features(raw_data)
    base_freq = extract_frequency_features(raw_data, SAMPLE_RATE)
    feature_vector = np.concatenate([base_stat, base_freq])
    
    feature_names = [
        'Mean', 'Std', 'Median', '25th', '75th', 'Range', 'MeanAbs', 'Skew', 'Kurt', 
        'DiffMean', 'DiffStd', 'DiffMax', 'AccMean', 'AccStd', 'ZeroCross', 
        'Delta_Rel', 'Theta_Rel', 'Alpha_Rel', 'Beta_Rel', 'Gamma_Rel', 
        'Delta_Abs', 'Theta_Abs', 'Alpha_Abs', 'Beta_Abs', 'Gamma_Abs', 
        'Beta/Alpha', 'Beta/Theta', 'Beta/Delta', '(Alpha+Theta)/Delta', 
        'MeanPwr', 'StdPwr', 'PeakPwr', 'DomFreq', 'SpecEnt' 
    ]

    def batched_predict_wrapper(perturbed_features_matrix):
        num_inputs = perturbed_features_matrix.shape[0]
        all_probabilities = []
        
        raw_reshaped = raw_data.reshape(1, -1)
        raw_scaled = time_scaler.transform(raw_reshaped)
        raw_scaled_reshaped = raw_scaled.reshape(1, 1, -1)
        t_time_base = torch.from_numpy(raw_scaled_reshaped).float().to(DEVICE)
        
        for i in range(0, num_inputs, PREDICTION_BATCH_SIZE):
            batch_features = perturbed_features_matrix[i : i + PREDICTION_BATCH_SIZE]
            current_batch_size = batch_features.shape[0]
            
            p_stat = batch_features[:, :15]
            p_freq = batch_features[:, 15:]
            
            p_stat_scaled = stat_scaler.transform(p_stat)
            p_freq_scaled = freq_scaler.transform(p_freq)
            
            t_stat = torch.from_numpy(p_stat_scaled).float().to(DEVICE)
            t_freq = torch.from_numpy(p_freq_scaled).float().to(DEVICE)
            
            t_time_batch = t_time_base.repeat(current_batch_size, 1, 1)
            
            with torch.no_grad():
                logits = model(t_time_batch, t_stat, t_freq)
                probs_1 = logits.cpu().numpy().flatten()
                probs_0 = 1.0 - probs_1
                
                batch_probs = np.vstack((probs_0, probs_1)).T
                all_probabilities.append(batch_probs)
                
        return np.vstack(all_probabilities)

    print("Generating explanations...")
    
    # --- FIXED EXPLAINER ---
    # Now passing real data so LIME knows the distribution
    explainer = lime_tabular.LimeTabularExplainer(
        training_data=training_data_matrix,  # <--- THIS IS THE FIX
        mode='classification',
        feature_names=feature_names,
        class_names=['Beta', 'Non-Beta'],
        discretize_continuous=True 
    )

    exp = explainer.explain_instance(
        data_row=feature_vector,
        predict_fn=batched_predict_wrapper,
        num_features=10,
        num_samples=1000 
    )

    print("\n" + "="*40)
    print("TOP FACTORS DRIVING THE PREDICTION")
    print("="*40)
    
    prediction = batched_predict_wrapper(feature_vector.reshape(1, -1))[0]
    print(f"Model Prediction: Beta={prediction[0]:.2f}, Non-Beta={prediction[1]:.2f}")
    
    for i, (feature_idx, weight) in enumerate(exp.as_list()):
        print(f"{i+1}. {feature_idx}: {weight:.4f}")
        
    fig = exp.as_pyplot_figure()
    plt.tight_layout()
    plt.savefig('lime_feature_explanation.png', dpi=150, bbox_inches='tight')
    print("\n✓ Explanation saved as 'lime_feature_explanation.png'")

if __name__ == "__main__":
    main_explain()