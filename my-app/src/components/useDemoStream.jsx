import { useState, useEffect, useMemo, useRef, useCallback } from "react";

const EEG_CHANNELS = ["Fp1", "Fp2", "Cz"]; // Reduced to match visualization in EegStreamChart

export default function useDemoStream(isStreaming = false) {
  const [attention, setAttention] = useState(0); // Starts at 0 for idle, set to 80 on session start
  const targetAttentionRef = useRef(0);
  const [eegData, setEegData] = useState([]);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [attentionHistory, setAttentionHistory] = useState([]);
  const [focusStreak, setFocusStreak] = useState(0);
  const [ws, setWs] = useState(null);
  const lastEventTimestampRef = useRef(0);
  const lastAttentionUpdateRef = useRef(Date.now());

  // --- NEW: Function to allow external components to boost attention ---
  const setAttentionTarget = useCallback((value) => {
    if (typeof value === 'number') {
      targetAttentionRef.current = Math.max(0, Math.min(100, value));
    }
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      console.log("Session ended. Final sessionEvents:", sessionEvents);
      // Reset to 0 for the idle screen
      setAttention(0);
      targetAttentionRef.current = 0;
      setFocusStreak(0);
      if (ws) {
        ws.close();
        setWs(null);
      }
      return;
    }

    // --- SESSION START ---
    const initialAttention = 80;
    setAttention(initialAttention);
    targetAttentionRef.current = initialAttention;

    const smoothingInterval = setInterval(() => {
      setAttention(prev => {
        const target = targetAttentionRef.current;
        if (Math.abs(prev - target) < 0.5) return target;
        return prev + (target - prev) * 0.05;
      });
    }, 50);

    const decayInterval = setInterval(() => {
        targetAttentionRef.current = Math.max(10, targetAttentionRef.current - 0.25);
    }, 250);

    const startTimestamp = Date.now();
    setSessionEvents([{ timestamp: startTimestamp, event: "Session Started", attention: Math.round(initialAttention) }]);
    setAttentionHistory([{ timestamp: startTimestamp, attention: Math.round(initialAttention) }]);
    lastEventTimestampRef.current = startTimestamp;
    lastAttentionUpdateRef.current = startTimestamp;

    const websocket = new WebSocket("ws://localhost:8765");
    setWs(websocket);

    websocket.onopen = () => console.log("🟢 Connected to WebSocket server");

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { eeg_buffer, current_focus_text } = data;

        if (!eeg_buffer || !Array.isArray(eeg_buffer)) {
          console.error("Invalid or missing eeg_buffer data:", eeg_buffer);
          return;
        }

        const timestamp = Date.now();
        const meanAbs = eeg_buffer.reduce((sum, val) => sum + Math.abs(val), 0) / eeg_buffer.length;
        const scaledBeta = (meanAbs / 1000) * 0.5;

        const newEegPoint = EEG_CHANNELS.reduce((acc, channel, index) => {
          const variation = 1 + (index * 0.05 - 0.05);
          acc[channel] = { beta: scaledBeta * variation };
          return acc;
        }, { timestamp });

        setEegData((prev) => [...prev.slice(-49), newEegPoint]);

        const frontalBeta = (newEegPoint.Fp1.beta + newEegPoint.Fp2.beta) / 2;
        let currentTargetAttention = Math.min(100, Math.max(0, frontalBeta * 100));

        if (current_focus_text === "FOCUSED") {
          currentTargetAttention = Math.min(90, Math.max(70, currentTargetAttention + (Math.random() * 6 - 3)));
        } else {
          currentTargetAttention = Math.min(40, Math.max(20, currentTargetAttention - (Math.random() * 6 - 3)));
        }
        
        targetAttentionRef.current = currentTargetAttention;

        setAttentionHistory((prev) => {
          const newHistory = [...prev, { timestamp, attention: Math.round(currentTargetAttention) }];
          return newHistory.length > 600 ? newHistory.slice(-600) : newHistory;
        });
        lastAttentionUpdateRef.current = timestamp;

        setFocusStreak((prevStreak) => {
          if (current_focus_text === "FOCUSED") {
            return prevStreak + 0.4;
          } else {
            if (prevStreak > 5) {
              setSessionEvents((prevEvents) => [
                {
                  timestamp: Date.now(),
                  event: `Focus Streak Lost (${prevStreak.toFixed(0)}s)`,
                  attention: Math.round(currentTargetAttention),
                },
                ...prevEvents,
              ]);
            }
            return 0;
          }
        });

        const now = Date.now();
        if (now - lastEventTimestampRef.current >= 10000) {
          if (current_focus_text === "FOCUSED" || current_focus_text === "NOT FOCUSED") {
            const eventType = current_focus_text === "FOCUSED" ? "Peak Focus" : "Major Distraction";
            setSessionEvents((prev) => [
              { timestamp, event: eventType, attention: Math.round(currentTargetAttention) },
              ...prev,
            ]);
            lastEventTimestampRef.current = now;
          }
        }
      } catch (error) {
        console.error("Error processing WebSocket data:", error);
      }
    };

    websocket.onclose = () => console.log("🔴 WebSocket connection closed");
    websocket.onerror = (error) => console.error("WebSocket error:", error);

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastAttentionUpdateRef.current >= 1000) {
        setAttentionHistory((prevHistory) => {
          const newHistory = [...prevHistory, { timestamp: now, attention: Math.round(targetAttentionRef.current) }];
          return newHistory.length > 600 ? newHistory.slice(-600) : newHistory;
        });
        
        setEegData((prev) => {
          const fallbackBeta = Math.random() * 0.5;
          const newEegPoint = EEG_CHANNELS.reduce((acc, channel, index) => {
            acc[channel] = { beta: fallbackBeta * (1 + (index * 0.05 - 0.05)) };
            return acc;
          }, { timestamp: now });
          return [...prev.slice(-49), newEegPoint];
        });
        lastAttentionUpdateRef.current = now;
      }
    }, 500);

    return () => {
      websocket.close();
      clearInterval(interval);
      clearInterval(smoothingInterval);
      clearInterval(decayInterval);
    };
  }, [isStreaming, setAttentionTarget]);

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

  return { attention, eegData: formattedEegData, sessionEvents, attentionHistory, focusStreak, rawEeg: eegData, setAttentionTarget };
}