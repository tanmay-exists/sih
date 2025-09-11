import { useState, useEffect, useMemo, useRef } from "react";

const EEG_CHANNELS = ["Fp1", "Fp2", "Cz"]; // Reduced to match visualization in EegStreamChart

// --- NEW: Hardcoded attention sequence for predictable demo values ---
// This array has 20 values: 18 are high-focus (60-90) and 2 are low-focus (0-30).
const ATTENTION_SEQUENCE = [75, 82, 68, 88, 79, 15, 85, 90, 71, 83, 66, 77, 89, 28, 74, 81, 70, 86, 76, 84];

export default function useDemoStream(isStreaming = false) {
  const [attention, setAttention] = useState(0);
  const [eegData, setEegData] = useState([]);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [attentionHistory, setAttentionHistory] = useState([]);
  const [focusStreak, setFocusStreak] = useState(0);
  const [ws, setWs] = useState(null);
  const lastEventTimestampRef = useRef(0);
  const lastAttentionUpdateRef = useRef(Date.now());
  const attentionIndexRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      console.log("Session ended. Final sessionEvents:", sessionEvents);
      console.log("Session ended. Final attentionHistory length:", attentionHistory.length, "data:", attentionHistory);
      setFocusStreak(0);
      if (ws) {
        ws.close();
        setWs(null);
      }
      return;
    }

    // Reset attention cycle index
    attentionIndexRef.current = 0;

    // Reset session events and attention history when a new session starts
    const initialAttention = 0;
    const startTimestamp = Date.now();
    setSessionEvents([{ timestamp: startTimestamp, event: "Session Started", attention: Math.round(initialAttention) }]);
    setAttentionHistory([{ timestamp: startTimestamp, attention: Math.round(initialAttention) }]);
    console.log("Initial session event logged:", { timestamp: startTimestamp, event: "Session Started", attention: Math.round(initialAttention) });
    lastEventTimestampRef.current = startTimestamp;
    lastAttentionUpdateRef.current = startTimestamp;

    // Initialize WebSocket connection
    const websocket = new WebSocket("ws://localhost:8765");
    setWs(websocket);

    websocket.onopen = () => {
      console.log("🟢 Connected to WebSocket server");
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { eeg_buffer, current_focus_text } = data;

        // Validate eeg_buffer
        if (!eeg_buffer || !Array.isArray(eeg_buffer)) {
          console.error("Invalid or missing eeg_buffer data:", eeg_buffer);
          return;
        }

        // Process EEG signal into multi-channel format
        const timestamp = Date.now();
        
        const mean = eeg_buffer.reduce((sum, val) => sum + val, 0) / eeg_buffer.length;
        const scaledMean = (mean / 500);

        const newEegPoint = EEG_CHANNELS.reduce((acc, channel, index) => {
            const noise = (Math.random() - 0.5) * 0.2; 
            const variation = 1 + (index * 0.1 - 0.1);
            acc[channel] = {
                beta: Math.max(-2, Math.min(2, scaledMean * variation + noise)),
            };
            return acc;
        }, { timestamp });

        setEegData((prev) => {
          const newData = [...prev.slice(-49), newEegPoint];
          return newData;
        });
        
        // --- FIX: Use the hardcoded attention sequence ---
        const currentAttention = ATTENTION_SEQUENCE[attentionIndexRef.current];
        attentionIndexRef.current = (attentionIndexRef.current + 1) % ATTENTION_SEQUENCE.length;
        setAttention(currentAttention);

        // Add to attention history every message for continuous graph
        setAttentionHistory((prev) => {
          const newHistory = [...prev, { timestamp, attention: Math.round(currentAttention) }];
          return newHistory.length > 600 ? newHistory.slice(-600) : newHistory; // Limit to last 600 points (~240s)
        });
        lastAttentionUpdateRef.current = timestamp;

        // Update focus streak
        setFocusStreak((prevStreak) => {
        // Use the new attention value to determine focus for streak purposes
          if (currentAttention >= 60) {
            return prevStreak + 0.4; // Increment by 0.4s per chunk
          } else {
            if (prevStreak > 5) {
              setSessionEvents((prevEvents) => {
                const newEvents = [
                  {
                    timestamp: Date.now(),
                    event: `Focus Streak Lost (${prevStreak.toFixed(0)}s)`,
                    attention: Math.round(currentAttention),
                  },
                  ...prevEvents,
                ];
                console.log("Focus streak lost event:", newEvents[0]);
                return newEvents;
              });
            }
            return 0;
          }
        });

        // Log significant events every 10 seconds
        const now = Date.now();
        if (now - lastEventTimestampRef.current >= 10000) { // 10 seconds
          // Also base event type on the new attention value
          const eventType = currentAttention >= 75 ? "Peak Focus" : "Major Distraction";
          setSessionEvents((prev) => {
            const newEvents = [
              { timestamp, event: eventType, attention: Math.round(currentAttention) },
              ...prev,
            ];
            console.log("Significant event logged:", newEvents[0]);
            return newEvents;
          });
          lastEventTimestampRef.current = now;
        }
      } catch (error) {
        console.error("Error processing WebSocket data:", error);
      }
    };

    websocket.onclose = () => {
      console.log("🔴 WebSocket connection closed");
      setWs(null);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Fallback to simulate EEG data if WebSocket is slow
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastAttentionUpdateRef.current >= 1000) { // 1s without update
        setAttention((prev) => {
          // Also use the sequence in the fallback
          const newAttention = ATTENTION_SEQUENCE[attentionIndexRef.current];
          attentionIndexRef.current = (attentionIndexRef.current + 1) % ATTENTION_SEQUENCE.length;
          setAttentionHistory((prevHistory) => {
            const newHistory = [...prevHistory, { timestamp: now, attention: Math.round(newAttention) }];
            return newHistory.length > 600 ? newHistory.slice(-600) : newHistory;
          });
          return newAttention;
        });
        // Add fallback EEG data
        setEegData((prev) => {
          const timestamp = now;
          const fallbackValue = (Math.random() - 0.5) * 4;
          const newEegPoint = EEG_CHANNELS.reduce((acc, channel, index) => {
            const channelOffset = (index - 1) * 0.3; 
            acc[channel] = { beta: Math.max(-2, Math.min(2, fallbackValue + channelOffset)) };
            return acc;
          }, { timestamp });
          const newData = [...prev.slice(-49), newEegPoint];
          console.log("Fallback EEG data:", newData[newData.length - 1]);
          return newData;
        });
        lastAttentionUpdateRef.current = now;
      }
    }, 500);

    return () => {
      websocket.close();
      clearInterval(interval);
    };
  }, [isStreaming]);

  const formattedEegData = useMemo(
    () =>
      eegData.map((d) => ({
        time: new Date(d.timestamp).toLocaleTimeString(),
        Fp1: d.Fp1.beta,
        Fp2: d.Fp2.beta,
        Cz: d.Cz.beta,
      })),
    [eegData]
  );

  return { attention, eegData: formattedEegData, sessionEvents, attentionHistory, focusStreak, rawEeg: eegData };
}
