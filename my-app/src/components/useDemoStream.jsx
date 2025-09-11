import { useState, useEffect, useMemo, useCallback, useRef } from "react";

const EEG_CHANNELS = ["Fp1", "Fp2", "Cz"]; // Reduced to match visualization in EegStreamChart

export default function useDemoStream(isStreaming = false) {
  const [attention, setAttention] = useState(0);
  const [eegData, setEegData] = useState([]);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [attentionHistory, setAttentionHistory] = useState([]);
  const [focusStreak, setFocusStreak] = useState(0);
  const [ws, setWs] = useState(null);
  const lastEventTimestampRef = useRef(0);
  const lastAttentionUpdateRef = useRef(Date.now());

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
        // Scale beta values to be more visible (e.g., normalize to [0, 1])
        const meanAbs = eeg_buffer.reduce((sum, val) => sum + Math.abs(val), 0) / eeg_buffer.length;
        const scaledBeta = (meanAbs / 1000) * 0.5; // Adjust scaling factor as needed based on eeg_buffer range

        const newEegPoint = EEG_CHANNELS.reduce((acc, channel, index) => {
          const variation = 1 + (index * 0.05 - 0.05); // Slight scaling for Fp1, Fp2, Cz
          acc[channel] = {
            beta: scaledBeta * variation,
          };
          return acc;
        }, { timestamp });

        setEegData((prev) => {
          const newData = [...prev.slice(-49), newEegPoint];
          console.log("Updated eegData:", newData[newData.length - 1]); // Log latest data point
          return newData;
        });

        // Calculate attention dynamically based on EEG data
        const frontalBeta = (newEegPoint.Fp1.beta + newEegPoint.Fp2.beta) / 2;
        let currentAttention = Math.min(100, Math.max(0, frontalBeta * 100)); // Adjusted scaling
        if (current_focus_text === "FOCUSED") {
          currentAttention = Math.min(90, Math.max(70, currentAttention + (Math.random() * 10 - 5))); // 70–90%
        } else {
          currentAttention = Math.min(40, Math.max(20, currentAttention - (Math.random() * 10 - 5))); // 20–40%
        }
        setAttention(currentAttention);

        // Add to attention history every message for continuous graph
        setAttentionHistory((prev) => {
          const newHistory = [...prev, { timestamp, attention: Math.round(currentAttention) }];
          return newHistory.length > 600 ? newHistory.slice(-600) : newHistory; // Limit to last 600 points (~240s)
        });
        lastAttentionUpdateRef.current = timestamp;

        // Update focus streak
        setFocusStreak((prevStreak) => {
          if (current_focus_text === "FOCUSED") {
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
          if (current_focus_text === "FOCUSED" || current_focus_text === "NOT FOCUSED") {
            const eventType = current_focus_text === "FOCUSED" ? "Peak Focus" : "Major Distraction";
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
          const newAttention = Math.min(100, Math.max(0, prev + (Math.random() * 10 - 5)));
          setAttentionHistory((prevHistory) => {
            const newHistory = [...prevHistory, { timestamp: now, attention: Math.round(newAttention) }];
            return newHistory.length > 600 ? newHistory.slice(-600) : newHistory;
          });
          return newAttention;
        });
        // Add fallback EEG data
        setEegData((prev) => {
          const timestamp = now;
          const fallbackBeta = Math.random() * 0.5; // Random value in [0, 0.5]
          const newEegPoint = EEG_CHANNELS.reduce((acc, channel, index) => {
            const variation = 1 + (index * 0.05 - 0.05);
            acc[channel] = { beta: fallbackBeta * variation };
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

  const calculateAttention = useCallback((eegPoint) => {
    if (!eegPoint) return 50;
    const frontalBeta = (eegPoint.Fp1.beta + eegPoint.Fp2.beta) / 2;
    return Math.min(100, Math.max(0, frontalBeta * 100)); // Adjusted scaling
  }, []);

  const latestAttention = useMemo(() => {
    const latestPoint = eegData[eegData.length - 1];
    return latestPoint ? calculateAttention(latestPoint) : attention;
  }, [eegData, attention, calculateAttention]);

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

  return { attention: latestAttention, eegData: formattedEegData, sessionEvents, attentionHistory, focusStreak, rawEeg: eegData };
}
