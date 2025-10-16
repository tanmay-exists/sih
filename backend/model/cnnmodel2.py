import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, random_split
import torch.nn.functional as F
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm
import os
import warnings
warnings.filterwarnings('ignore')

# Set device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

class EEGDataset(Dataset):
    """Custom Dataset for EEG signals"""
    
    def __init__(self, signals, labels, transform=None):
        """
        Args:
            signals: numpy array of EEG signals (N, channels, samples)
            labels: numpy array of labels (N,)
            transform: optional transform to be applied on samples
        """
        self.signals = torch.FloatTensor(signals)
        self.labels = torch.LongTensor(labels)
        self.transform = transform
    
    def __len__(self):
        return len(self.signals)
    
    def __getitem__(self, idx):
        signal = self.signals[idx]
        label = self.labels[idx]
        
        if self.transform:
            signal = self.transform(signal)
        
        return signal, label

class EEGCNNModel(nn.Module):
    """CNN model for EEG beta wave classification with Batch Normalization"""
    
    def __init__(self, input_channels=20, sequence_length=122880, num_classes=2, dropout_rate=0.5):
        super(EEGCNNModel, self).__init__()
        
        self.input_channels = input_channels
        self.sequence_length = sequence_length
        
        # Temporal Convolutional Layers
        self.conv1 = nn.Conv1d(input_channels, 64, kernel_size=64, stride=4, padding=32)
        self.bn1 = nn.BatchNorm1d(64)
        
        self.conv2 = nn.Conv1d(64, 128, kernel_size=32, stride=2, padding=16)
        self.bn2 = nn.BatchNorm1d(128)
        
        self.conv3 = nn.Conv1d(128, 256, kernel_size=16, stride=2, padding=8)
        self.bn3 = nn.BatchNorm1d(256)
        
        self.conv4 = nn.Conv1d(256, 512, kernel_size=8, stride=2, padding=4)
        self.bn4 = nn.BatchNorm1d(512)
        
        self.conv5 = nn.Conv1d(512, 256, kernel_size=4, stride=2, padding=2)
        self.bn5 = nn.BatchNorm1d(256)
        
        # Global Average Pooling
        self.global_avg_pool = nn.AdaptiveAvgPool1d(1)
        
        # Fully Connected Layers
        self.fc1 = nn.Linear(256, 128)
        self.bn_fc1 = nn.BatchNorm1d(128)
        self.dropout1 = nn.Dropout(dropout_rate)
        
        self.fc2 = nn.Linear(128, 64)
        self.bn_fc2 = nn.BatchNorm1d(64)
        self.dropout2 = nn.Dropout(dropout_rate)
        
        self.fc3 = nn.Linear(64, num_classes)
        
        # Initialize weights
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize model weights using Xavier/He initialization"""
        for m in self.modules():
            if isinstance(m, nn.Conv1d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm1d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                nn.init.constant_(m.bias, 0)
    
    def forward(self, x):
        # x shape: (batch_size, channels, sequence_length)
        
        # Convolutional layers with batch normalization
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.max_pool1d(x, kernel_size=4, stride=2)
        
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.max_pool1d(x, kernel_size=4, stride=2)
        
        x = F.relu(self.bn3(self.conv3(x)))
        x = F.max_pool1d(x, kernel_size=4, stride=2)
        
        x = F.relu(self.bn4(self.conv4(x)))
        x = F.max_pool1d(x, kernel_size=4, stride=2)
        
        x = F.relu(self.bn5(self.conv5(x)))
        
        # Global Average Pooling
        x = self.global_avg_pool(x)  # (batch_size, 256, 1)
        x = x.view(x.size(0), -1)    # (batch_size, 256)
        
        # Fully connected layers
        x = F.relu(self.bn_fc1(self.fc1(x)))
        x = self.dropout1(x)
        
        x = F.relu(self.bn_fc2(self.fc2(x)))
        x = self.dropout2(x)
        
        x = self.fc3(x)
        
        return x

class EEGDataLoader:
    """Data loader for EEG Excel files"""
    
    def __init__(self, data_dir='EEG_Excel_Files'):
        self.data_dir = data_dir
    
    def load_single_excel_file(self, filename):
        """Load EEG data from a single Excel file"""
        filepath = os.path.join(self.data_dir, filename)
        
        try:
            # Load EEG data
            eeg_df = pd.read_excel(filepath, sheet_name='EEG_Data')
            
            # Extract electrode columns (20 channels)
            electrode_cols = [col for col in eeg_df.columns if col.startswith('EEG_') and col.endswith('_uV')]
            eeg_data = eeg_df[electrode_cols].values.T  # Shape: (channels, samples)
            
            # Get label
            label = eeg_df['Beta_Label'].iloc[0]
            
            return eeg_data, label
            
        except Exception as e:
            print(f"Error loading {filename}: {e}")
            return None, None
    
    def load_all_data(self, max_files=None):
        """Load all EEG data from Excel files"""
        if not os.path.exists(self.data_dir):
            raise FileNotFoundError(f"Directory {self.data_dir} not found. Run the Excel generator first.")
        
        # Get all Excel files (excluding master index)
        excel_files = [f for f in os.listdir(self.data_dir) 
                      if f.endswith('.xlsx') and f.startswith('EEG_Subject_')]
        
        if max_files:
            excel_files = excel_files[:max_files]
        
        print(f"Loading {len(excel_files)} EEG files...")
        
        all_signals = []
        all_labels = []
        
        for filename in tqdm(excel_files, desc="Loading files"):
            eeg_data, label = self.load_single_excel_file(filename)
            if eeg_data is not None:
                all_signals.append(eeg_data)
                all_labels.append(label)
        
        # Convert to numpy arrays
        signals = np.array(all_signals)  # Shape: (n_files, channels, samples)
        labels = np.array(all_labels)    # Shape: (n_files,)
        
        print(f"Loaded {len(signals)} signals")
        print(f"Signal shape: {signals.shape}")
        print(f"Labels distribution: Beta={np.sum(labels)}, Non-Beta={len(labels)-np.sum(labels)}")
        
        return signals, labels

class EEGTrainer:
    """Trainer class for EEG CNN model"""
    
    def __init__(self, model, device, learning_rate=0.001, weight_decay=1e-4):
        self.model = model.to(device)
        self.device = device
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode='min', patience=5, factor=0.5, verbose=True
        )
        
        # Training history
        self.train_losses = []
        self.train_accuracies = []
        self.val_losses = []
        self.val_accuracies = []
    
    def train_epoch(self, train_loader):
        """Train for one epoch"""
        self.model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc="Training", leave=False)
        for batch_idx, (data, target) in enumerate(pbar):
            data, target = data.to(self.device), target.to(self.device)
            
            # Zero gradients
            self.optimizer.zero_grad()
            
            # Forward pass
            output = self.model(data)
            loss = self.criterion(output, target)
            
            # Backward pass
            loss.backward()
            
            # Gradient clipping to prevent exploding gradients
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            # Update weights
            self.optimizer.step()
            
            # Statistics
            running_loss += loss.item()
            pred = output.argmax(dim=1, keepdim=True)
            correct += pred.eq(target.view_as(pred)).sum().item()
            total += target.size(0)
            
            # Update progress bar
            pbar.set_postfix({
                'Loss': f'{loss.item():.4f}',
                'Acc': f'{100. * correct / total:.2f}%'
            })
        
        epoch_loss = running_loss / len(train_loader)
        epoch_acc = 100. * correct / total
        
        return epoch_loss, epoch_acc
    
    def validate_epoch(self, val_loader):
        """Validate for one epoch"""
        self.model.eval()
        running_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for data, target in val_loader:
                data, target = data.to(self.device), target.to(self.device)
                
                # Forward pass
                output = self.model(data)
                loss = self.criterion(output, target)
                
                # Statistics
                running_loss += loss.item()
                pred = output.argmax(dim=1, keepdim=True)
                correct += pred.eq(target.view_as(pred)).sum().item()
                total += target.size(0)
        
        epoch_loss = running_loss / len(val_loader)
        epoch_acc = 100. * correct / total
        
        return epoch_loss, epoch_acc
    
    def train_model(self, train_loader, val_loader, epochs=50, save_path='best_eeg_model.pth'):
        """Train the model"""
        print(f"\n🚀 Starting training for {epochs} epochs...")
        print(f"Model parameters: {sum(p.numel() for p in self.model.parameters()):,}")
        
        best_val_acc = 0.0
        patience_counter = 0
        max_patience = 10
        
        for epoch in range(epochs):
            print(f'\nEpoch {epoch+1}/{epochs}')
            print('-' * 50)
            
            # Training
            train_loss, train_acc = self.train_epoch(train_loader)
            
            # Validation
            val_loss, val_acc = self.validate_epoch(val_loader)
            
            # Learning rate scheduling
            self.scheduler.step(val_loss)
            
            # Save history
            self.train_losses.append(train_loss)
            self.train_accuracies.append(train_acc)
            self.val_losses.append(val_loss)
            self.val_accuracies.append(val_acc)
            
            # Print epoch results
            print(f'Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%')
            print(f'Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%')
            
            # Save best model
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                torch.save({
                    'epoch': epoch + 1,
                    'model_state_dict': self.model.state_dict(),
                    'optimizer_state_dict': self.optimizer.state_dict(),
                    'train_acc': train_acc,
                    'val_acc': val_acc,
                    'train_loss': train_loss,
                    'val_loss': val_loss
                }, save_path)
                print(f'✅ New best model saved with validation accuracy: {val_acc:.2f}%')
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= max_patience:
                    print(f'Early stopping triggered after {max_patience} epochs without improvement')
                    break
        
        print(f'\n🎉 Training completed!')
        print(f'Best validation accuracy: {best_val_acc:.2f}%')
        
        return best_val_acc
    
    def plot_training_history(self):
        """Plot training history"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 5))
        
        # Plot losses
        ax1.plot(self.train_losses, label='Train Loss', color='blue')
        ax1.plot(self.val_losses, label='Validation Loss', color='red')
        ax1.set_title('Training and Validation Loss')
        ax1.set_xlabel('Epoch')
        ax1.set_ylabel('Loss')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Plot accuracies
        ax2.plot(self.train_accuracies, label='Train Accuracy', color='blue')
        ax2.plot(self.val_accuracies, label='Validation Accuracy', color='red')
        ax2.set_title('Training and Validation Accuracy')
        ax2.set_xlabel('Epoch')
        ax2.set_ylabel('Accuracy (%)')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.show()

