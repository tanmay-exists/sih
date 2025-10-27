import numpy as np
import pandas as pd
import os

# --- Configuration Parameters ---

# General signal characteristics
SAMPLING_RATE = 256      # Standard sampling rate in Hz
DURATION = 2             # Duration of each epoch in seconds
N_SAMPLES = SAMPLING_RATE * DURATION

# To get a total of ~1 minute (60 seconds) of data, we calculate:
# 60 seconds / (5 classes * 2 seconds/epoch) = 6 epochs per class
N_EPOCHS_PER_CLASS = 12 # Number of sample epochs to generate for each wave type

# Noise level
NOISE_LEVEL = 3.0        # Standard deviation of the Gaussian noise to add

# EEG Wave definitions (Frequency in Hz, Amplitude in µV)
WAVE_PARAMS = {
    'delta': {'freq_range': (0.5, 4),   'amp_range': (50, 100)},
    'theta': {'freq_range': (4, 8),     'amp_range': (30, 80)},
    'alpha': {'freq_range': (8, 13),    'amp_range': (20, 60)},
    'beta':  {'freq_range': (13, 30),   'amp_range': (10, 30)},
    'gamma': {'freq_range': (30, 100),  'amp_range': (5, 20)}
}

# Output file name
OUTPUT_FILENAME = 'synthetic_eeg_full_dataset_1min.csv'

# --- Function to Generate Signal ---

def generate_eeg_signal(freq_range, amp_range, t, noise_level):
    """
    Generates a single, noisy EEG signal epoch for a given wave type.

    Args:
        freq_range (tuple): The (min, max) frequency for the wave.
        amp_range (tuple): The (min, max) amplitude for the wave.
        t (np.array): The time vector for the signal.
        noise_level (float): The standard deviation of the Gaussian noise.

    Returns:
        np.array: The generated signal values.
    """
    # Choose a random frequency and amplitude from the specified ranges
    freq = np.random.uniform(freq_range[0], freq_range[1])
    amp = np.random.uniform(amp_range[0], amp_range[1])

    # Create the pure sine wave component
    pure_signal = amp * np.sin(2 * np.pi * freq * t)

    # Add some Gaussian noise to make it more realistic
    noise = np.random.normal(0, noise_level, len(t))

    return pure_signal + noise

# --- Main Data Generation Script ---

if __name__ == "__main__":
    print("Starting EEG dataset generation...")

    # Create the time vector for our signals
    t = np.linspace(0, DURATION, N_SAMPLES, endpoint=False)

    eeg_data = []
    epoch_id_counter = 0

    # Loop through each defined wave type
    for wave_name, params in WAVE_PARAMS.items():
        print(f"Generating {N_EPOCHS_PER_CLASS} epochs for '{wave_name}' waves...")
        for i in range(N_EPOCHS_PER_CLASS):
            # Generate the signal
            signal_values = generate_eeg_signal(
                params['freq_range'],
                params['amp_range'],
                t,
                NOISE_LEVEL
            )

            # Convert the numpy array of signal values to a comma-separated string
            signal_str = ",".join(map(lambda x: f"{x:.4f}", signal_values))

            # Append the record to our data list
            eeg_data.append([epoch_id_counter, wave_name, signal_str])
            epoch_id_counter += 1

    # Create a Pandas DataFrame from the generated data
    df = pd.DataFrame(eeg_data, columns=['epoch_id', 'label', 'signal_values'])

    # Shuffle the dataset to mix the wave types
    df = df.sample(frac=1).reset_index(drop=True)

    # Save the DataFrame to a CSV file
    try:
        df.to_csv(OUTPUT_FILENAME, index=False)
        print(f"\nDataset successfully generated and saved as '{os.path.abspath(OUTPUT_FILENAME)}'")
        print(f"Total epochs generated: {len(df)}")
        print(f"Total signal duration: {len(df) * DURATION} seconds.")
        print("\n--- Dataset Preview ---")
        print(df.head())
        print("\n--- Class Distribution ---")
        print(df['label'].value_counts())

    except Exception as e:
        print(f"\nAn error occurred while saving the file: {e}")
