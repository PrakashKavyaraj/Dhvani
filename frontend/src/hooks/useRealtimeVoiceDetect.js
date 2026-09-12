import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useRealtimeVoiceDetect
 *
 * Custom React hook managing:
 * 1. navigator.mediaDevices.getUserMedia microphone stream
 * 2. 16kHz AudioWorklet processor ('/audio-processor.js')
 * 3. Real-time WebSocket connection to backend (/ws/voice-detect)
 * 4. Transferring 250ms Int16 binary PCM chunks every 125ms
 * 5. Receiving live JSON predictions and driving UI risk state
 */
export function useRealtimeVoiceDetect({ onPrediction, backendUrl } = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [liveVolume, setLiveVolume] = useState(0); // 0 to 100 for visualizer
  const [streamResult, setStreamResult] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const wsRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);

  // Derive WebSocket URL
  const resolveWsUrl = useCallback(() => {
    if (backendUrl) return backendUrl;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || '127.0.0.1';
    return `${protocol}//${host}:8000/ws/voice-detect`;
  }, [backendUrl]);

  // Volume meter animation loop
  const updateVolume = useCallback(() => {
    if (analyserRef.current && isStreaming) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128.0;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalizedVol = Math.min(100, Math.round(rms * 280));
      setLiveVolume(normalizedVol);

      animFrameRef.current = requestAnimationFrame(updateVolume);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      animFrameRef.current = requestAnimationFrame(updateVolume);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setLiveVolume(0);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isStreaming, updateVolume]);

  const startStreaming = useCallback(async () => {
    try {
      setStreamError(null);
      setIsConnecting(true);

      // 1. Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // 2. Initialize 16kHz AudioContext
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // 3. Load Dhvani AudioWorklet Processor
      await audioContext.audioWorklet.addModule('/audio-processor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'dhvani-audio-processor');
      workletNodeRef.current = workletNode;

      // 4. Setup Analyser for visual volume feedback
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(analyser);
      source.connect(workletNode);

      // 5. Open WebSocket connection to FastAPI backend
      const wsUrl = resolveWsUrl();
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsStreaming(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'CONNECTED') {
            setSessionInfo(data);
          } else if (data.status === 'STREAMING') {
            setStreamResult(data);
            if (onPrediction) {
              onPrediction(data);
            }
          } else if (data.status === 'BUFFERING') {
            setSessionInfo((prev) => ({ ...prev, ...data }));
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Voice Detect WebSocket error:', err);
        setStreamError('WebSocket connection failed. Ensure backend is running on port 8000.');
        stopStreaming();
      };

      ws.onclose = () => {
        setIsStreaming(false);
        setIsConnecting(false);
      };

      // 6. Connect worklet audio buffer transfers to WebSocket
      workletNode.port.onmessage = (event) => {
        // event.data is raw Int16 ArrayBuffer (4000 samples = 250ms with 125ms stride)
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data);
        }
      };
    } catch (err) {
      console.error('Failed to start live mic streaming:', err);
      setStreamError(err.message || 'Microphone access denied or AudioWorklet failed.');
      stopStreaming();
    }
  }, [resolveWsUrl, onPrediction]);

  const stopStreaming = useCallback(() => {
    // Stop tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    setIsStreaming(false);
    setIsConnecting(false);
    setLiveVolume(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    isStreaming,
    isConnecting,
    streamError,
    liveVolume,
    streamResult,
    sessionInfo,
    startStreaming,
    stopStreaming,
  };
}
