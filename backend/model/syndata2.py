import numpy as np
import pandas as pd
from scipy import signal
import openpyxl
from datetime import datetime, timedelta
import os
import json
from tqdm import tqdm
import matplotlib.pyplot as plt

class MultipleEEGExcelGenerator:
    def __init__(self, fs=512, duration=240.0):  # 4 minutes = 240 seconds
        """
        Generate multiple individual Excel files for EEG data
        
        Parameters:
        fs: sampling frequency (Hz)
        duration: signal duration in seconds (240s = 4 minutes)
        """
        self.fs = fs
        self.duration = duration
        self.n_samples = int(fs * duration)
        self.t = np.linspace(0, duration, self.n_samples)
        
        # EEG frequency bands
        self.delta_band = (0.5, 4)    # Delta waves
        self.theta_band = (4, 8)      # Theta waves  
        self.alpha_band = (8, 13)     # Alpha waves
        self.beta_band = (13, 30)     # Beta waves (target)
        self.gamma_band = (30, 100)   # Gamma waves
        
        # Standard 10-20 EEG electrode positions
        self.electrode_positions = [
            'Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 
            'O1', 'O2', 'F7', 'F8', 'T3', 'T4', 'T5', 'T6', 'Fz', 'Cz', 'Pz', 'Oz'
        ]
        
    def generate_brain_wave(self, freq_range, amplitude=1.0, phase_shift=0):
        """Generate brain wave in specific frequency range"""
        freq = np.random.uniform(freq_range[0], freq_range[1])
        wave = amplitude * np.sin(2 * np.pi * freq * self.t + phase_shift)
        
        # Add frequency modulation for realism
        mod_freq = np.random.uniform(0.1, 0.5)
        freq_mod = 1 + 0.1 * np.sin(2 * np.pi * mod_freq * self.t)
        wave = wave * freq_mod
        
        # Add amplitude modulation
        amp_mod_freq = np.random.uniform(0.05, 0.2)
        amp_mod = 1 + 0.15 * np.sin(2 * np.pi * amp_mod_freq * self.t)
        wave = wave * amp_mod
        
        return wave
    
    def add_eeg_noise(self, eeg_signal, snr_db=20):
        """Add realistic EEG noise"""
        # Power line interference (50/60 Hz)
        powerline_freq = np.random.choice([50, 60])
        powerline_noise = 0.1 * np.sin(2 * np.pi * powerline_freq * self.t)
        
        # White noise
        signal_power = np.mean(eeg_signal**2)
        noise_power = signal_power / (10**(snr_db/10))
        white_noise = np.random.normal(0, np.sqrt(noise_power), len(eeg_signal))
        
        # Pink noise (1/f noise common in EEG)
        freqs = np.fft.fftfreq(len(eeg_signal), 1/self.fs)
        freqs[0] = 1  # Avoid division by zero
        pink_spectrum = 1 / np.sqrt(np.abs(freqs))
        pink_noise_fft = pink_spectrum * np.random.normal(0, 1, len(eeg_signal))
        pink_noise = np.fft.ifft(pink_noise_fft).real
        pink_noise = pink_noise * 0.2 * np.sqrt(signal_power)
        
        # Muscle artifact noise (EMG contamination)
        emg_freq = np.random.uniform(30, 100)
        emg_noise = 0.05 * np.random.normal(0, 1, len(eeg_signal)) * np.sin(2 * np.pi * emg_freq * self.t)
        
        return eeg_signal + powerline_noise + white_noise + pink_noise + emg_noise
    
    def add_realistic_artifacts(self, eeg_signal, electrode='Fp1'):
        """Add electrode-specific artifacts"""
        signal_copy = eeg_signal.copy()
        
        # Eye blink artifacts (more prominent in frontal electrodes)
        if electrode in ['Fp1', 'Fp2', 'F3', 'F4', 'Fz']:
            n_blinks = np.random.poisson(3)  # Average 3 blinks per 4 minutes
            for _ in range(n_blinks):
                blink_start = np.random.randint(0, len(signal_copy) - int(1.0 * self.fs))
                blink_duration = int(np.random.uniform(0.3, 0.8) * self.fs)
                blink_shape = np.exp(-((np.arange(blink_duration) - blink_duration/2)**2) / (2 * (blink_duration/6)**2))
                blink_amplitude = np.random.uniform(20, 50)  # Strong artifact
                signal_copy[blink_start:blink_start + blink_duration] += blink_amplitude * blink_shape
        
        # Muscle artifacts (more in temporal regions)
        if electrode in ['T3', 'T4', 'F7', 'F8']:
            if np.random.random() < 0.3:  # 30% chance
                muscle_start = np.random.randint(0, len(signal_copy) - int(2.0 * self.fs))
                muscle_duration = int(np.random.uniform(1.0, 3.0) * self.fs)
                muscle_artifact = np.random.normal(0, 3, muscle_duration) * np.exp(-np.arange(muscle_duration) / (0.5 * self.fs))
                signal_copy[muscle_start:muscle_start + muscle_duration] += muscle_artifact
        
        # Cardiac artifacts (subtle, more in lower frequencies)
        heart_rate = np.random.uniform(60, 100)  # BPM
        heart_freq = heart_rate / 60  # Hz
        cardiac_artifact = 0.5 * np.sin(2 * np.pi * heart_freq * self.t)
        signal_copy += cardiac_artifact
        
        # Movement artifacts (random spikes)
        n_movements = np.random.poisson(1)  # Rare movement artifacts
        for _ in range(n_movements):
            movement_start = np.random.randint(0, len(signal_copy) - int(0.5 * self.fs))
            movement_duration = int(np.random.uniform(0.1, 0.5) * self.fs)
            movement_amplitude = np.random.uniform(-15, 15)
            signal_copy[movement_start:movement_start + movement_duration] += movement_amplitude
        
        return signal_copy
    
    def generate_multi_channel_eeg(self, signal_type='beta_dominant'):
        """Generate realistic multi-channel EEG data"""
        channels_data = {}
        
        # Generate base signal patterns for different brain regions
        base_patterns = {
            'frontal': self.generate_brain_pattern('frontal', signal_type),
            'central': self.generate_brain_pattern('central', signal_type),
            'parietal': self.generate_brain_pattern('parietal', signal_type),
            'occipital': self.generate_brain_pattern('occipital', signal_type),
            'temporal': self.generate_brain_pattern('temporal', signal_type)
        }
        
        # Map electrodes to brain regions
        electrode_regions = {
            'Fp1': 'frontal', 'Fp2': 'frontal', 'F3': 'frontal', 'F4': 'frontal', 
            'F7': 'frontal', 'F8': 'frontal', 'Fz': 'frontal',
            'C3': 'central', 'C4': 'central', 'Cz': 'central',
            'P3': 'parietal', 'P4': 'parietal', 'Pz': 'parietal',
            'O1': 'occipital', 'O2': 'occipital', 'Oz': 'occipital',
            'T3': 'temporal', 'T4': 'temporal', 'T5': 'temporal', 'T6': 'temporal'
        }
        
        # Generate signals for each electrode
        for electrode in self.electrode_positions:
            region = electrode_regions.get(electrode, 'central')
            base_signal = base_patterns[region].copy()
            
            # Add electrode-specific variations
            variation = 0.2 * self.generate_brain_wave(self.alpha_band, amplitude=np.random.uniform(0.5, 1.5))
            base_signal += variation
            
            # Add noise and artifacts
            base_signal = self.add_eeg_noise(base_signal, snr_db=np.random.uniform(15, 25))
            base_signal = self.add_realistic_artifacts(base_signal, electrode)
            
            channels_data[electrode] = base_signal
            
        return channels_data
    
    def generate_brain_pattern(self, region, signal_type):
        """Generate region-specific brain wave patterns"""
        if signal_type == 'beta_dominant':
            if region == 'frontal':
                # Frontal beta activity (executive functions)
                delta = self.generate_brain_wave(self.delta_band, amplitude=1.5)
                theta = self.generate_brain_wave(self.theta_band, amplitude=1.2)
                alpha = self.generate_brain_wave(self.alpha_band, amplitude=1.0)
                beta = self.generate_brain_wave(self.beta_band, amplitude=3.5)  # Prominent
                gamma = self.generate_brain_wave(self.gamma_band, amplitude=0.4)
            elif region == 'central':
                # Central beta (motor activity)
                delta = self.generate_brain_wave(self.delta_band, amplitude=1.0)
                theta = self.generate_brain_wave(self.theta_band, amplitude=0.8)
                alpha = self.generate_brain_wave(self.alpha_band, amplitude=0.8)
                beta = self.generate_brain_wave(self.beta_band, amplitude=4.0)  # Very prominent
                gamma = self.generate_brain_wave(self.gamma_band, amplitude=0.5)
            else:
                # Other regions with moderate beta
                delta = self.generate_brain_wave(self.delta_band, amplitude=2.0)
                theta = self.generate_brain_wave(self.theta_band, amplitude=1.5)
                alpha = self.generate_brain_wave(self.alpha_band, amplitude=1.2)
                beta = self.generate_brain_wave(self.beta_band, amplitude=2.5)
                gamma = self.generate_brain_wave(self.gamma_band, amplitude=0.3)
        else:  # non-beta patterns
            if region == 'occipital':
                # Alpha dominant (visual cortex at rest)
                delta = self.generate_brain_wave(self.delta_band, amplitude=1.0)
                theta = self.generate_brain_wave(self.theta_band, amplitude=1.0)
                alpha = self.generate_brain_wave(self.alpha_band, amplitude=4.5)  # Prominent
                beta = self.generate_brain_wave(self.beta_band, amplitude=0.5)
                gamma = self.generate_brain_wave(self.gamma_band, amplitude=0.2)
            elif region == 'temporal':
                # Theta prominent (memory processing)
                delta = self.generate_brain_wave(self.delta_band, amplitude=1.8)
                theta = self.generate_brain_wave(self.theta_band, amplitude=3.5)  # Prominent
                alpha = self.generate_brain_wave(self.alpha_band, amplitude=1.5)
                beta = self.generate_brain_wave(self.beta_band, amplitude=0.7)
                gamma = self.generate_brain_wave(self.gamma_band, amplitude=0.3)
            else:
                # Mixed patterns
                delta = self.generate_brain_wave(self.delta_band, amplitude=2.5)
                theta = self.generate_brain_wave(self.theta_band, amplitude=2.0)
                alpha = self.generate_brain_wave(self.alpha_band, amplitude=2.0)
                beta = self.generate_brain_wave(self.beta_band, amplitude=1.0)
                gamma = self.generate_brain_wave(self.gamma_band, amplitude=0.4)
        
        return delta + theta + alpha + beta + gamma
    
    def extract_comprehensive_features(self, channels_data):
        """Extract comprehensive features from multi-channel EEG"""
        features = {}
        
        for electrode, eeg_signal in channels_data.items():
            # Power spectral density
            freqs, psd = signal.welch(eeg_signal, fs=self.fs, nperseg=self.fs)
            
            # Band powers
            delta_power = np.trapz(psd[(freqs >= self.delta_band[0]) & (freqs <= self.delta_band[1])])
            theta_power = np.trapz(psd[(freqs >= self.theta_band[0]) & (freqs <= self.theta_band[1])])
            alpha_power = np.trapz(psd[(freqs >= self.alpha_band[0]) & (freqs <= self.alpha_band[1])])
            beta_power = np.trapz(psd[(freqs >= self.beta_band[0]) & (freqs <= self.beta_band[1])])
            gamma_power = np.trapz(psd[(freqs >= self.gamma_band[0]) & (freqs <= self.gamma_band[1])])
            
            total_power = delta_power + theta_power + alpha_power + beta_power + gamma_power
            
            features[electrode] = {
                'delta_power_rel': delta_power / total_power,
                'theta_power_rel': theta_power / total_power,
                'alpha_power_rel': alpha_power / total_power,
                'beta_power_rel': beta_power / total_power,
                'gamma_power_rel': gamma_power / total_power,
                'beta_alpha_ratio': beta_power / (alpha_power + 1e-10),
                'theta_beta_ratio': theta_power / (beta_power + 1e-10),
                'mean_amplitude': np.mean(eeg_signal),
                'std_amplitude': np.std(eeg_signal),
                'rms_amplitude': np.sqrt(np.mean(eeg_signal**2)),
                'peak_frequency': freqs[np.argmax(psd)],
                'spectral_entropy': -np.sum((psd/np.sum(psd)) * np.log2(psd/np.sum(psd) + 1e-10))
            }
        
        return features
    
    def create_single_excel_file(self, file_id, output_dir='EEG_Excel_Files'):
        """Create a single Excel file with 4-minute EEG data"""
        
        # Determine signal type (50% beta, 50% non-beta)
        signal_type = 'beta_dominant' if file_id <= 50 else 'non_beta'
        label = 1 if signal_type == 'beta_dominant' else 0
        
        # Generate multi-channel EEG data
        channels_data = self.generate_multi_channel_eeg(signal_type)
        
        # Generate timestamps
        start_time = datetime(2024, 1, 1) + timedelta(days=np.random.randint(0, 365), 
                                                     hours=np.random.randint(0, 24),
                                                     minutes=np.random.randint(0, 60))
        timestamps = [start_time + timedelta(seconds=t) for t in self.t]
        
        # Create filename
        filename = f"EEG_Subject_{file_id:03d}_{signal_type}_4min.xlsx"
        filepath = os.path.join(output_dir, filename)
        
        # Create Excel file
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            
            # Create main data sheet
            main_data = {
                'Timestamp': timestamps,
                'Time_Seconds': self.t,
                'Subject_ID': f'S{file_id:03d}',
                'Signal_Type': signal_type,
                'Beta_Label': label
            }
            
            # Add all electrode channels
            for electrode in self.electrode_positions:
                main_data[f'EEG_{electrode}_uV'] = channels_data[electrode]
            
            main_df = pd.DataFrame(main_data)
            main_df.to_excel(writer, sheet_name='EEG_Data', index=False)
            
            # Extract features
            features = self.extract_comprehensive_features(channels_data)
            
            # Create features sheet
            features_data = []
            for electrode, feat_dict in features.items():
                feat_row = {'Electrode': electrode}
                feat_row.update(feat_dict)
                features_data.append(feat_row)
            
            features_df = pd.DataFrame(features_data)
            features_df.to_excel(writer, sheet_name='Features', index=False)
            
            # Create metadata sheet
            metadata = {
                'Parameter': [
                    'Subject_ID', 'Recording_Date', 'Duration_Minutes', 'Sampling_Rate_Hz',
                    'Total_Samples', 'Number_of_Channels', 'Signal_Type', 'Beta_Label',
                    'Electrodes', 'File_Generated', 'Generator_Version'
                ],
                'Value': [
                    f'S{file_id:03d}',
                    start_time.strftime('%Y-%m-%d %H:%M:%S'),
                    self.duration / 60,
                    self.fs,
                    self.n_samples,
                    len(self.electrode_positions),
                    signal_type,
                    label,
                    ', '.join(self.electrode_positions),
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'EEG_Generator_v2.0'
                ]
            }
            
            metadata_df = pd.DataFrame(metadata)
            metadata_df.to_excel(writer, sheet_name='Metadata', index=False)
            
            # Create summary statistics sheet
            summary_stats = []
            for electrode in self.electrode_positions:
                eeg_data = channels_data[electrode]
                stats = {
                    'Electrode': electrode,
                    'Mean_uV': np.mean(eeg_data),
                    'Std_uV': np.std(eeg_data),
                    'Min_uV': np.min(eeg_data),
                    'Max_uV': np.max(eeg_data),
                    'Range_uV': np.max(eeg_data) - np.min(eeg_data),
                    'RMS_uV': np.sqrt(np.mean(eeg_data**2)),
                    'Skewness': pd.Series(eeg_data).skew(),
                    'Kurtosis': pd.Series(eeg_data).kurtosis()
                }
                summary_stats.append(stats)
            
            summary_df = pd.DataFrame(summary_stats)
            summary_df.to_excel(writer, sheet_name='Statistics', index=False)
        
        return filepath, {
            'subject_id': f'S{file_id:03d}',
            'signal_type': signal_type,
            'beta_label': label,
            'filename': filename,
            'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
            'channels': len(self.electrode_positions),
            'samples': self.n_samples
        }
    
    def generate_100_excel_files(self, output_dir='EEG_Excel_Files'):
        """Generate 100 individual Excel files with 4-minute EEG data"""
        
        # Create output directory
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            print(f"📁 Created directory: {output_dir}")
        
        print("🧠 Generating 100 Individual 4-Minute EEG Excel Files...")
        print("=" * 60)
        
        file_info_list = []
        failed_files = []
        
        # Progress bar
        with tqdm(total=100, desc="Generating Files", unit="file") as pbar:
            for file_id in range(1, 101):
                try:
                    filepath, file_info = self.create_single_excel_file(file_id, output_dir)
                    file_info_list.append(file_info)
                    pbar.set_postfix({
                        'Current': f"S{file_id:03d}",
                        'Type': file_info['signal_type'][:4]
                    })
                    
                except Exception as e:
                    failed_files.append((file_id, str(e)))
                    print(f"❌ Error generating file {file_id}: {e}")
                
                pbar.update(1)
        
        # Create master index file
        self.create_master_index(file_info_list, output_dir)
        
        # Print summary
        print("\n" + "=" * 60)
        print("✅ GENERATION COMPLETE!")
        print("=" * 60)
        print(f"📊 Total files generated: {len(file_info_list)}")
        print(f"🧠 Beta-dominant signals: {sum(1 for f in file_info_list if f['beta_label'] == 1)}")
        print(f"🌊 Non-beta signals: {sum(1 for f in file_info_list if f['beta_label'] == 0)}")
        print(f"⏱️  Duration per file: 4 minutes")
        print(f"📡 Channels per file: {len(self.electrode_positions)}")
        print(f"🔢 Sampling rate: {self.fs} Hz")
        print(f"📁 Output directory: {output_dir}")
        
        if failed_files:
            print(f"\n⚠️  Failed files: {len(failed_files)}")
            for file_id, error in failed_files:
                print(f"   - File {file_id}: {error}")
        
        print(f"\n📋 Master index created: {os.path.join(output_dir, 'Master_Index.xlsx')}")
        
        return file_info_list
    
    def create_master_index(self, file_info_list, output_dir):
        """Create a master index Excel file with all file information"""
        
        index_filepath = os.path.join(output_dir, 'Master_Index.xlsx')
        
        with pd.ExcelWriter(index_filepath, engine='openpyxl') as writer:
            
            # File index sheet
            index_df = pd.DataFrame(file_info_list)
            index_df.to_excel(writer, sheet_name='File_Index', index=False)
            
            # Dataset summary
            beta_count = sum(1 for f in file_info_list if f['beta_label'] == 1)
            non_beta_count = len(file_info_list) - beta_count
            
            summary_data = {
                'Metric': [
                    'Total_Files', 'Beta_Dominant_Files', 'Non_Beta_Files',
                    'Duration_Per_File_Minutes', 'Sampling_Rate_Hz', 'Channels_Per_File',
                    'Samples_Per_File', 'Total_Data_Points', 'Generation_Date',
                    'Generator_Version', 'Electrodes_Used'
                ],
                'Value': [
                    len(file_info_list), beta_count, non_beta_count,
                    self.duration / 60, self.fs, len(self.electrode_positions),
                    self.n_samples, len(file_info_list) * self.n_samples * len(self.electrode_positions),
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'EEG_Generator_v2.0', ', '.join(self.electrode_positions)
                ]
            }
            
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Dataset_Summary', index=False)

# Main execution function
def generate_100_eeg_excel_files():
    """Main function to generate 100 EEG Excel files"""
    
    print("🧠 EEG EXCEL FILES GENERATOR")
    print("=" * 50)
    print("Generating 100 individual Excel files with 4-minute EEG data")
    print("Each file contains 20-channel EEG data with realistic artifacts")
    print("=" * 50)
    
    # Initialize generator
    generator = MultipleEEGExcelGenerator(fs=512, duration=240.0)  # 4 minutes
    
    # Generate all files
    file_info_list = generator.generate_100_excel_files()
    
    return file_info_list

# Run the generator
if __name__ == "__main__":
    file_info_list = generate_100_eeg_excel_files()