'use client';

import { useState, useRef, useEffect } from 'react';
import { apiFetch, API_BASE, getToken } from '@/lib/api';
import Link from 'next/link';

type Mode = 'CASUAL' | 'INTERVIEW' | 'DEBATE' | 'STORY' | 'SITUATION';

const MODES = [
    { key: 'CASUAL' as Mode, icon: '☕', title: 'Casual Chat', desc: 'Talk about daily life, hobbies, movies', color: '#3b82f6' },
    { key: 'INTERVIEW' as Mode, icon: '💼', title: 'Interview Prep', desc: 'Practice HR interview questions', color: '#8b5cf6' },
    { key: 'DEBATE' as Mode, icon: '⚔️', title: 'Debate Mode', desc: 'AI takes the opposing view', color: '#ef4444' },
    { key: 'STORY' as Mode, icon: '📖', title: 'Story Building', desc: 'Co-create a story with AI', color: '#f59e0b' },
    { key: 'SITUATION' as Mode, icon: '🎭', title: 'Situation Talk', desc: 'Restaurant, hotel, office scenarios', color: '#10b981' },
];

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function ConversationPage() {
    const [mode, setMode] = useState<Mode | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const startRecording = () => {
        setIsRecording(true);
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-IN';

            recognition.onresult = (event: any) => {
                let final = '';
                for (let i = 0; i < event.results.length; i++) {
                    final += event.results[i][0].transcript + ' ';
                }
                setInput(final.trim());
            };

            recognition.onerror = () => setIsRecording(false);
            recognition.onend = () => setIsRecording(false);

            recognition.start();
            recognitionRef.current = recognition;
        } else {
            alert("Speech recognition is not supported in this browser.");
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || streaming) return;
        const userMsg: Message = { role: 'user', content: input.trim() };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setStreaming(true);

        const assistantMsg: Message = { role: 'assistant', content: '' };
        setMessages([...updatedMessages, assistantMsg]);

        try {
            const token = getToken();
            const resp = await fetch(`${API_BASE}/api/english/conversation/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    message: userMsg.content,
                    mode: mode,
                    history: updatedMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                }),
            });

            const reader = resp.body?.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    fullResponse += chunk;
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
                        return updated;
                    });
                }
            }
        } catch (e) {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I had a connection issue. Try again!' };
                return updated;
            });
        }
        setStreaming(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // ──── Mode Selection ────
    if (!mode) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">🤖 AI Conversation Partner</h1>
                        <p className="page-subtitle">Choose a conversation mode and start practicing English!</p>
                    </div>
                    <Link href="/english" className="btn btn-secondary">← Back</Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                    {MODES.map((m) => (
                        <div key={m.key} className="card" onClick={() => { setMode(m.key); setMessages([]); }} style={{ cursor: 'pointer', padding: '28px', transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '60px', opacity: 0.06 }}>{m.icon}</div>
                            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${m.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', marginBottom: '16px' }}>{m.icon}</div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>{m.title}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{m.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const currentMode = MODES.find(m => m.key === mode)!;

    // ──── Chat Interface ────
    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setMode(null); setMessages([]); }}>← Back</button>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${currentMode.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{currentMode.icon}</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{currentMode.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentMode.desc}</div>
                    </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setMessages([])}>🗑️ Clear</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{currentMode.icon}</div>
                        <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>Start the conversation!</p>
                        <p style={{ fontSize: '13px' }}>
                            {mode === 'CASUAL' ? 'Say hi, talk about your day, or ask about hobbies using your microphone!' :
                             mode === 'INTERVIEW' ? 'Say "Let\'s start the interview" to begin!' :
                             mode === 'DEBATE' ? 'Share your opinion on any topic and I\'ll debate you!' :
                             mode === 'STORY' ? 'Start a story with "Once upon a time..." or any opening!' :
                             'Describe a situation like "I\'m at a restaurant" to begin!'}
                        </p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                        <div style={{
                            maxWidth: '75%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                            color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                            fontSize: '14px', lineHeight: 1.6, border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                            boxShadow: 'var(--shadow-sm)', whiteSpace: 'pre-wrap'
                        }}>
                            {msg.content || (streaming && i === messages.length - 1 ? '...' : '')}
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <div
                        style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', fontSize: '15px', background: isRecording ? 'var(--danger-glow)' : 'var(--bg-secondary)', color: isRecording ? 'var(--danger)' : 'var(--text-primary)', minHeight: '52px', display: 'flex', alignItems: 'center', border: '1px solid var(--border)' }}
                    >
                        {input || <span style={{ color: 'var(--text-muted)' }}>{isRecording ? "Listening... Speak now" : "Tap microphone to speak..."}</span>}
                    </div>
                    {isRecording && <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />}
                </div>
                <button 
                    className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`} 
                    onClick={isRecording ? stopRecording : startRecording} 
                    disabled={streaming} 
                    style={{ borderRadius: '14px', padding: '14px', width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}
                    title={isRecording ? "Stop Recording" : "Start Speaking"}
                >
                    {isRecording ? '⏹️' : '🎙️'}
                </button>
                <button className="btn btn-primary" onClick={sendMessage} disabled={streaming || !input.trim()} style={{ borderRadius: '14px', padding: '14px 24px' }}>
                    {streaming ? '...' : '➤'}
                </button>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
    );
}
