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
      // **FIX:** Do NOT clear attentionHistory or sessionEvents here.
      // They are needed for the SessionSummary component.
      // They will be reset automatically when a new session starts.
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
        const { signal, status } = data;

        // Process EEG signal into multi-channel format
        const timestamp = Date.now();
        const newEegPoint = EEG_CHANNELS.reduce((acc, channel, index) => {
          const variation = 1 + (index * 0.05 - 0.05); // Slight scaling for Fp1, Fp2, Cz
          acc[channel] = {
            beta: signal.reduce((sum, val) => sum + Math.abs(val), 0) / signal.length * variation,
          };
          return acc;
        }, { timestamp });

        setEegData((prev) => [...prev.slice(-49), newEegPoint]);

        // Calculate attention dynamically based on EEG data
        const frontalBeta = (newEegPoint.Fp1.beta + newEegPoint.Fp2.beta) / 2;
        let currentAttention = Math.min(100, Math.max(0, frontalBeta * 50));
        // Adjust attention based on status with variability
        if (status === "FOCUSED") {
          currentAttention = Math.min(90, Math.max(70, currentAttention + (Math.random() * 10 - 5))); // 70–90%
        } else {
          currentAttention = Math.min(40, Math.max(20, currentAttention - (Math.random() * 10 - 5))); // 30–50%
        }
        setAttention(currentAttention);

        // Add to attention history every message for continuous graph
        setAttentionHistory((prev) => {
          const newHistory = [...prev, { timestamp, attention: Math.round(currentAttention) }];
          // console.log("Attention history updated:", { timestamp, attention: Math.round(currentAttention), historyLength: newHistory.length });
          return newHistory.length > 600 ? newHistory.slice(-600) : newHistory; // Limit to last 600 points (~240s)
        });
        lastAttentionUpdateRef.current = timestamp;

        // Update focus streak
        setFocusStreak((prevStreak) => {
          if (status === "FOCUSED") {
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
          if (status === "FOCUSED" || status === "NOT FOCUSED") {
            const eventType = status === "FOCUSED" ? "Peak Focus" : "Major Distraction";
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

    // Fallback to simulate attention updates if WebSocket is slow
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastAttentionUpdateRef.current >= 1000) { // 1s without update
        setAttention((prev) => {
          const newAttention = Math.min(100, Math.max(0, prev + (Math.random() * 10 - 5)));
          setAttentionHistory((prevHistory) => {
            const newHistory = [...prevHistory, { timestamp: now, attention: Math.round(newAttention) }];
            // console.log("Fallback attention update:", { timestamp: now, attention: Math.round(newAttention), historyLength: newHistory.length });
            return newHistory.length > 600 ? newHistory.slice(-600) : newHistory;
          });
          return newAttention;
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
    return Math.min(100, Math.max(0, frontalBeta * 50));
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
