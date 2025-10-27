import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler, RobustScaler
import matplotlib.pyplot as plt
from tqdm import tqdm
import joblib
from scipy import signal
from collections import Counter
import warnings
warnings.filterwarnings('ignore')

# ============================================================
# CONFIGURATION - OPTIMIZED FOR BEST ACCURACY
# ============================================================
EEG_DATASET_PATH = "eeg_dataset"  # Class 0: Beta
ARTIFACTS_DATASET_PATH = "artifacts_dataset"  # Class 1: Non-Beta
SAMPLE_RATE = 256
DURATION = 240
NUM_SAMPLES = SAMPLE_RATE * DURATION
BATCH_SIZE = 8  # Smaller batch for better gradient updates
EPOCHS = 150
LEARNING_RATE = 0.0003
L2_REGULARIZATION = 0.00005
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Use K-Fold Cross Validation for best model selection
USE_KFOLD = True
N_FOLDS = 5

print("="*80)
print("OPTIMIZED BETA vs NON-BETA EEG CLASSIFIER TRAINING")
print("="*80)
print(f"Device: {DEVICE}")
print(f"Batch Size: {BATCH_SIZE}")
print(f"Learning Rate: {LEARNING_RATE}")
print(f"Epochs: {EPOCHS}")
print(f"K-Fold CV: {USE_KFOLD} (Folds: {N_FOLDS if USE_KFOLD else 'N/A'})")
print("="*80)

# ============================================================
# ADVANCED FEATURE EXTRACTION
# ============================================================
def extract_statistical_features(data):
    """Extract comprehensive statistical features"""
    features = []
    
    # Basic statistics
    features.append(np.mean(data))
    features.append(np.std(data))
    features.append(np.median(data))
    features.append(np.percentile(data, 25))
    features.append(np.percentile(data, 75))
    features.append(np.max(data) - np.min(data))  # Range
    features.append(np.mean(np.abs(data)))  # Mean absolute value
    
    # Higher order moments
    features.append(np.mean((data - np.mean(data))**3))  # Skewness indicator
    features.append(np.mean((data - np.mean(data))**4))  # Kurtosis indicator
    
    # Derivative features (rate of change)
    diff1 = np.diff(data)
    features.append(np.mean(np.abs(diff1)))  # Average change
    features.append(np.std(diff1))  # Variability of change
    features.append(np.max(np.abs(diff1)))  # Maximum change
    
    # Second derivative (acceleration)
    diff2 = np.diff(diff1)
    features.append(np.mean(np.abs(diff2)))
    features.append(np.std(diff2))
    
    # Zero crossing rate
    zero_crossings = np.sum(np.diff(np.signbit(data - np.mean(data))))
    features.append(zero_crossings / len(data))
    
    return np.array(features, dtype=np.float32)

def extract_frequency_features(data, sample_rate=256):
    """Extract detailed frequency domain features"""
    # Compute power spectral density - use nperseg=256 for consistency
    freqs, psd = signal.welch(data, fs=sample_rate, nperseg=min(256, len(data)))
    
    # Define frequency bands
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
    
    # Calculate band powers
    band_powers = {}
    for band_name, band_range in bands.items():
        band_powers[band_name] = band_power(freqs, psd, band_range)
    
    total_power = sum(band_powers.values()) + 1e-10
    
    # Relative powers (5 features)
    features = []
    for band_name in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
        features.append(band_powers[band_name] / total_power)
    
    # Absolute powers (log scale) (5 features)
    for band_name in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
        features.append(np.log10(band_powers[band_name] + 1e-10))
    
    # Band ratios (important for classification) (4 features)
    features.append(band_powers['beta'] / (band_powers['alpha'] + 1e-10))  # Beta/Alpha
    features.append(band_powers['beta'] / (band_powers['theta'] + 1e-10))  # Beta/Theta
    features.append(band_powers['beta'] / (band_powers['delta'] + 1e-10))  # Beta/Delta
    features.append((band_powers['alpha'] + band_powers['theta']) / (band_powers['delta'] + 1e-10))
    
    # Spectral features (3 features)
    features.append(np.mean(psd))  # Mean power
    features.append(np.std(psd))  # Power variability
    features.append(np.max(psd))  # Peak power
    
    # Dominant frequency (1 feature)
    dominant_freq = freqs[np.argmax(psd)]
    features.append(dominant_freq)
    
    # Spectral entropy (1 feature)
    psd_norm = psd / (np.sum(psd) + 1e-10)
    spectral_entropy = -np.sum(psd_norm * np.log2(psd_norm + 1e-10))
    features.append(spectral_entropy)
    
    # Total: 5 + 5 + 4 + 3 + 1 + 1 = 19 features
    
    return np.array(features, dtype=np.float32)

