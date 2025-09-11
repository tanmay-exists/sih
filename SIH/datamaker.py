import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import butter, filtfilt

# --- Configuration Constants ---
FS = 500  # Sampling frequency in Hz
CHUNK_SIZE = 200  # Samples per small chunk
TOTAL_DURATION_MIN = 20
UNFOCUSED_DURATION_MIN = 8 # Changed variable name for clarity

def simulate_eeg_chunk(focus=True):
    """
    Generates a single CHUNK_SIZE chunk of simulated EEG data.
    This is the core engine for creating the signal components.
    """
    t = np.linspace(0, CHUNK_SIZE / FS, CHUNK_SIZE, endpoint=False)
    
    # Base amplitudes with some random jitter for realism
    delta_amp = np.random.uniform(0.3, 0.5)
    theta_amp = np.random.uniform(0.2, 0.4)
    alpha_amp = np.random.uniform(0.3, 0.7)
    beta_amp = np.random.uniform(0.2, 0.6)

    if focus:
        # Focused state: Higher beta power, lower alpha power
        alpha_amp *= 0.5
        beta_amp *= 1.5
    else:
        # Unfocused state: Higher alpha power, lower beta power
        alpha_amp *= 1.5
        beta_amp *= 0.5

    delta = delta_amp * np.sin(2 * np.pi * np.random.uniform(1, 3) * t)
    theta = theta_amp * np.sin(2 * np.pi * 6 * t)
    alpha = alpha_amp * np.sin(2 * np.pi * np.random.uniform(9, 11) * t)
    beta = beta_amp * np.sin(2 * np.pi * np.random.uniform(18, 22) * t)
    noise = 0.15 * np.random.randn(CHUNK_SIZE)
    
    return delta + theta + alpha + beta + noise

def generate_long_eeg_signal(total_min, unfocused_min):
    """
    Generates a long, continuous EEG signal with a defined unfocused period at the start.
    """
    print(f"Generating a {total_min}-minute EEG signal...")
    
    total_samples = total_min * 60 * FS
    num_chunks = total_samples // CHUNK_SIZE
    
    # Determine the chunk at which the focus state changes
    transition_chunk = (unfocused_min * 60 * FS) // CHUNK_SIZE
    
    # --- Set the probabilities for being focused ---
    # REVERSED: Low probability of focus at the start, high probability later.
    prob_focused_initial = 0.20  # 20% chance of being in focus for the first 8 mins
    prob_focused_later = 0.90    # 90% chance of being in focus after 8 mins

    all_chunks = []
    labels = [] # To keep track of the ground truth for each chunk
    
    for i in range(num_chunks):
        is_currently_focused = False
        if i < transition_chunk:
            # We are in the first 8 minutes (low focus period)
            if np.random.random() < prob_focused_initial:
                is_currently_focused = True
        else:
            # We are after the 8-minute mark (high focus period)
            if np.random.random() < prob_focused_later:
                is_currently_focused = True
        
        # Generate the data chunk based on the decided state
        chunk_data = simulate_eeg_chunk(focus=is_currently_focused)
        all_chunks.append(chunk_data)
        labels.append(1 if is_currently_focused else 0)

    # Combine all the small chunks into one continuous signal
    eeg_signal = np.concatenate(all_chunks)
    time_array = np.arange(len(eeg_signal)) / FS
    
    print("✅ Signal generation complete.")
    return time_array, eeg_signal, np.array(labels)

def plot_signal_overview(time_array, eeg_signal):
    """Plots the full generated signal to show the overall characteristics."""
    plt.style.use('seaborn-v0_8-whitegrid')
    fig, ax = plt.subplots(figsize=(15, 6))
    
    ax.plot(time_array / 60, eeg_signal, lw=0.5, color='royalblue')
    
    # Add a vertical line and text to mark the transition
    ax.axvline(x=UNFOCUSED_DURATION_MIN, color='r', linestyle='--', lw=2, label=f'{UNFOCUSED_DURATION_MIN} min Transition Point')
    
    # UPDATED LABELS to reflect the new pattern
    ax.text(UNFOCUSED_DURATION_MIN - 0.5, np.max(eeg_signal)*0.8, 'Low Focus Period', color='darkred', ha='right', fontsize=12)
    ax.text(UNFOCUSED_DURATION_MIN + 0.5, np.max(eeg_signal)*0.8, 'High Focus Period', color='darkgreen', ha='left', fontsize=12)
    
    ax.set_title('Generated 20-Minute EEG Signal (Unfocused First)', fontsize=16)
    ax.set_xlabel('Time (minutes)', fontsize=12)
    ax.set_ylabel('Amplitude (µV)', fontsize=12)
    ax.legend()
    plt.tight_layout()
    plt.show()


# --- Main execution ---
if __name__ == '__main__':
    # 1. Generate the data
    t, signal, ground_truth_labels = generate_long_eeg_signal(
        total_min=TOTAL_DURATION_MIN,
        unfocused_min=UNFOCUSED_DURATION_MIN
    )
    
    # 2. Save the data to a file for later use
    output_filename = 'simulated_20min_eeg_unfocused_first.npz'
    np.savez_compressed(
        output_filename, 
        time=t, 
        signal=signal, 
        labels=ground_truth_labels,
        fs=FS,
        chunk_size=CHUNK_SIZE
    )
    print(f"💾 Data saved to '{output_filename}'")

    # 3. Visualize the generated signal
    plot_signal_overview(t, signal)