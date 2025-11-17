import { useState, useEffect, useRef } from 'react';

// The 3 URLs for your Python 3.11 hardware script
const EEG_URL = 'ws://localhost:8765';
const VERDICT_URL = 'ws://localhost:8766';
const GAZE_URL = 'ws://localhost:8767'; // 2-way Gaze port

const MAX_CHART_POINTS = 50;

/**
 * Custom hook to manage all 3 hardware WebSockets
 * (EEG, Verdict, and Gaze)
 */
const useWebSocketStream = (shouldConnect) => {
  // --- Data States ---
  const [eegData, setEegData] = useState([]);
  const [latestVerdict, setLatestVerdict] = useState(null);
  const [latestGaze, setLatestGaze] = useState({ status: 'N/A' });

  // --- Connection Status States ---
  const [eegStatus, setEegStatus] = useState('disconnected');
  const [verdictStatus, setVerdictStatus] = useState('disconnected');
  const [gazeStatus, setGazeStatus] = useState('disconnected');
  const [unifiedConnectionStatus, setUnifiedConnectionStatus] = useState('disconnected');

  // --- Refs ---
  const wsRefs = useRef({
    eeg: null,
    verdict: null,
    gaze: null,
  });
  const sampleIndexRef = useRef(0);

  // This helper function creates and manages a single WebSocket
  const connectSocket = (url, type, onMessage) => {
    if (wsRefs.current[type] && wsRefs.current[type].readyState < 2) {
      return wsRefs.current[type];
    }

    const ws = new WebSocket(url);
    wsRefs.current[type] = ws;

    const setStatus =
      type === 'eeg' ? setEegStatus : type === 'verdict' ? setVerdictStatus : setGazeStatus;

    setStatus('connecting');

    ws.onopen = () => {
      console.log(`WebSocket Connected: ${type}`);
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data); // Pass to specific handler
      } catch (e) {
        console.error(`Error parsing ${type} message:`, e);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket Error (${type}):`, error);
      setStatus('error');
    };

    ws.onclose = (event) => {
      console.log(`WebSocket Closed: ${type}`, event.code, event.reason);
      setStatus('disconnected');
      wsRefs.current[type] = null;
    };

    return ws;
  };

  // --- Specific Message Handlers ---

  const handleEegMessage = (data) => {
    if (data.type === 'eeg_sample') {
      const rawValue = data.value;
      sampleIndexRef.current += 1;
      setEegData((prevData) => {
        const newEntry = {
          timestamp: Date.now(),
          time: sampleIndexRef.current,
          value: rawValue,
        };
        return [...prevData, newEntry].slice(-MAX_CHART_POINTS);
      });
    }
  };

  const handleVerdictMessage = (data) => {
    if (data.type === 'verdict') {
      console.log('Received Verdict:', data);
      setLatestVerdict({
        state: data.focus_state,
        confidence: data.confidence,
        beta_activity: data.beta_activity,
        timestamp: data.analysis_timestamp,
        session: data.session,
      });
    }
  };

  const handleGazeMessage = (data) => {
    if (data.type === 'gaze_update') {
      // We are RECEIVING the processed gaze status
      setLatestGaze({
        status: data.status,
        timestamp: data.timestamp,
      });
    }
  };

  // --- Main Connection Effect ---
  useEffect(() => {
    if (shouldConnect) {
      connectSocket(EEG_URL, 'eeg', handleEegMessage);
      connectSocket(VERDICT_URL, 'verdict', handleVerdictMessage);
      connectSocket(GAZE_URL, 'gaze', handleGazeMessage);
    } else {
      Object.values(wsRefs.current).forEach((ws) => {
        if (ws) ws.close(1000, 'User disconnected');
      });
      wsRefs.current = { eeg: null, verdict: null, gaze: null };
    }

    return () => {
      Object.values(wsRefs.current).forEach((ws) => {
        if (ws) ws.close(1000, 'Component unmounting');
      });
      wsRefs.current = { eeg: null, verdict: null, gaze: null };
    };
  }, [shouldConnect]);

  // --- Unified Status Effect ---
  useEffect(() => {
    if (eegStatus === 'error' || verdictStatus === 'error' || gazeStatus === 'error') {
      setUnifiedConnectionStatus('error');
    } else if (eegStatus === 'connected' && verdictStatus === 'connected' && gazeStatus === 'connected') {
      setUnifiedConnectionStatus('connected');
    } else if (eegStatus === 'disconnected' && verdictStatus === 'disconnected' && gazeStatus === 'disconnected') {
      setUnifiedConnectionStatus('disconnected');
    } else {
      setUnifiedConnectionStatus('connecting');
    }
  }, [eegStatus, verdictStatus, gazeStatus]);
  
  // --- NEW: Function to SEND the gaze frame ---
  // We can't call this from inside the hook, but the Dashboard can.
  const sendGazeFrame = (base64Frame) => {
    const ws = wsRefs.current.gaze;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'video_frame',
        data: base64Frame
      }));
    }
  };

  return { 
    eegData, 
    latestVerdict, 
    latestGaze, 
    connectionStatus: unifiedConnectionStatus,
    sendGazeFrame // --- NEW: Export the send function ---
  };
};

export default useWebSocketStream;