# ============================================================
# DATASET CLASS
# ============================================================
class EnhancedEEGDataset(Dataset):
    """Enhanced dataset with multiple feature types"""
    def __init__(self, X_time, X_stat, X_freq, y):
        self.X_time = torch.from_numpy(X_time).float()
        self.X_stat = torch.from_numpy(X_stat).float()
        self.X_freq = torch.from_numpy(X_freq).float()
        self.y = torch.from_numpy(y).float()
    
    def __len__(self):
        return len(self.X_time)
    
    def __getitem__(self, idx):
        return self.X_time[idx], self.X_stat[idx], self.X_freq[idx], self.y[idx]

# ============================================================
# DATA LOADER
# ============================================================
class BetaEEGDataLoader:
    def __init__(self, eeg_path, artifact_path, sample_rate=256, duration=240):
        self.eeg_path = eeg_path
        self.artifact_path = artifact_path
        self.sample_rate = sample_rate
        self.duration = duration
        self.num_samples = sample_rate * duration
        
    def load_data(self):
        """Load all data with progress tracking"""
        X_raw, y = [], []
        
        # Load Class 0: Beta EEG
        print("\nLoading Class 0: Beta-dominant EEG...")
        eeg_files = sorted([f for f in os.listdir(self.eeg_path) if f.endswith('.csv')])
        
        for file in tqdm(eeg_files, desc="Loading Beta"):
            try:
                file_path = os.path.join(self.eeg_path, file)
                data = np.genfromtxt(file_path, delimiter=',', skip_header=1)
                
                # Take first column if multiple
                if data.ndim == 2:
                    data = data[:, 0]
                
                data = data[~np.isnan(data)]
                
                if len(data) >= self.num_samples:
                    data = data[:self.num_samples]
                else:
                    data = np.pad(data, (0, self.num_samples - len(data)))
                
                X_raw.append(data)
                y.append(0)  # Beta class
                
            except Exception as e:
                print(f"  Error loading {file}: {e}")
        
        # Load Class 1: Non-Beta
        print("\nLoading Class 1: Non-Beta EEG & Artifacts...")
        artifact_files = sorted([f for f in os.listdir(self.artifact_path) if f.endswith('.csv')])
        
        for file in tqdm(artifact_files, desc="Loading Non-Beta"):
            try:
                file_path = os.path.join(self.artifact_path, file)
                data = np.genfromtxt(file_path, delimiter=',', skip_header=1)
                
                if data.ndim == 2:
                    data = data[:, 0]
                
                data = data[~np.isnan(data)]
                
                if len(data) >= self.num_samples:
                    data = data[:self.num_samples]
                else:
                    data = np.pad(data, (0, self.num_samples - len(data)))
                
                X_raw.append(data)
                y.append(1)  # Non-Beta class
                
            except Exception as e:
                print(f"  Error loading {file}: {e}")
        
        X_raw = np.array(X_raw)
        y = np.array(y)
        
        print(f"\nData loaded:")
        print(f"  Total samples: {len(X_raw)}")
        print(f"  Class 0 (Beta): {np.sum(y==0)}")
        print(f"  Class 1 (Non-Beta): {np.sum(y==1)}")
        print(f"  Class balance: {np.sum(y==0)/len(y)*100:.1f}% / {np.sum(y==1)/len(y)*100:.1f}%")
        
        return X_raw, y
    
    def extract_all_features(self, X_raw):
        """Extract all feature types"""
        print("\nExtracting features...")
        
        X_stat = []
        X_freq = []
        
        for data in tqdm(X_raw, desc="Feature extraction"):
            # Statistical features
            stat_feat = extract_statistical_features(data)
            X_stat.append(stat_feat)
            
            # Frequency features
            freq_feat = extract_frequency_features(data, self.sample_rate)
            X_freq.append(freq_feat)
        
        X_stat = np.array(X_stat)
        X_freq = np.array(X_freq)
        
        print(f"  Statistical features shape: {X_stat.shape}")
        print(f"  Frequency features shape: {X_freq.shape}")
        
        return X_stat, X_freq
    
    def preprocess_data(self, X_raw, X_stat, X_freq):
        """Normalize all features"""
        print("\nNormalizing features...")
        
        # Time series - RobustScaler is better for outliers
        time_scaler = RobustScaler()
        X_time_scaled = time_scaler.fit_transform(X_raw)
        X_time_reshaped = X_time_scaled.reshape(X_time_scaled.shape[0], 1, X_time_scaled.shape[1])
        
        # Statistical features
        stat_scaler = StandardScaler()
        X_stat_scaled = stat_scaler.fit_transform(X_stat)
        
        # Frequency features
        freq_scaler = StandardScaler()
        X_freq_scaled = freq_scaler.fit_transform(X_freq)
        
        return X_time_reshaped, X_stat_scaled, X_freq_scaled, time_scaler, stat_scaler, freq_scaler

