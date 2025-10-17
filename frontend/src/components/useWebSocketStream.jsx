import { useState, useEffect, useRef } from 'react';
// Configuration matches the Python backend (ws://localhost:8765)
const WEBSOCKET_URL = 'ws://localhost:8765';
const MAX_CHART_POINTS = 50; // Max points to display on the live EEG chart
const useWebSocketStream = (shouldConnect) => {
    const [eegData, setEegData] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
    const [latestVerdict, setLatestVerdict] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null); // For managing reconnect attempts
    const sampleIndexRef = useRef(0); // Counter for generating chart X-axis
    useEffect(() => {
        // Cleanup previous timeout if exists
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        // 1. Connection Management
        if (!shouldConnect) {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
                setConnectionStatus('disconnected');
            }
            return;
        }
        setConnectionStatus('connecting');
        const ws = new WebSocket(WEBSOCKET_URL);
        wsRef.current = ws;
        ws.onopen = () => {
            console.log('WebSocket Connected to Backend');
            setConnectionStatus('connected');
            sampleIndexRef.current = 0; // Reset sample counter on reconnect
        };
        // 2. Message Handling
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
               
                if (data.type === 'eeg_sample') {
                    // Update live EEG chart data
                    const rawValue = data.value;
                    sampleIndexRef.current += 1;
                   
                    setEegData(prevData => {
                        const newEntry = {
                            timestamp: Date.now(), // Use real timestamp for better accuracy
                            time: sampleIndexRef.current, // Simple index for X-axis (or use timestamp if preferred)
                            value: rawValue // Single channel from backend
                        };
                       
                        const nextData = [...prevData, newEntry];
                       
                        // Limit data points for performance
                        return nextData.slice(-MAX_CHART_POINTS);
                    });
                   
                } else if (data.type === 'verdict') {
                    // Update focus verdict (attention score)
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
                    // Handle pong for keep-alive (optional logging)
                    console.log('Pong received');
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        // 3. Error and Closure
        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            setConnectionStatus('error');
        };
        ws.onclose = (event) => {
            console.log('WebSocket Closed:', event.code, event.reason);
            setConnectionStatus('disconnected');
            // Basic reconnect attempt (only if shouldConnect and not clean close)
            if (shouldConnect && event.code !== 1000 && !reconnectTimeoutRef.current) {
                console.log('Attempting to reconnect in 3s...');
                reconnectTimeoutRef.current = setTimeout(() => {
                    // Trigger re-run of effect by returning to this useEffect (no recursive call)
                    setConnectionStatus('disconnected'); // This will re-trigger the effect
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
    }, [shouldConnect]); // Depend only on shouldConnect to re-run on changes
    return { eegData, connectionStatus, latestVerdict };
};
export default useWebSocketStream;
