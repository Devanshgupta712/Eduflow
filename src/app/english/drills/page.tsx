'use client';

import { useState, useRef } from 'react';
import { apiGet, apiFetch } from '@/lib/api';
import Link from 'next/link';

type DrillType = 'PICTURE_DESCRIPTION' | 'STORY_CONTINUATION' | 'OPINION_BUILDER' | 'WORD_ASSOCIATION' | 'RAPID_FIRE';

const DRILLS = [
    { type: 'PICTURE_DESCRIPTION' as DrillType, icon: '🖼️', title: 'Picture Description', desc: 'Describe a scene in 60 seconds', color: '#3b82f6', time: 60 },
    { type: 'STORY_CONTINUATION' as DrillType, icon: '📝', title: 'Story Continuation', desc: 'Continue a story for 1 minute', color: '#8b5cf6', time: 60 },
    { type: 'OPINION_BUILDER' as DrillType, icon: '💬', title: 'Opinion Builder', desc: 'Share your opinion with 2 reasons', color: '#f59e0b', time: 90 },
    { type: 'WORD_ASSOCIATION' as DrillType, icon: '🔗', title: 'Word Association', desc: 'Say 5 related words + sentences', color: '#10b981', time: 30 },
];

export default function DrillsPage() {
    const [step, setStep] = useState<'select' | 'drill' | 'result'>('select');
    const [drillType, setDrillType] = useState<DrillType>('PICTURE_DESCRIPTION');
    const [content, setContent] = useState<any>(null);
    const [response, setResponse] = useState('');
    const [timer, setTimer] = useState(0);
    const [maxTime, setMaxTime] = useState(60);
    const [isActive, setIsActive] = useState(false);
    const [feedback, setFeedback] = useState<any>(null);
    const [evaluating, setEvaluating] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const timerRef = useRef<any>(null);
    const recognitionRef = useRef<any>(null);
    const transcriptRef = useRef('');
    const promptShownAtRef = useRef<number>(0);

    const loadDrill = async (type: DrillType) => {
        setDrillType(type);
        setLoading(true);
        setResponse('');
        setTimer(0);
        setFeedback(null);
        const drill = DRILLS.find(d => d.type === type)!;
        setMaxTime(drill.time);
        try {
            const data = await apiGet(`/api/english/drills/random?drill_type=${type}`);
            setContent(data.content);
            setStep('drill');
            promptShownAtRef.current = Date.now(); // Start tracking hesitation
        } catch { setContent({}); setStep('drill'); promptShownAtRef.current = Date.now(); }
        setLoading(false);
    };

    const startTimer = () => {
        setIsActive(true);
        setTimer(0);
        setResponse('');
        transcriptRef.current = '';
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
                transcriptRef.current = final.trim();
                setResponse(final.trim());
            };

            recognition.onerror = () => { };
            recognition.onend = () => {
                if (timerRef.current && isActive) recognition.start();
            };

            recognition.start();
            recognitionRef.current = recognition;
        } else {
            alert("Speech recognition is not supported in this browser.");
        }

        timerRef.current = setInterval(() => {
            setTimer(prev => {
                if (prev + 1 >= maxTime) { stopTimer(); return maxTime; }
                return prev + 1;
            });
        }, 1000);
    };

    const stopTimer = () => {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setIsActive(false);
        setIsRecording(false);
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
        }
    };

    const submitDrill = async () => {
        if (!response.trim()) return;
        stopTimer();
        setEvaluating(true);
        const hesitation_seconds = promptShownAtRef.current > 0 ? (Date.now() - promptShownAtRef.current) / 1000 : 0;
        try {
            const promptText = content?.scene || content?.starter || content?.topic || content?.word || '';
            const res = await apiFetch('/api/english/drills/evaluate', {
                method: 'POST',
                body: JSON.stringify({ drill_type: drillType, prompt_text: promptText, response_text: response, duration_seconds: timer, hesitation_seconds }),
            });
            const data = await res.json();
            setFeedback(data);
            setStep('result');
        } catch { alert('Evaluation failed.'); }
        setEvaluating(false);
    };

    const reset = () => { setStep('select'); setContent(null); setResponse(''); setFeedback(null); setTimer(0); };
    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const timePercent = (timer / maxTime) * 100;

    // ──── Select ────
    if (step === 'select') {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div><h1 className="page-title">🧠 Think-in-English Drills</h1><p className="page-subtitle">Train your brain to skip Hindi→English translation</p></div>
                    <Link href="/english" className="btn btn-secondary">← Back</Link>
                </div>
                <div className="card" style={{ marginBottom: '24px', padding: '20px', background: 'linear-gradient(135deg, #fef9c3, #fef08a)', border: '1px solid #fbbf24' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', margin: 0 }}>💡 <strong>Why these drills?</strong> The biggest fluency blocker is mental translation. These timed exercises force you to think directly in English — no time to translate!</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                    {DRILLS.map((d) => (
                        <div key={d.type} className="card" onClick={() => loadDrill(d.type)} style={{ cursor: 'pointer', padding: '28px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '60px', opacity: 0.06 }}>{d.icon}</div>
                            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${d.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', marginBottom: '16px' }}>{d.icon}</div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>{d.title}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>{d.desc}</p>
                            <span style={{ padding: '4px 10px', borderRadius: '99px', background: `${d.color}15`, color: d.color, fontSize: '12px', fontWeight: 700 }}>⏱️ {d.time}s</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ──── Result ────
    if (step === 'result' && feedback) {
        const fb = feedback.feedback || {};
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div><h1 className="page-title">📊 Drill Results</h1></div>
                    <button className="btn btn-primary" onClick={reset}>Try Another</button>
                </div>
                <div className="card" style={{ marginBottom: '24px', padding: '24px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>{fb.overall_score || 0}/10</div><div style={{ fontSize: '11px', color: '#065f46' }}>Score</div></div>
                        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>+{feedback.xp_earned}</div><div style={{ fontSize: '11px', color: '#065f46' }}>XP</div></div>
                        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>🔥 {feedback.streak}</div><div style={{ fontSize: '11px', color: '#065f46' }}>Streak</div></div>
                    </div>
                    <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#059669', color: '#fff', fontWeight: 700, fontSize: '13px' }}>{feedback.level}</span>
                </div>
                <div className="card" style={{ padding: '24px' }}>
                    {fb.tip && <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--info-glow)', color: '#2563eb', fontWeight: 600, marginBottom: '16px' }}>💡 {fb.tip}</div>}
                    {fb.highlight && <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--success-glow)', color: '#059669', fontWeight: 600, marginBottom: '16px' }}>⭐ {fb.highlight}</div>}
                    {fb.model_answer && <div style={{ marginTop: '16px' }}><h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>📝 Model Answer</h4><div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-secondary)', fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{fb.model_answer}</div></div>}
                    {fb.suggested_description && <div style={{ marginTop: '16px' }}><h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>📝 Suggested Description</h4><div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-secondary)', fontSize: '13px', lineHeight: 1.7 }}>{fb.suggested_description}</div></div>}
                    {fb.grammar_errors?.length > 0 && (
                        <div style={{ marginTop: '16px' }}><h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Grammar Fixes</h4>
                            {fb.grammar_errors.map((e: any, i: number) => (
                                <div key={i} style={{ padding: '8px 12px', marginBottom: '6px', borderRadius: '8px', background: 'var(--danger-glow)', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>{e.error}</span> → <span style={{ color: 'var(--success)', fontWeight: 600 }}>{e.correction}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ──── Drill Mode ────
    const drill = DRILLS.find(d => d.type === drillType)!;
    return (
        <div className="animate-in">
            <div className="page-header">
                <div><h1 className="page-title">{drill.icon} {drill.title}</h1><p className="page-subtitle">{drill.desc}</p></div>
                <button className="btn btn-secondary" onClick={reset}>← Back</button>
            </div>

            {/* Prompt */}
            <div className="card" style={{ marginBottom: '24px', padding: '28px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #93c5fd' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                    {drillType === 'PICTURE_DESCRIPTION' ? '🖼️ Describe This Scene' : drillType === 'STORY_CONTINUATION' ? '📝 Continue This Story' : drillType === 'OPINION_BUILDER' ? '💬 Share Your Opinion' : '🔗 Word Association'}
                </div>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#1e3a5f', lineHeight: 1.7 }}>
                    {content?.scene || content?.starter || content?.topic || content?.word || 'Loading...'}
                </div>
                {content?.title && <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '10px', fontWeight: 600 }}>— {content.title}</div>}
            </div>

            {/* Timer Bar */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: timePercent > 80 ? '#ef4444' : 'var(--text-secondary)' }}>{formatTime(timer)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>{formatTime(maxTime)}</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${timePercent}%`, background: timePercent > 80 ? '#ef4444' : timePercent > 50 ? '#f59e0b' : '#3b82f6', borderRadius: '99px', transition: 'width 1s linear' }} />
                </div>
            </div>

            {/* Response Area */}
            <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
                {!isActive && timer === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <button className="btn btn-primary btn-lg" onClick={startTimer} style={{ borderRadius: '99px', padding: '16px 40px', fontSize: '16px' }}>
                            🎙️ Start Timer & Speak
                        </button>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>You have {maxTime} seconds. Think in English — don't translate!</p>
                    </div>
                ) : (
                    <>
                        <div style={{ width: '100%', minHeight: '160px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: '15px', lineHeight: 1.7, color: response ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {response || (isRecording ? 'Listening... Speak now.' : 'Transcription will appear here.')}
                        </div>
                        {isRecording && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} style={{ width: '4px', height: '20px', background: '#ef4444', borderRadius: '99px', animation: `pulse ${0.5 + i * 0.15}s infinite alternate` }} />
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{response.split(/\s+/).filter(Boolean).length} words</span>
                            {isActive && <button className="btn btn-danger btn-sm" onClick={stopTimer}>⏹️ Stop Early</button>}
                        </div>
                    </>
                )}
            </div>

            {/* Submit */}
            {response.trim() && !isActive && (
                <div style={{ textAlign: 'center' }}>
                    <button className="btn btn-primary btn-lg" onClick={submitDrill} disabled={evaluating} style={{ borderRadius: '14px', padding: '14px 40px' }}>
                        {evaluating ? '⏳ AI evaluating...' : '🚀 Get AI Feedback'}
                    </button>
                </div>
            )}
            <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scaleY(1)} 50%{opacity:0.5;transform:scaleY(0.5)} }`}</style>
        </div>
    );
}
