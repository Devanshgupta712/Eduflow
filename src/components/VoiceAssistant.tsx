'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function VoiceAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const [volume, setVolume] = useState(0);

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== 'undefined') {
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

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsThinking(true);

        try {
            // Use streaming fetch
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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

            while (true) {
                const { done, value } = await reader!.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                assistantContent += chunk;
                
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    return [...prev.slice(0, -1), { ...last, content: assistantContent }];
                });
            }

            // Speak the response
            speakResponse(assistantContent);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setIsThinking(false);
        }
    };

    const speakResponse = (text: string) => {
        if (!synthRef.current) return;
        
        // Stop any current speech
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        
        synthRef.current.speak(utterance);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setIsListening(true);
            recognitionRef.current?.start();
        }
    };

    // Simulated volume meter for the orb pulse
    useEffect(() => {
        let interval: any;
        if (isListening || isSpeaking) {
            interval = setInterval(() => {
                setVolume(Math.random() * 50 + 20);
            }, 100);
        } else {
            setVolume(0);
        }
        return () => clearInterval(interval);
    }, [isListening, isSpeaking]);

    return (
        <div className="voice-assistant-container" style={{ position: 'fixed', bottom: '24px', right: '100px', zIndex: 10000 }}>
            {/* Pulsing AI Orb Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`ai-orb-button ${isOpen ? 'active' : ''}`}
                style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transform: isOpen ? 'rotate(45deg)' : 'none'
                }}
            >
                <div className="orb-inner" style={{
                    width: '40%',
                    height: '40%',
                    background: '#fff',
                    borderRadius: '50%',
                    filter: 'blur(2px)',
                    opacity: 0.8,
                    animation: isListening || isSpeaking ? 'orb-pulse 1s infinite alternate' : 'none',
                    transform: `scale(${1 + volume / 100})`
                }} />
                
                {/* Visual indicator rings */}
                <div className="orb-ring" style={{
                    position: 'absolute',
                    top: '-4px', left: '-4px', right: '-4px', bottom: '-4px',
                    border: '2px solid var(--primary)',
                    borderRadius: '50%',
                    opacity: isListening ? 0.6 : 0,
                    animation: isListening ? 'ring-ripple 1.5s infinite' : 'none'
                }} />
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="glass-premium voice-chat-window" style={{
                    position: 'absolute',
                    bottom: '80px',
                    right: '0',
                    width: '360px',
                    height: '500px',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slide-up 0.3s ease-out',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    <div className="chat-header" style={{
                        padding: '16px 20px',
                        background: 'linear-gradient(to right, var(--primary), var(--accent))',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                            <span style={{ fontWeight: 700, fontSize: '15px' }}>AppTechno AI Assistant</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                    </div>

                    <div ref={scrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.6 }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px' }}>👋</div>
                                <p style={{ fontSize: '14px' }}>Hi! I'm your learning assistant. How can I help you today?</p>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} style={{
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                                padding: '10px 14px',
                                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                background: m.role === 'user' ? 'var(--primary)' : '#f3f4f6',
                                color: m.role === 'user' ? '#fff' : '#111827',
                                fontSize: '14px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                {m.content}
                            </div>
                        ))}
                        {isThinking && (
                            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: '#f3f4f6', borderRadius: '16px', fontSize: '14px' }}>
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                            onClick={toggleListening}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                border: 'none',
                                background: isListening ? 'var(--danger)' : 'var(--bg-secondary)',
                                color: isListening ? '#fff' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isListening ? '⏹' : '🎤'}
                        </button>
                        <input 
                            type="text" 
                            placeholder="Type a message..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: '20px',
                                border: '1px solid var(--border)',
                                outline: 'none',
                                fontSize: '14px'
                            }}
                        />
                        <button 
                            onClick={() => handleSendMessage(inputValue)}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                border: 'none',
                                background: 'var(--primary)',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ✈
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes orb-pulse {
                    from { transform: scale(1); opacity: 0.8; }
                    to { transform: scale(1.4); opacity: 0.4; }
                }
                @keyframes ring-ripple {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(2); opacity: 0; }
                }
                @keyframes slide-up {
                    from { transform: translateY(20px); opacity: 0; }
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
