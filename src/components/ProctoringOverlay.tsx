'use client';

import { useState, useEffect, useRef } from 'react';

interface ProctoringProps {
  isActive: boolean;
  onViolation: (type: 'NO_FACE' | 'MULTI_FACE' | 'MIC_SILENT' | 'SCREEN_STOPPED' | 'FULLSCREEN_EXIT' | 'HIGH_NOISE', screenshot?: string, description?: string) => void;
  onMetricsUpdate: (metrics: { faceCount: number; volume: number; isScreenActive: boolean }) => void;
}

export default function ProctoringOverlay({ isActive, onViolation, onMetricsUpdate }: ProctoringProps) {
  const [streams, setStreams] = useState<{ cam: MediaStream | null; screen: MediaStream | null }>({ cam: null, screen: null });
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenshotCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      stopStreams();
      return;
    }

    initProctoring();

    return () => stopStreams();
  }, [isActive]);

  const initProctoring = async () => {
    try {
      // 1. Load Face Detection Library (CDN)
      if (!window.faceapi) {
        await loadScript('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js');
      }
      
      // Initialize TensorFlow WebGL backend to prevent wasm errors
      if (window.faceapi && window.faceapi.tf) {
        try {
          await window.faceapi.tf.setBackend('webgl');
        } catch (e) {
          try { await window.faceapi.tf.setBackend('cpu'); } catch (e2) {}
        }
        await window.faceapi.tf.ready();
      }

      // Load models
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setModelLoaded(true);

      // 2. Request Camera & Audio
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      // 3. Request Screen Share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      
      setStreams({ cam: camStream, screen: screenStream });

      if (videoRef.current) {
        videoRef.current.srcObject = camStream;
      }

      // Audio Analysis Setup
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(camStream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start Detection Loop
      startMonitoringLoop();

      // Monitor Screen Stop
      screenStream.getVideoTracks()[0].onended = () => {
        onViolation('SCREEN_STOPPED');
      };

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Permissions denied');
    }
  };

  const startMonitoringLoop = () => {
    const check = async () => {
      if (!isActive || !modelLoaded || !videoRef.current) return;

      try {
        // 1. Face Detection
        const detections = await window.faceapi.detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions());
        const count = detections.length;
        setFaceCount(count);

        if (count === 0) {
          const screenshot = captureFrame();
          onViolation('NO_FACE', screenshot, 'No face detected during assessment');
        }
        else if (count > 1) {
          const screenshot = captureFrame();
          onViolation('MULTI_FACE', screenshot, `Multiple faces (${count}) detected during assessment`);
        }

        // 2. Audio Level
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const vol = sum / dataArray.length;
          setVolume(vol);

          // Threshold for loud noise (adjust as necessary)
          if (vol > 45) {
             onViolation('HIGH_NOISE');
          }
        }

        onMetricsUpdate({
          faceCount: count,
          volume: volume,
          isScreenActive: streams.screen?.active || false
        });
      } catch (e) {
        console.warn('Face detection cycle failed', e);
      }

      // Throttle to save CPU (check every 2 seconds)
      setTimeout(() => {
        requestRef.current = requestAnimationFrame(check);
      }, 2000);
    };

    requestRef.current = requestAnimationFrame(check);
  };

  // Capture current webcam frame as a compressed JPEG data URI
  const captureFrame = (): string | undefined => {
    if (!videoRef.current) return undefined;
    const canvas = screenshotCanvasRef.current || document.createElement('canvas');
    canvas.width = 320; // Small size for efficiency
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.5); // 50% quality JPEG (~20-40KB)
  };

  const stopStreams = () => {
    if (streams.cam) streams.cam.getTracks().forEach(t => t.stop());
    if (streams.screen) streams.screen.getTracks().forEach(t => t.stop());
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    setStreams({ cam: null, screen: null });
  };

  const loadScript = (src: string) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  if (!isActive) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '240px',
      zIndex: 10000000,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Facecam Preview */}
      <div style={{
        position: 'relative',
        height: '180px',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#000',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '2px solid var(--primary)'
      }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* Hidden canvas for screenshot capture */}
        <canvas ref={screenshotCanvasRef} style={{ display: 'none' }} width={320} height={240} />
        
        {/* Indicators Overlay */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ 
            background: 'rgba(0,0,0,0.6)', 
            padding: '4px 8px', 
            borderRadius: '6px', 
            fontSize: '10px', 
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4444', animation: 'pulse 1s infinite' }}></div>
            LIVE MONITORING
          </div>
        </div>

        {/* Status Pills */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          display: 'flex',
          gap: '6px'
        }}>
           <div style={{ background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#fff' }}>
             👤 {faceCount !== null ? faceCount : '...'}
           </div>
           <div style={{ background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#fff' }}>
             🎤 {Math.round(volume)}%
           </div>
        </div>
      </div>

      {error && (
        <div style={{ 
          background: '#ef4444', 
          color: '#fff', 
          padding: '12px', 
          borderRadius: '12px', 
          fontSize: '12px', 
          fontWeight: 600,
          textAlign: 'center'
        }}>
          ⚠️ {error}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

declare global {
  interface Window {
    faceapi: any;
  }
}
