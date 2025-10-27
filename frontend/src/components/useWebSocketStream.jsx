import { useState, useEffect, useRef } from 'react';

const WEBSOCKET_URL = 'ws://localhost:8000/neuro/ws/eeg';
const MAX_CHART_POINTS = 50;

const useWebSocketStream = (shouldConnect) => {
  const [eegData, setEegData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [latestVerdict, setLatestVerdict] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const sampleIndexRef = useRef(0);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (!shouldConnect || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setConnectionStatus('disconnected');
      }
      return;
    }
    setConnectionStatus('connecting');
    const ws = new WebSocket(`${WEBSOCKET_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log('WebSocket Connected to Backend');
      setConnectionStatus('connected');
      sampleIndexRef.current = 0;
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'eeg_sample') {
          const rawValue = data.value;
          sampleIndexRef.current += 1;
          setEegData(prevData => {
            const newEntry = {
              timestamp: Date.now(),
              time: sampleIndexRef.current,
              value: rawValue
            };
            return [...prevData, newEntry].slice(-MAX_CHART_POINTS);
          });
        } else if (data.type === 'verdict') {
          console.log('Received Verdict:', data);
          setLatestVerdict({
            state: data.focus_state,
            confidence: data.confidence,
            beta_activity: data.beta_activity,
            timestamp: data.analysis_timestamp,
            session: data.session
          });
        } else if (data.type === 'connection') {
          console.log('Backend Connection Message:', data.message);
        } else if (data.type === 'pong') {
          console.log('Pong received');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setConnectionStatus('error');
    };
    ws.onclose = (event) => {
      console.log('WebSocket Closed:', event.code, event.reason);
      setConnectionStatus('disconnected');
      if (shouldConnect && event.code !== 1000 && !reconnectTimeoutRef.current) {
        console.log('Attempting to reconnect in 3s...');
        reconnectTimeoutRef.current = setTimeout(() => {
          setConnectionStatus('disconnected');
        }, 3000);
      }
    };
    return () => {
      if (wsRef.current === ws) {
        ws.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [shouldConnect, token]);
  return { eegData, connectionStatus, latestVerdict };
};

export default useWebSocketStream;