# ============================================================
# OPTIMIZED MODEL ARCHITECTURE
# ============================================================
class OptimizedBetaClassifier(nn.Module):
    """Multi-path CNN with attention mechanism for best accuracy"""
    def __init__(self, stat_feat_size=15, freq_feat_size=24):
        super(OptimizedBetaClassifier, self).__init__()
        
        # Temporal CNN Path (1D CNN for time series)
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
        
        # Attention mechanism for temporal features
        self.attention = nn.Sequential(
            nn.Linear(512, 256),
            nn.Tanh(),
            nn.Linear(256, 512),
            nn.Softmax(dim=1)
        )
        
        # Statistical feature path
        self.stat_fc1 = nn.Linear(stat_feat_size, 128)
        self.stat_bn1 = nn.BatchNorm1d(128)
        self.stat_drop1 = nn.Dropout(0.3)
        self.stat_fc2 = nn.Linear(128, 256)
        self.stat_bn2 = nn.BatchNorm1d(256)
        
        # Frequency feature path
        self.freq_fc1 = nn.Linear(freq_feat_size, 128)
        self.freq_bn1 = nn.BatchNorm1d(128)
        self.freq_drop1 = nn.Dropout(0.3)
        self.freq_fc2 = nn.Linear(128, 256)
        self.freq_bn2 = nn.BatchNorm1d(256)
        
        # Fusion layer
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
        # Temporal CNN path
        x = torch.relu(self.bn1(self.conv1(x_time)))
        x = self.drop1(self.pool1(x))
        
        x = torch.relu(self.bn2(self.conv2(x)))
        x = self.drop2(self.pool2(x))
        
        x = torch.relu(self.bn3(self.conv3(x)))
        x = self.drop3(self.pool3(x))
        
        # Global average pooling
        x = torch.mean(x, dim=2)
        
        # Apply attention
        attention_weights = self.attention(x)
        x = x * attention_weights
        
        # Statistical path
        stat = torch.relu(self.stat_bn1(self.stat_fc1(x_stat)))
        stat = self.stat_drop1(stat)
        stat = torch.relu(self.stat_bn2(self.stat_fc2(stat)))
        
        # Frequency path
        freq = torch.relu(self.freq_bn1(self.freq_fc1(x_freq)))
        freq = self.freq_drop1(freq)
        freq = torch.relu(self.freq_bn2(self.freq_fc2(freq)))
        
        # Fusion
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
# FOCAL LOSS FOR BETTER CLASSIFICATION
# ============================================================
class FocalLoss(nn.Module):
    def __init__(self, alpha=0.25, gamma=2.0):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma
    
    def forward(self, inputs, targets):
        bce_loss = nn.functional.binary_cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-bce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * bce_loss
        return focal_loss.mean()

