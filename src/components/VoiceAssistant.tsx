'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE, getToken, getStoredUser } from '@/lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function VoiceAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const [volume, setVolume] = useState(1); // 1 is 100% volume

    // Initialize User, Speech Recognition and Synthesis
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = getStoredUser();
            setUser(stored);

            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = false;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    handleSendMessage(transcript);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
            synthRef.current = window.speechSynthesis;
        }
    }, []);

    // ✅ Stop all speech and listening when window is closed
    const stopAll = useCallback(() => {
        synthRef.current?.cancel();
        recognitionRef.current?.stop();
        setIsSpeaking(false);
        setIsListening(false);
    }, []);

    // Close handler — stop audio then close
    const handleClose = useCallback(() => {
        stopAll();
        setIsOpen(false);
    }, [stopAll]);

    // Orb toggle — if closing, stop audio too
    const handleOrbToggle = useCallback(() => {
        if (isOpen) {
            handleClose();
        } else {
            setIsOpen(true);
        }
    }, [isOpen, handleClose]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        // Stop speaking if user sends a new message
        synthRef.current?.cancel();
        setIsSpeaking(false);

        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsThinking(true);

        try {
            const response = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    message: text,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
                })
            });

            if (!response.ok) throw new Error('AI service error');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            if (!reader) throw new Error('Response body is empty');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantContent += chunk;

                setMessages(prev => {
                    const others = prev.slice(0, -1);
                    return [...others, { role: 'assistant', content: assistantContent }];
                });
            }

            decoder.decode();

            // Only speak if the window is still open
            if (assistantContent && isOpen) {
                setTimeout(() => speakResponse(assistantContent), 100);
            }

        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ ${error.message || 'Could not connect to AI'}. Please try again.`
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const speakResponse = (text: string) => {
        if (!synthRef.current || !text) return;

        // Cancel any current speech first
        window.speechSynthesis.cancel();

        // Strip markdown symbols so TTS sounds natural
        const cleanText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/#+\s/g, '')
            .replace(/[\[\]()]/g, '')
            .replace(/\n+/g, ' ')
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = volume > 0 ? volume : 1; // Ensure audible if state is 0 for some reason

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error('TTS Error:', e);
            setIsSpeaking(false);
        };

        // Some browsers get stuck in a paused state
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
    };

    const stopSpeaking = () => {
        synthRef.current?.cancel();
        setIsSpeaking(false);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setIsListening(true);
            recognitionRef.current?.start();
        }
    };

    // The volume state is managed strictly by the user via the volume slider.

    return (
        <div className="voice-assistant-container" style={{ position: 'fixed', bottom: '24px', right: '100px', zIndex: 10000 }}>
            {/* Pulsing AI Orb Button */}
            <button
                onClick={handleOrbToggle}
                title={isOpen ? 'Close AI Assistant' : 'Open AI Voice Assistant'}
                className={`ai-orb-button ${isOpen ? 'active' : ''}`}
                style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '20px',
                    background: isOpen
                        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                        : 'linear-gradient(135deg, var(--primary), var(--accent))',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    fontSize: '22px'
                }}
            >
                {isOpen ? '✕' : '🎙️'}

                {/* Pulse ring when speaking */}
                <div style={{
                    position: 'absolute',
                    inset: '-6px',
                    border: `2px solid ${isSpeaking ? '#7c3aed' : isListening ? '#ef4444' : 'transparent'}`,
                    borderRadius: '26px',
                    opacity: (isSpeaking || isListening) ? 0.7 : 0,
                    animation: (isSpeaking || isListening) ? 'ring-ripple 1.5s infinite' : 'none'
                }} />
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    bottom: '76px',
                    right: '0',
                    width: '360px',
                    height: '520px',
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slide-up 0.3s ease-out',
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTopLeftRadius: '20px',
                        borderTopRightRadius: '20px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                                animation: isSpeaking ? 'pulse-avatar 1.5s infinite' : 'none'
                            }}>
                                🤖
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                                    {user ? `${user.name.split(' ')[0]}'s Assistant` : 'EduSuite.ai Assistant'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                                    {isThinking ? 'Thinking...' : isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Online'}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Volume Control */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Volume">
                                <span style={{ fontSize: '12px' }}>{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.1" 
                                    value={volume} 
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    style={{ width: '40px', cursor: 'pointer', accentColor: '#ffffff' }}
                                />
                            </div>
                            {/* Stop Speaking button — only shown while speaking */}
                            {isSpeaking && (
                                <button
                                    onClick={stopSpeaking}
                                    title="Stop speaking"
                                    style={{
                                        background: 'rgba(255,255,255,0.15)',
                                        border: 'none',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        width: '28px', height: '28px',
                                        borderRadius: '8px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '14px'
                                    }}
                                >
                                    ⏹
                                </button>
                            )}
                            <button
                                onClick={handleClose}
                                title="Close"
                                style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    border: 'none',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    width: '28px', height: '28px',
                                    borderRadius: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '16px'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', marginTop: '30px', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎙️</div>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    {user ? `${user.name.split(' ')[0]}, focus on your goals.` : "I'm your AI Mentor."}
                                </p>
                                <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '18px' }}>
                                    Excuses don't build careers. Discipline does.
                                </p>

                                {/* Quick question chips */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                    {[
                                        "What courses do you offer?",
                                        "Tell me about placements",
                                        "How do I register?",
                                        "What is the course fee?",
                                    ].map(q => (
                                        <button
                                            key={q}
                                            onClick={() => handleSendMessage(q)}
                                            style={{
                                                padding: '7px 12px',
                                                borderRadius: '20px',
                                                border: '1px solid var(--border)',
                                                background: '#f9fafb',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                transition: 'all 0.2s',
                                                fontWeight: 500
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.color = 'var(--primary)';
                                                e.currentTarget.style.background = '#eff6ff';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                                e.currentTarget.style.background = '#f9fafb';
                                            }}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div key={i} style={{
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                padding: '10px 14px',
                                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                background: m.role === 'user' ? 'var(--primary)' : '#f3f4f6',
                                color: m.role === 'user' ? '#fff' : '#111827',
                                fontSize: '13.5px',
                                lineHeight: '1.55',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                border: m.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                                wordBreak: 'break-word'
                            }}>
                                {m.content}
                            </div>
                        ))}

                        {isThinking && (
                            <div style={{ alignSelf: 'flex-start', padding: '10px 16px', background: '#f3f4f6', borderRadius: '18px', border: '1px solid #e5e7eb' }}>
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Bar */}
                    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', background: '#fafafa', flexShrink: 0 }}>
                        {/* Mic button */}
                        <button
                            onClick={toggleListening}
                            title={isListening ? 'Stop listening' : 'Speak your question'}
                            style={{
                                width: '38px', height: '38px',
                                borderRadius: '50%',
                                border: 'none',
                                background: isListening ? '#ef4444' : 'var(--bg-secondary)',
                                color: isListening ? '#fff' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                        >
                            {isListening ? '⏹' : '🎤'}
                        </button>

                        <input
                            type="text"
                            placeholder="Type or speak..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                            style={{
                                flex: 1,
                                padding: '9px 14px',
                                borderRadius: '20px',
                                border: '1px solid var(--border)',
                                outline: 'none',
                                fontSize: '13.5px',
                                background: '#fff'
                            }}
                        />

                        <button
                            onClick={() => handleSendMessage(inputValue)}
                            disabled={!inputValue.trim() || isThinking}
                            style={{
                                width: '38px', height: '38px',
                                borderRadius: '50%',
                                border: 'none',
                                background: inputValue.trim() ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: '#fff',
                                cursor: inputValue.trim() ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '16px',
                                flexShrink: 0
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes ring-ripple {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                @keyframes slide-up {
                    from { transform: translateY(16px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .typing-indicator span {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    background: var(--text-muted);
                    border-radius: 50%;
                    margin-right: 3px;
                    animation: typing 1s infinite alternate;
                }
                .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typing {
                    from { opacity: 0.3; transform: translateY(0); }
                    to { opacity: 1; transform: translateY(-4px); }
                }
            `}</style>
        </div>
    );
}
