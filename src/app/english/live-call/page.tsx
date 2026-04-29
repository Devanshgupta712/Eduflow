'use client';

import { useState, useRef, useEffect } from 'react';
import { apiFetch, API_BASE, getToken } from '@/lib/api';
import Link from 'next/link';

export default function LiveCallPage() {
    const [callStatus, setCallStatus] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
    const [conversation, setConversation] = useState<{ role: string; content: string }[]>([]);
    const [duration, setDuration] = useState(0);

    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const timerRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initialize Speech Synthesis
    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthRef.current = window.speechSynthesis;
        }
        return () => {
            if (synthRef.current) synthRef.current.cancel();
            if (timerRef.current) clearInterval(timerRef.current);
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversation]);

    const startCall = () => {
        setConversation([]);
        setDuration(0);
        setCallStatus('THINKING');
        
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        
        // Initial Greeting
        const greeting = "Hi there! I'm your English Coach. How are you doing today?";
        setConversation([{ role: 'assistant', content: greeting }]);
        speakText(greeting);
    };

    const endCall = () => {
        setCallStatus('IDLE');
        if (synthRef.current) synthRef.current.cancel();
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            alert("Speech recognition is not supported in this browser.");
            endCall();
            return;
        }

        setCallStatus('LISTENING');
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop after a pause
        recognition.interimResults = false;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript.trim()) {
                handleUserSpeech(transcript.trim());
            }
        };

        recognition.onerror = () => {
            // If error, just try restarting if we are still supposed to be listening
            if (callStatus === 'LISTENING') {
                setTimeout(startListening, 1000);
            }
        };

        recognition.onend = () => {
            // If it ended but we didn't process speech (maybe silence), restart listening
            // but only if we haven't changed status
            setCallStatus((prev) => {
                if (prev === 'LISTENING') {
                    setTimeout(startListening, 100);
                }
                return prev;
            });
        };

        recognition.start();
        recognitionRef.current = recognition;
    };

    const handleUserSpeech = async (text: string) => {
        // Stop listening
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
        }

        setCallStatus('THINKING');
        const newUserMsg = { role: 'user', content: text };
        setConversation(prev => [...prev, newUserMsg]);

        try {
            const token = getToken();
            const resp = await fetch(`${API_BASE}/api/english/conversation/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    message: text,
                    mode: 'CASUAL', // Can be customized
                    history: conversation.slice(-5),
                    scenario_context: "You are having a live voice call. KEEP RESPONSES VERY SHORT (1-2 sentences maximum). Do not use lists or markdown. Speak naturally like a human on a phone call.",
                }),
            });

            const reader = resp.body?.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    fullResponse += decoder.decode(value, { stream: true });
                }
            }

            setConversation(prev => [...prev, { role: 'assistant', content: fullResponse }]);
            speakText(fullResponse);

        } catch (e) {
            const errorMsg = "Sorry, I had a connection issue.";
            setConversation(prev => [...prev, { role: 'assistant', content: errorMsg }]);
            speakText(errorMsg);
        }
    };

    const speakText = (text: string) => {
        if (!synthRef.current) return;
        setCallStatus('SPEAKING');

        // Clean up markdown/emojis for speech
        const cleanText = text.replace(/[*_#]/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-IN';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to find a good English voice
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-GB'));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => {
            // Once AI finishes speaking, start listening again automatically!
            startListening();
        };

        synthRef.current.speak(utterance);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
            <div className="page-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
                <div>
                    <h1 className="page-title">📞 Live AI Call</h1>
                    <p className="page-subtitle">Real-time voice conversation. No typing allowed.</p>
                </div>
                <Link href="/english" className="btn btn-secondary">← Back</Link>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', position: 'relative', background: '#0f172a' }}>
                
                {/* Visualizer Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                    
                    <div style={{ 
                        width: '140px', height: '140px', borderRadius: '50%', 
                        background: callStatus === 'IDLE' ? '#334155' : callStatus === 'LISTENING' ? '#10b981' : callStatus === 'THINKING' ? '#f59e0b' : '#3b82f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '60px',
                        boxShadow: callStatus !== 'IDLE' ? `0 0 60px ${callStatus === 'LISTENING' ? '#10b98188' : callStatus === 'THINKING' ? '#f59e0b88' : '#3b82f688'}` : 'none',
                        animation: callStatus === 'SPEAKING' ? 'pulse 1s infinite alternate' : callStatus === 'LISTENING' ? 'pulse 2s infinite alternate' : 'none',
                        transition: 'all 0.4s ease'
                    }}>
                        🤖
                    </div>

                    <div style={{ marginTop: '32px', color: '#fff', fontSize: '20px', fontWeight: 700, letterSpacing: '0.05em' }}>
                        {callStatus === 'IDLE' ? 'Ready to Call' : 
                         callStatus === 'LISTENING' ? 'Listening...' : 
                         callStatus === 'THINKING' ? 'Thinking...' : 'Speaking...'}
                    </div>
                    
                    {callStatus !== 'IDLE' && (
                        <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px', fontFamily: 'monospace' }}>
                            {formatTime(duration)}
                        </div>
                    )}
                </div>

                {/* Captions / Transcript Area */}
                {callStatus !== 'IDLE' && (
                    <div style={{ height: '160px', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid #334155', padding: '20px', overflowY: 'auto' }} ref={scrollRef}>
                        {conversation.length === 0 && <div style={{ color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>Connecting...</div>}
                        {conversation.map((msg, i) => (
                            <div key={i} style={{ 
                                marginBottom: '12px', 
                                color: msg.role === 'user' ? '#cbd5e1' : '#fff',
                                fontWeight: msg.role === 'assistant' ? 700 : 500,
                                textAlign: msg.role === 'user' ? 'right' : 'left',
                                fontSize: '15px',
                                lineHeight: 1.5
                            }}>
                                <span style={{ opacity: 0.5, fontSize: '12px', marginRight: '8px' }}>
                                    {msg.role === 'user' ? 'You:' : 'AI:'}
                                </span>
                                {msg.content}
                            </div>
                        ))}
                    </div>
                )}

                {/* Call Controls */}
                <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', gap: '24px', background: '#1e293b' }}>
                    {callStatus === 'IDLE' ? (
                        <button 
                            onClick={startCall}
                            style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#10b981', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}
                        >
                            📞
                        </button>
                    ) : (
                        <button 
                            onClick={endCall}
                            style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
                        </button>
                    )}
                </div>
            </div>
            
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
}
