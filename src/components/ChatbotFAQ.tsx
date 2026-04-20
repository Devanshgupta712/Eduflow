'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'bot';
    text: string;
    time: string;
}

const DEFAULT_RESPONSE = "🤔 I'm experiencing a temporary network issue. Here's a quick overview of what I can help you with:\n\n**📚 Courses & Fees** — Ask about any program\n**🎓 Student Actions** — Attendance, assignments, assessments, leaves\n**🧑‍🏫 Trainer Tools** — QR codes, task generation, CSV exports\n**🚀 Placements** — Job support & placement stats\n**🔧 Platform Help** — How to use any feature step by step\n\nTry again in a moment!";

const QUICK_QUESTIONS = [
    "What courses do you offer?",
    "How do I mark my attendance?",
    "How do I submit an assignment?",
    "Tell me about job placements",
    "How do I apply for leave?",
    "What can trainers do on the platform?",
];

async function getGeminiResponse(userMessage: string, previousMessages: Message[]): Promise<string> {
    // Call our backend proxy — key is managed server-side in Render env vars
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com';
    
    // Build history from previous messages (exclude welcome/typing messages)
    const history = previousMessages
        .filter(m => m.id !== 'welcome' && !m.id.startsWith('bot-typing'))
        .map(m => ({ role: m.role === 'bot' ? 'model' : 'user', text: m.text }));

    try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const res = await fetch(`${API_BASE}/api/training/chatbot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ message: userMessage, history })
        });

        if (res.status === 429) return "⏳ AI is a bit busy right now. Please try again in a moment!";
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return `⚠️ ${err.detail || 'Something went wrong. Please try again.'}`;
        }
        const data = await res.json();
        return data.reply || DEFAULT_RESPONSE;
    } catch (e: any) {
        console.error('Chatbot fetch error:', e);
        return DEFAULT_RESPONSE;
    }
}


function formatBotText(text: string): string {
    // Convert **bold** to <strong> and \n to <br>
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
}

export default function ChatbotFAQ() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            // Welcome message
            setMessages([{
                id: 'welcome',
                role: 'bot',
                text: "👋 Hi! I'm the **EduSuite.ai AI Assistant**.\n\nI can help you with:\n\n📚 **Courses & Fees** — Full Stack, MERN, Python, Data Science & more\n🎓 **Student Actions** — How to mark attendance, submit assignments, apply for leave\n🧑‍🏫 **Trainer Tools** — Generating tasks, QR codes, exporting reports\n🚀 **Placements** — Jobs, mock interviews, placement stats\n🔧 **Platform Help** — Step-by-step guidance for any feature\n\nType your question or tap a quick option below 👇",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: text.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const currentMessages = [...messages, userMsg];
        setMessages(currentMessages);
        setInput('');
        setIsTyping(true);

        const responseText = await getGeminiResponse(text, currentMessages);

        const botMsg: Message = {
            id: `bot-${Date.now()}`,
            role: 'bot',
            text: responseText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    return (
        <div className="chatbot-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
            <style jsx>{`
                @media (max-width: 768px) {
                    .chatbot-container {
                        bottom: 80px !important;
                    }
                }
                @keyframes chatSlideUp {
                    from { opacity: 0; transform: translateY(16px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes dotPulse {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
            `}</style>
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    bottom: '72px',
                    right: '0',
                    width: '380px',
                    maxWidth: 'calc(100vw - 32px)',
                    height: '500px',
                    maxHeight: 'calc(100vh - 180px)',
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'chatSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>

                    {/* Header */}
                    <div style={{
                        background: 'var(--primary)',
                        padding: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: 'white',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '20px'
                            }}>🤖</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>EduSuite.ai AI</h3>
                                <p style={{ margin: 0, fontSize: '11px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                                    Ready to help
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}
                        >✕</button>
                    </div>

                    {/* Chat Messages */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '20px',
                        display: 'flex', flexDirection: 'column', gap: '16px',
                        background: '#fff',
                    }}>
                        {messages.map(msg => (
                            <div key={msg.id} style={{
                                display: 'flex',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                gap: '10px',
                                alignItems: 'flex-end',
                            }}>
                                {msg.role === 'bot' && (
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '8px',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '14px', flexShrink: 0, color: 'var(--primary)', fontWeight: 800
                                    }}>A</div>
                                )}
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '12px 16px',
                                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-secondary)',
                                    color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    fontWeight: 500,
                                    border: msg.role === 'bot' ? '1px solid var(--border)' : 'none',
                                }}>
                                    <div dangerouslySetInnerHTML={{ __html: formatBotText(msg.text) }} />
                                    <div style={{
                                        fontSize: '10px',
                                        opacity: 0.5,
                                        marginTop: '6px',
                                        textAlign: msg.role === 'user' ? 'right' : 'left',
                                        fontWeight: 600
                                    }}>{msg.time}</div>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '8px',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '14px', flexShrink: 0, color: 'var(--primary)', fontWeight: 800
                                }}>A</div>
                                <div style={{
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                    borderRadius: '16px 16px 16px 4px',
                                    padding: '12px 16px',
                                    display: 'flex', gap: '4px', alignItems: 'center'
                                }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{
                                            width: '6px', height: '6px', borderRadius: '50%',
                                            background: 'var(--primary)',
                                            display: 'inline-block',
                                            animation: `dotPulse 1.4s ease infinite ${i * 0.2}s`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick questions (only show at start) */}
                        {messages.length <= 1 && !isTyping && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '38px', marginTop: '4px' }}>
                                {QUICK_QUESTIONS.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(q)}
                                        style={{
                                            background: '#fff',
                                            border: '1px solid var(--border)',
                                            color: 'var(--primary)',
                                            padding: '8px 14px',
                                            borderRadius: '10px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontWeight: 700,
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                        onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    >{q}</button>
                                ))}
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} style={{
                        padding: '16px 20px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        background: '#fff',
                        flexShrink: 0,
                    }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Type a message..."
                            disabled={isTyping}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                fontWeight: 500
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isTyping}
                            style={{
                                width: '44px', height: '44px', borderRadius: '10px',
                                background: input.trim() ? 'var(--primary)' : 'var(--bg-secondary)',
                                border: 'none', color: '#ffffff',
                                cursor: input.trim() ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '18px', transition: 'all 0.2s',
                                flexShrink: 0,
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </form>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '20px',
                    background: 'var(--primary)',
                    border: 'none',
                    color: 'white',
                    fontSize: '28px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.transform = isOpen ? 'rotate(90deg) scale(1.05)' : 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(26, 31, 113, 0.4)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.transform = isOpen ? 'rotate(90deg)' : 'scale(1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
            >
                {isOpen ? '✕' : '💬'}
            </button>
        </div>
    );
}