def evaluate_model(model, test_loader, device, class_names=['Non-Beta', 'Beta']):
    """Evaluate the trained model"""
    model.eval()
    y_true = []
    y_pred = []
    y_proba = []
    
    with torch.no_grad():
        for data, target in tqdm(test_loader, desc="Evaluating"):
            data, target = data.to(device), target.to(device)
            output = model(data)
            pred = output.argmax(dim=1)
            proba = F.softmax(output, dim=1)
            
            y_true.extend(target.cpu().numpy())
            y_pred.extend(pred.cpu().numpy())
            y_proba.extend(proba.cpu().numpy())
    
    # Calculate metrics
    accuracy = accuracy_score(y_true, y_pred)
    print(f'\n📊 Test Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)')
    
    # Classification report
    print('\n📋 Classification Report:')
    print(classification_report(y_true, y_pred, target_names=class_names))
    
    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=class_names, yticklabels=class_names)
    plt.title('Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.show()
    
    return accuracy, y_true, y_pred, y_proba

def main():
    """Main training pipeline"""
    print("🧠 EEG Beta Wave Classification with CNN")
    print("=" * 50)
    
    # Load data
    data_loader = EEGDataLoader()
    signals, labels = data_loader.load_all_data(max_files=100)  # Load all 100 files
    
    # Normalize signals
    print("📊 Normalizing signals...")
    scaler = StandardScaler()
    signals_normalized = np.array([
        scaler.fit_transform(signal.T).T for signal in signals
    ])
    
    # Create datasets
    dataset = EEGDataset(signals_normalized, labels)
    
    # Split dataset
    train_size = int(0.7 * len(dataset))
    val_size = int(0.15 * len(dataset))
    test_size = len(dataset) - train_size - val_size
    
    train_dataset, val_dataset, test_dataset = random_split(
        dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )
    
    print(f"📈 Dataset splits:")
    print(f"  Train: {len(train_dataset)} samples")
    print(f"  Validation: {len(val_dataset)} samples")
    print(f"  Test: {len(test_dataset)} samples")
    
    # Create data loaders
    batch_size = 8  # Adjust based on GPU memory
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=2)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=2)
    
    # Create model
    model = EEGCNNModel(
        input_channels=20,      # 20 EEG electrodes
        sequence_length=122880, # 4 minutes at 512 Hz
        num_classes=2,          # Beta vs Non-Beta
        dropout_rate=0.5
    )
    
    print(f"🏗️ Model Architecture:")
    print(model)
    print(f"📊 Total parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Create trainer
    trainer = EEGTrainer(model, device, learning_rate=0.0001, weight_decay=1e-4)
    
    # Train model
    best_acc = trainer.train_model(
        train_loader, val_loader, 
        epochs=50, 
        save_path='best_eeg_beta_cnn.pth'
    )
    
    # Plot training history
    trainer.plot_training_history()
    
    # Load best model for evaluation
    checkpoint = torch.load('best_eeg_beta_cnn.pth')
    model.load_state_dict(checkpoint['model_state_dict'])
    
    # Evaluate on test set
    print("\n🔍 Evaluating on test set...")
    test_accuracy, y_true, y_pred, y_proba = evaluate_model(model, test_loader, device)
    
    print(f"\n✅ Final Results:")
    print(f"   Best Validation Accuracy: {best_acc:.2f}%")
    print(f"   Test Accuracy: {test_accuracy*100:.2f}%")
    print(f"   Model saved as: best_eeg_beta_cnn.pth")
    
    return model, trainer, test_accuracy

if __name__ == "__main__":
    model, trainer, test_accuracy = main()