# ============================================================
# TRAINING & VALIDATION
# ============================================================
class EarlyStopping:
    def __init__(self, patience=20, min_delta=0.0001):
        self.patience = patience
        self.min_delta = min_delta
        self.counter = 0
        self.best_loss = None
        self.early_stop = False
        self.best_accuracy = 0
    
    def __call__(self, val_loss, val_accuracy):
        if self.best_loss is None:
            self.best_loss = val_loss
            self.best_accuracy = val_accuracy
        elif val_loss > self.best_loss - self.min_delta:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
        else:
            self.best_loss = val_loss
            self.best_accuracy = val_accuracy
            self.counter = 0

def train_epoch(model, train_loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    for x_time, x_stat, x_freq, labels in tqdm(train_loader, desc="Training", leave=False):
        x_time = x_time.to(device)
        x_stat = x_stat.to(device)
        x_freq = x_freq.to(device)
        labels = labels.to(device).unsqueeze(1)
        
        optimizer.zero_grad()
        outputs = model(x_time, x_stat, x_freq)
        loss = criterion(outputs, labels)
        loss.backward()
        
        # Gradient clipping
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        
        optimizer.step()
        
        total_loss += loss.item()
        predictions = (outputs > 0.5).float()
        correct += (predictions == labels).sum().item()
        total += labels.size(0)
    
    return total_loss / len(train_loader), correct / total

def validate(model, val_loader, criterion, device):
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    tp = fp = tn = fn = 0
    
    with torch.no_grad():
        for x_time, x_stat, x_freq, labels in tqdm(val_loader, desc="Validating", leave=False):
            x_time = x_time.to(device)
            x_stat = x_stat.to(device)
            x_freq = x_freq.to(device)
            labels = labels.to(device).unsqueeze(1)
            
            outputs = model(x_time, x_stat, x_freq)
            loss = criterion(outputs, labels)
            
            total_loss += loss.item()
            predictions = (outputs > 0.5).float()
            correct += (predictions == labels).sum().item()
            total += labels.size(0)
            
            tp += ((predictions == 1) & (labels == 1)).sum().item()
            fp += ((predictions == 1) & (labels == 0)).sum().item()
            tn += ((predictions == 0) & (labels == 0)).sum().item()
            fn += ((predictions == 0) & (labels == 1)).sum().item()
    
    accuracy = correct / total
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    
    return total_loss / len(val_loader), accuracy, precision, recall, f1, tp, fp, tn, fn

# ============================================================
# PLOTTING
# ============================================================
def plot_training_history(history, fold=None):
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    
    fold_str = f" (Fold {fold})" if fold is not None else ""
    
    # Loss
    axes[0, 0].plot(history['train_loss'], label='Train', linewidth=2)
    axes[0, 0].plot(history['val_loss'], label='Validation', linewidth=2)
    axes[0, 0].set_title(f'Model Loss{fold_str}', fontweight='bold')
    axes[0, 0].set_xlabel('Epoch')
    axes[0, 0].set_ylabel('Loss')
    axes[0, 0].legend()
    axes[0, 0].grid(alpha=0.3)
    
    # Accuracy
    axes[0, 1].plot(history['train_acc'], label='Train', linewidth=2)
    axes[0, 1].plot(history['val_acc'], label='Validation', linewidth=2)
    axes[0, 1].set_title(f'Model Accuracy{fold_str}', fontweight='bold')
    axes[0, 1].set_xlabel('Epoch')
    axes[0, 1].set_ylabel('Accuracy')
    axes[0, 1].legend()
    axes[0, 1].grid(alpha=0.3)
    
    # F1 Score
    axes[1, 0].plot(history['val_f1'], label='Validation F1', linewidth=2, color='green')
    axes[1, 0].set_title(f'F1 Score{fold_str}', fontweight='bold')
    axes[1, 0].set_xlabel('Epoch')
    axes[1, 0].set_ylabel('F1 Score')
    axes[1, 0].legend()
    axes[1, 0].grid(alpha=0.3)
    
    # Precision & Recall
    axes[1, 1].plot(history['val_precision'], label='Precision', linewidth=2, color='blue')
    axes[1, 1].plot(history['val_recall'], label='Recall', linewidth=2, color='orange')
    axes[1, 1].set_title(f'Precision & Recall{fold_str}', fontweight='bold')
    axes[1, 1].set_xlabel('Epoch')
    axes[1, 1].set_ylabel('Score')
    axes[1, 1].legend()
    axes[1, 1].grid(alpha=0.3)
    
    plt.tight_layout()
    filename = f'beta_training_history_fold{fold}.png' if fold is not None else 'beta_training_history.png'
    plt.savefig(filename, dpi=150)
    print(f"✓ Training history saved as '{filename}'")
    plt.close()

# ============================================================
# MAIN TRAINING
# ============================================================
def main():
    print("\n" + "="*80)
    print("LOADING DATA")
    print("="*80)
    
    loader = BetaEEGDataLoader(EEG_DATASET_PATH, ARTIFACTS_DATASET_PATH)
    X_raw, y = loader.load_data()
    
    # Extract features
    X_stat, X_freq = loader.extract_all_features(X_raw)
    
    # Preprocess
    X_time, X_stat_scaled, X_freq_scaled, time_scaler, stat_scaler, freq_scaler = loader.preprocess_data(
        X_raw, X_stat, X_freq
    )
    
    # Save scalers
    joblib.dump(time_scaler, 'beta_time_scaler.pkl')
    joblib.dump(stat_scaler, 'beta_stat_scaler.pkl')
    joblib.dump(freq_scaler, 'beta_freq_scaler.pkl')
    print("\n✓ Scalers saved")
    
    if USE_KFOLD:
        # K-Fold Cross Validation
        print("\n" + "="*80)
        print(f"K-FOLD CROSS VALIDATION ({N_FOLDS} FOLDS)")
        print("="*80)
        
        kfold = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=42)
        fold_results = []
        best_model_accuracy = 0
        best_fold = 0
        
        for fold, (train_idx, val_idx) in enumerate(kfold.split(X_time, y)):
            print(f"\n{'='*80}")
            print(f"FOLD {fold + 1}/{N_FOLDS}")
            print(f"{'='*80}")
            
            # Split data
            X_time_train, X_time_val = X_time[train_idx], X_time[val_idx]
            X_stat_train, X_stat_val = X_stat_scaled[train_idx], X_stat_scaled[val_idx]
            X_freq_train, X_freq_val = X_freq_scaled[train_idx], X_freq_scaled[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]
            
            # Create datasets
            train_dataset = EnhancedEEGDataset(X_time_train, X_stat_train, X_freq_train, y_train)
            val_dataset = EnhancedEEGDataset(X_time_val, X_stat_val, X_freq_val, y_val)
            
            # Weighted sampling
            class_counts = Counter(y_train)
            class_weights = {0: 1.0/class_counts[0], 1: 1.0/class_counts[1]}
            sample_weights = [class_weights[int(label)] for label in y_train]
            sampler = WeightedRandomSampler(sample_weights, len(sample_weights))
            
            train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, sampler=sampler)
            val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
            
            # Initialize model
            model = OptimizedBetaClassifier(
                stat_feat_size=X_stat_scaled.shape[1],
                freq_feat_size=X_freq_scaled.shape[1]
            ).to(DEVICE)
            
            criterion = FocalLoss(alpha=0.25, gamma=2.0)
            optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=L2_REGULARIZATION)
            scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=10, verbose=True)
            early_stop = EarlyStopping(patience=25)
            
            # Training history
            history = {
                'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': [],
                'val_precision': [], 'val_recall': [], 'val_f1': []
            }
            
            best_val_acc = 0
            
            # Training loop
            for epoch in range(EPOCHS):
                print(f"\nEpoch {epoch+1}/{EPOCHS}")
                
                train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
                val_loss, val_acc, val_prec, val_rec, val_f1, tp, fp, tn, fn = validate(
                    model, val_loader, criterion, DEVICE
                )
                
                history['train_loss'].append(train_loss)
                history['val_loss'].append(val_loss)
                history['train_acc'].append(train_acc)
                history['val_acc'].append(val_acc)
                history['val_precision'].append(val_prec)
                history['val_recall'].append(val_rec)
                history['val_f1'].append(val_f1)
                
                print(f"Train Loss: {train_loss:.4f}, Acc: {train_acc:.4f}")
                print(f"Val Loss: {val_loss:.4f}, Acc: {val_acc:.4f}, F1: {val_f1:.4f}")
                print(f"Precision: {val_prec:.4f}, Recall: {val_rec:.4f}")
                print(f"TP: {tp}, FP: {fp}, TN: {tn}, FN: {fn}")
                
                scheduler.step(val_loss)
                early_stop(val_loss, val_acc)
                
                # Save best model for this fold
                if val_acc > best_val_acc:
                    best_val_acc = val_acc
                    torch.save(model.state_dict(), f'beta_model_fold{fold+1}.pth')
                    print(f"✓ Best model saved for fold {fold+1}")
                
                if early_stop.early_stop:
                    print(f"\nEarly stopping at epoch {epoch+1}")
                    break
            
            # Plot fold results
            plot_training_history(history, fold=fold+1)
            
            fold_results.append({
                'fold': fold + 1,
                'best_accuracy': best_val_acc,
                'final_f1': history['val_f1'][-1],
                'final_precision': history['val_precision'][-1],
                'final_recall': history['val_recall'][-1]
            })
            
            print(f"\nFold {fold+1} Best Accuracy: {best_val_acc:.4f}")
            
            # Track best overall model
            if best_val_acc > best_model_accuracy:
                best_model_accuracy = best_val_acc
                best_fold = fold + 1
        
        # Summary of all folds
        print("\n" + "="*80)
        print("K-FOLD CROSS VALIDATION RESULTS")
        print("="*80)
        
        accuracies = [r['best_accuracy'] for r in fold_results]
        f1_scores = [r['final_f1'] for r in fold_results]
        
        print(f"\nAccuracy per fold:")
        for r in fold_results:
            print(f"  Fold {r['fold']}: {r['best_accuracy']:.4f} (F1: {r['final_f1']:.4f})")
        
        print(f"\nOverall Statistics:")
        print(f"  Mean Accuracy: {np.mean(accuracies):.4f} ± {np.std(accuracies):.4f}")
        print(f"  Mean F1 Score: {np.mean(f1_scores):.4f} ± {np.std(f1_scores):.4f}")
        print(f"  Best Fold: {best_fold} (Accuracy: {best_model_accuracy:.4f})")
        
        # Use best fold model as final model
        print(f"\n✓ Using model from Fold {best_fold} as final model")
        os.rename(f'beta_model_fold{best_fold}.pth', 'beta_classifier_best.pth')
        
        # Clean up other fold models
        for fold in range(1, N_FOLDS + 1):
            if fold != best_fold:
                fold_file = f'beta_model_fold{fold}.pth'
                if os.path.exists(fold_file):
                    os.remove(fold_file)
        
    else:
        # Single train/val split
        print("\n" + "="*80)
        print("SINGLE TRAIN/VAL SPLIT")
        print("="*80)
        
        # Split data
        X_time_temp, X_time_test, y_temp, y_test = train_test_split(
            X_time, y, test_size=0.15, random_state=42, stratify=y
        )
        X_stat_temp, X_stat_test = train_test_split(
            X_stat_scaled, test_size=0.15, random_state=42, stratify=y
        )
        X_freq_temp, X_freq_test = train_test_split(
            X_freq_scaled, test_size=0.15, random_state=42, stratify=y
        )
        
        X_time_train, X_time_val, y_train, y_val = train_test_split(
            X_time_temp, y_temp, test_size=0.176, random_state=42, stratify=y_temp
        )
        X_stat_train, X_stat_val = train_test_split(
            X_stat_temp, test_size=0.176, random_state=42, stratify=y_temp
        )
        X_freq_train, X_freq_val = train_test_split(
            X_freq_temp, test_size=0.176, random_state=42, stratify=y_temp
        )
        
        print(f"Train: {len(y_train)}, Val: {len(y_val)}, Test: {len(y_test)}")
        
        # Create datasets
        train_dataset = EnhancedEEGDataset(X_time_train, X_stat_train, X_freq_train, y_train)
        val_dataset = EnhancedEEGDataset(X_time_val, X_stat_val, X_freq_val, y_val)
        test_dataset = EnhancedEEGDataset(X_time_test, X_stat_test, X_freq_test, y_test)
        
        # Weighted sampling
        class_counts = Counter(y_train)
        class_weights = {0: 1.0/class_counts[0], 1: 1.0/class_counts[1]}
        sample_weights = [class_weights[int(label)] for label in y_train]
        sampler = WeightedRandomSampler(sample_weights, len(sample_weights))
        
        train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, sampler=sampler)
        val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
        test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
        
        # Initialize model
        model = OptimizedBetaClassifier(
            stat_feat_size=X_stat_scaled.shape[1],
            freq_feat_size=X_freq_scaled.shape[1]
        ).to(DEVICE)
        
        criterion = FocalLoss(alpha=0.25, gamma=2.0)
        optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=L2_REGULARIZATION)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=10, verbose=True)
        early_stop = EarlyStopping(patience=25)
        
        # Training history
        history = {
            'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': [],
            'val_precision': [], 'val_recall': [], 'val_f1': []
        }
        
        best_val_acc = 0
        
        # Training loop
        print("\nStarting training...")
        for epoch in range(EPOCHS):
            print(f"\n{'='*80}")
            print(f"Epoch {epoch+1}/{EPOCHS}")
            print(f"{'='*80}")
            
            train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
            val_loss, val_acc, val_prec, val_rec, val_f1, tp, fp, tn, fn = validate(
                model, val_loader, criterion, DEVICE
            )
            
            history['train_loss'].append(train_loss)
            history['val_loss'].append(val_loss)
            history['train_acc'].append(train_acc)
            history['val_acc'].append(val_acc)
            history['val_precision'].append(val_prec)
            history['val_recall'].append(val_rec)
            history['val_f1'].append(val_f1)
            
            print(f"\nResults:")
            print(f"  Train Loss: {train_loss:.4f}, Acc: {train_acc:.4f}")
            print(f"  Val Loss: {val_loss:.4f}, Acc: {val_acc:.4f}")
            print(f"  Precision: {val_prec:.4f}, Recall: {val_rec:.4f}, F1: {val_f1:.4f}")
            print(f"  Confusion Matrix: TP={tp}, FP={fp}, TN={tn}, FN={fn}")
            
            scheduler.step(val_loss)
            early_stop(val_loss, val_acc)
            
            # Save best model
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                torch.save(model.state_dict(), 'beta_classifier_best.pth')
                print(f"\n✓ Best model saved (Accuracy: {best_val_acc:.4f})")
            
            if early_stop.early_stop:
                print(f"\n{'='*80}")
                print(f"Early stopping triggered at epoch {epoch+1}")
                print(f"{'='*80}")
                break
        
        # Plot results
        plot_training_history(history)
        
        # Test on held-out test set
        print("\n" + "="*80)
        print("EVALUATING ON TEST SET")
        print("="*80)
        
        model.load_state_dict(torch.load('beta_classifier_best.pth'))
        test_loss, test_acc, test_prec, test_rec, test_f1, tp, fp, tn, fn = validate(
            model, test_loader, criterion, DEVICE
        )
        
        print(f"\nTest Set Results:")
        print(f"  Accuracy: {test_acc:.4f}")
        print(f"  Precision: {test_prec:.4f}")
        print(f"  Recall: {test_rec:.4f}")
        print(f"  F1 Score: {test_f1:.4f}")
        print(f"\nConfusion Matrix:")
        print(f"  True Positives (Non-Beta correctly identified): {tp}")
        print(f"  False Positives (Beta incorrectly as Non-Beta): {fp}")
        print(f"  True Negatives (Beta correctly identified): {tn}")
        print(f"  False Negatives (Non-Beta incorrectly as Beta): {fn}")
    
    # Final summary
    print("\n" + "="*80)
    print("TRAINING COMPLETE!")
    print("="*80)
    print("\nSaved files:")
    print("  • beta_classifier_best.pth - Best model weights")
    print("  • beta_time_scaler.pkl - Time series scaler")
    print("  • beta_stat_scaler.pkl - Statistical features scaler")
    print("  • beta_freq_scaler.pkl - Frequency features scaler")
    print("  • beta_training_history*.png - Training plots")
    
    print("\nNext steps:")
    print("  1. Test model with: python test_beta_model.py beta.csv")
    print("  2. Your beta.csv should now be classified as Class 0 (Beta)")
    print("="*80)

if __name__ == "__main__":
    main()