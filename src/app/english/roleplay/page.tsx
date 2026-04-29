'use client';

import { useState, useRef, useEffect } from 'react';
import { apiGet, getToken, API_BASE } from '@/lib/api';
import Link from 'next/link';

interface Message { role: 'user' | 'assistant'; content: string; }
interface Scenario { category: string; title: string; description: string; ai_role: string; }

const CATEGORY_ICONS: Record<string, string> = { Professional: '💼', 'Daily Life': '🏠', Workplace: '🏢', Social: '🤝' };

export default function RoleplayPage() {
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [selected, setSelected] = useState<Scenario | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        apiGet('/api/english/roleplay/scenarios').then(d => setScenarios(d.scenarios || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

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

    const startScenario = (s: Scenario) => {
        setSelected(s);
        setMessages([{ role: 'assistant', content: `🎭 **Scenario: ${s.title}**\n\n${s.description}\n\nI'll play my role now. Let's begin!\n\n---\n\n*${s.ai_role.replace('You are', "I'm")}*\n\nGo ahead, start the conversation!` }]);
    };

    const sendMessage = async () => {
        if (!input.trim() || streaming || !selected) return;
        const userMsg: Message = { role: 'user', content: input.trim() };
        const updated = [...messages, userMsg];
        setMessages(updated);
        setInput('');
        setStreaming(true);

        setMessages([...updated, { role: 'assistant', content: '' }]);

        try {
            const token = getToken();
            const resp = await fetch(`${API_BASE}/api/english/roleplay/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    message: userMsg.content, mode: 'SITUATION',
                    history: updated.slice(-10).map(m => ({ role: m.role, content: m.content })),
                    scenario_context: `${selected.ai_role}\n\nScenario: ${selected.title}\n${selected.description}`,
                }),
            });
            const reader = resp.body?.getReader();
            const decoder = new TextDecoder();
            let full = '';
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    full += decoder.decode(value, { stream: true });
                    setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: full }; return u; });
                }
            }
        } catch {
            setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: 'Connection issue. Try again!' }; return u; });
        }
        setStreaming(false);
    };

    // ──── Scenario Selection ────
    if (!selected) {
        const categories = [...new Set(scenarios.map(s => s.category))];
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div><h1 className="page-title">🎭 Roleplay Scenarios</h1><p className="page-subtitle">Practice real-world English conversations</p></div>
                    <Link href="/english" className="btn btn-secondary">← Back</Link>
                </div>
                {loading ? <p>Loading scenarios...</p> : categories.map(cat => (
                    <div key={cat} style={{ marginBottom: '28px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>{CATEGORY_ICONS[cat] || '📌'} {cat}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {scenarios.filter(s => s.category === cat).map((s, i) => (
                                <div key={i} className="card" onClick={() => startScenario(s)} style={{ cursor: 'pointer', padding: '24px' }}>
                                    <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{s.title}</h4>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>{s.description}</p>
                                    <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 600 }}>Start →</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // ──── Chat ────
    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(null); setMessages([]); }}>← Scenarios</button>
                    <div><div style={{ fontWeight: 700, fontSize: '15px' }}>🎭 {selected.title}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selected.category}</div></div>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                        <div style={{
                            maxWidth: '75%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-card)', color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                            fontSize: '14px', lineHeight: 1.6, border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none', whiteSpace: 'pre-wrap',
                        }}>{msg.content || '...'}</div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder={isRecording ? "Listening... Speak now" : "Tap microphone to speak..."} className="form-input" 
                        style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', fontSize: '15px', background: isRecording ? 'var(--danger-glow)' : 'var(--bg-secondary)', color: isRecording ? 'var(--danger)' : 'var(--text-primary)' }} 
                        disabled={streaming || isRecording} />
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
