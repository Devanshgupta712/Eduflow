'use client';

import { useState, useRef, useEffect } from 'react';

interface PreflightChecklistProps {
    title: string;
    onReady: (streams: { cam: MediaStream; screen: MediaStream }) => void;
    onCancel: () => void;
}

export default function PreflightChecklist({ title, onReady, onCancel }: PreflightChecklistProps) {
    const [camGranted, setCamGranted] = useState(false);
    const [fullscreenActive, setFullscreenActive] = useState(false);
    const [screenGranted, setScreenGranted] = useState(false);

    const [camError, setCamError] = useState('');
    const [screenError, setScreenError] = useState('');

    const [camStream, setCamStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // We NO LONGER stop tracks here because they are passed to the parent for the actual test.
            // This prevents the "Security Alert" or re-requesting permissions.
        };
    }, []);

    // Step 1: Request Camera
    const requestCamera = async () => {
        setCamError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setCamStream(stream);
            setCamGranted(true);
            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
            }
        } catch (err: any) {
            setCamError(err.message || 'Camera permission denied. Please allow camera access in your browser settings.');
        }
    };

    // Step 2: Enter Fullscreen
    const requestFullscreen = async () => {
        try {
            if (containerRef.current) {
                await containerRef.current.requestFullscreen();
                setFullscreenActive(true);
            }
        } catch {
            // Some browsers need document.documentElement
            try {
                await document.documentElement.requestFullscreen();
                setFullscreenActive(true);
            } catch {
                setFullscreenActive(false);
            }
        }
    };

    // Monitor fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setFullscreenActive(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Step 3: Request Screen Share
    const requestScreenShare = async () => {
        setScreenError('');
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            setScreenStream(stream);
            setScreenGranted(true);
            // Monitor if user stops sharing
            stream.getVideoTracks()[0].onended = () => {
                setScreenGranted(false);
                setScreenStream(null);
            };
        } catch (err: any) {
            setScreenError(err.message || 'Screen sharing denied. Please share your entire screen.');
        }
    };

    const allReady = camGranted && fullscreenActive && screenGranted;

    const handleEnter = () => {
        if (allReady && camStream && screenStream) {
            onReady({ cam: camStream, screen: screenStream });
        }
    };

    const handleCancel = () => {
        camStream?.getTracks().forEach(t => t.stop());
        screenStream?.getTracks().forEach(t => t.stop());
        if (document.fullscreenElement) document.exitFullscreen();
        onCancel();
    };

    return (
        <div ref={containerRef} style={{
            position: 'fixed', inset: 0, zIndex: 9999999,
            background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                maxWidth: '560px', width: '100%',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '40px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                    <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>
                        Secure Assessment Setup
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
                        {title}<br />
                        Please complete all security checks before entering.
                    </p>
                </div>

                {/* Checklist Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
                    {/* Step 1: Camera */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '16px 20px', borderRadius: '16px',
                        background: camGranted ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${camGranted ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        transition: 'all 0.3s'
                    }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: camGranted ? '#10b981' : 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', flexShrink: 0, transition: 'all 0.3s'
                        }}>
                            {camGranted ? '✅' : '📷'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>Camera & Microphone</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
                                {camGranted ? 'Camera access granted' : 'Required for face monitoring'}
                            </div>
                            {camError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>⚠️ {camError}</div>}
                        </div>
                        {!camGranted && (
                            <button onClick={requestCamera} style={{
                                padding: '8px 18px', borderRadius: '10px', border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                                transition: 'transform 0.2s', flexShrink: 0
                            }}>
                                Allow
                            </button>
                        )}
                    </div>

                    {/* Step 2: Screen Share */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '16px 20px', borderRadius: '16px',
                        background: screenGranted ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${screenGranted ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        opacity: camGranted ? 1 : 0.4,
                        pointerEvents: camGranted ? 'auto' : 'none',
                        transition: 'all 0.3s'
                    }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: screenGranted ? '#10b981' : 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', flexShrink: 0, transition: 'all 0.3s'
                        }}>
                            {screenGranted ? '✅' : '🖥️'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>Screen Sharing</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
                                {screenGranted ? 'Screen sharing active' : 'Share your entire screen for monitoring'}
                            </div>
                            {screenError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>⚠️ {screenError}</div>}
                        </div>
                        {!screenGranted && (
                            <button onClick={requestScreenShare} style={{
                                padding: '8px 18px', borderRadius: '10px', border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                                transition: 'transform 0.2s', flexShrink: 0
                            }}>
                                Share
                            </button>
                        )}
                    </div>

                    {/* Step 3: Fullscreen */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '16px 20px', borderRadius: '16px',
                        background: fullscreenActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${fullscreenActive ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        opacity: screenGranted ? 1 : 0.4,
                        pointerEvents: screenGranted ? 'auto' : 'none',
                        transition: 'all 0.3s'
                    }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: fullscreenActive ? '#10b981' : 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', flexShrink: 0, transition: 'all 0.3s'
                        }}>
                            {fullscreenActive ? '✅' : '🖥️'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>Fullscreen Mode</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
                                {fullscreenActive ? 'Fullscreen active' : 'Required to prevent tab switching'}
                            </div>
                        </div>
                        {!fullscreenActive && (
                            <button onClick={requestFullscreen} style={{
                                padding: '8px 18px', borderRadius: '10px', border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                                transition: 'transform 0.2s', flexShrink: 0
                            }}>
                                Enable
                            </button>
                        )}
                    </div>
                </div>

                {/* Camera Preview */}
                {camGranted && (
                    <div style={{
                        marginBottom: '24px', borderRadius: '16px', overflow: 'hidden',
                        height: '140px', background: '#000', border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <video ref={videoPreviewRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                )}

                {/* Progress Bar */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600 }}>Setup Progress</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700 }}>
                            {[camGranted, fullscreenActive, screenGranted].filter(Boolean).length}/3
                        </span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '10px',
                            background: allReady
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                            width: `${([camGranted, fullscreenActive, screenGranted].filter(Boolean).length / 3) * 100}%`,
                            transition: 'width 0.5s ease'
                        }} />
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleCancel} style={{
                        flex: 1, padding: '14px', borderRadius: '14px',
                        border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                        color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '14px', cursor: 'pointer'
                    }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleEnter}
                        disabled={!allReady}
                        style={{
                            flex: 2, padding: '14px', borderRadius: '14px', border: 'none',
                            background: allReady
                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                : 'rgba(255,255,255,0.05)',
                            color: allReady ? '#fff' : 'rgba(255,255,255,0.3)',
                            fontWeight: 800, fontSize: '15px',
                            cursor: allReady ? 'pointer' : 'not-allowed',
                            transition: 'all 0.3s',
                            boxShadow: allReady ? '0 8px 25px rgba(16,185,129,0.3)' : 'none'
                        }}
                    >
                        {allReady ? '🚀 Enter Assessment' : '🔒 Complete All Steps'}
                    </button>
                </div>
            </div>
        </div>
    );
}
