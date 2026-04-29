'use client';

import { useState, useRef, useEffect } from 'react';
import { apiGet, apiPost, apiFetch, API_BASE } from '@/lib/api';
import Link from 'next/link';

type ExerciseType = 'READ_ALOUD' | 'ONE_MINUTE_TALK' | 'TONGUE_TWISTER';

export default function SpeakingPracticePage() {
    const [exerciseType, setExerciseType] = useState<ExerciseType>('READ_ALOUD');
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [timer, setTimer] = useState(0);
    const [feedback, setFeedback] = useState<any>(null);
    const [evaluating, setEvaluating] = useState(false);
    const [step, setStep] = useState<'select' | 'practice' | 'result'>('select');

    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<any>(null);
    const transcriptRef = useRef('');
    const promptShownAtRef = useRef<number>(0);

    const exercises = [
        { type: 'READ_ALOUD' as ExerciseType, icon: '📖', title: 'Read Aloud', desc: 'Read a passage clearly and fluently', xp: '10 XP', color: '#3b82f6' },
        { type: 'ONE_MINUTE_TALK' as ExerciseType, icon: '🎤', title: '1-Minute Talk', desc: 'Speak on a random topic for 60 seconds', xp: '20 XP', color: '#8b5cf6' },
        { type: 'TONGUE_TWISTER' as ExerciseType, icon: '👅', title: 'Tongue Twister', desc: 'Master pronunciation with fun twisters', xp: '5 XP', color: '#f59e0b' },
    ];

    const loadContent = async (type: ExerciseType) => {
        setExerciseType(type);
        setLoading(true);
        try {
            const data = await apiGet(`/api/english/practice/content?exercise_type=${type}`);
            setContent(data.content);
            setStep('practice');
            promptShownAtRef.current = Date.now();
        } catch { setContent(null); setStep('practice'); promptShownAtRef.current = Date.now(); }
        setLoading(false);
    };

    const startRecording = () => {
        setTranscript('');
        transcriptRef.current = '';
        setTimer(0);
        setIsRecording(true);

        timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);

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
                setTranscript(final.trim());
            };

            recognition.onerror = () => { };
            recognition.onend = () => {
                if (isRecording) recognition.start();
            };

            recognition.start();
            recognitionRef.current = recognition;
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const submitForEvaluation = async () => {
        if (!transcriptRef.current && !transcript) return;
        setEvaluating(true);
        const hesitation_seconds = promptShownAtRef.current > 0 ? (Date.now() - promptShownAtRef.current) / 1000 : 0;
        try {
            const res = await apiFetch('/api/english/practice/evaluate', {
                method: 'POST',
                body: JSON.stringify({
                    transcript: transcriptRef.current || transcript,
                    exercise_type: exerciseType,
                    prompt_text: content?.text || content?.topic || content?.starter || '',
                    duration_seconds: timer,
                    hesitation_seconds,
                }),
            });
            const data = await res.json();
            setFeedback(data);
            setStep('result');
        } catch (e) { alert('Evaluation failed. Try again.'); }
        setEvaluating(false);
    };

    const resetPractice = () => {
        setStep('select');
        setContent(null);
        setTranscript('');
        setFeedback(null);
        setTimer(0);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // ──── Select Exercise ────
    if (step === 'select') {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">🎙️ Speaking Practice</h1>
                        <p className="page-subtitle">Choose an exercise and start speaking!</p>
                    </div>
                    <Link href="/english" className="btn btn-secondary">← Back</Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {exercises.map((ex) => (
                        <div key={ex.type} className="card" onClick={() => loadContent(ex.type)} style={{ cursor: 'pointer', padding: '28px', transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '60px', opacity: 0.06 }}>{ex.icon}</div>
                            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${ex.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', marginBottom: '16px' }}>{ex.icon}</div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>{ex.title}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>{ex.desc}</p>
                            <span style={{ padding: '4px 10px', borderRadius: '99px', background: `${ex.color}15`, color: ex.color, fontSize: '12px', fontWeight: 700 }}>{ex.xp}</span>
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
                    <div>
                        <h1 className="page-title">📊 Practice Results</h1>
                        <p className="page-subtitle">Here's how you did!</p>
                    </div>
                    <button className="btn btn-primary" onClick={resetPractice}>Practice Again</button>
                </div>

                {/* XP + Streak Banner */}
                <div className="card" style={{ marginBottom: '24px', padding: '24px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>+{feedback.xp_earned} XP</div><div style={{ fontSize: '11px', color: '#065f46' }}>Earned</div></div>
                        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>🔥 {feedback.streak}</div><div style={{ fontSize: '11px', color: '#065f46' }}>Day Streak</div></div>
                        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>{feedback.total_xp}</div><div style={{ fontSize: '11px', color: '#065f46' }}>Total XP</div></div>
                    </div>
                    <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#059669', color: '#fff', fontWeight: 700, fontSize: '13px' }}>{feedback.level}</span>
                </div>

                {/* New Badges */}
                {feedback.new_badges?.length > 0 && (
                    <div className="card" style={{ marginBottom: '24px', padding: '20px', background: 'linear-gradient(135deg, #fef9c3, #fef08a)', border: '1px solid #fbbf24' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>🎉 New Badges Earned!</h3>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {feedback.new_badges.map((b: any, i: number) => (
                                <span key={i} style={{ padding: '6px 14px', borderRadius: '99px', background: '#fff', fontWeight: 700, fontSize: '13px' }}>{b.icon} {b.name}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Score Cards */}
                <div className="grid-4" style={{ marginBottom: '24px' }}>
                    <div className="stat-card primary"><div className="stat-icon primary">📊</div><div className="stat-info"><h3>Fluency</h3><div className="stat-value">{fb.fluency_score || 0}/10</div></div></div>
                    <div className="stat-card success"><div className="stat-icon success">⚡</div><div className="stat-info"><h3>Speed</h3><div className="stat-value">{fb.wpm || 0} WPM</div></div></div>
                    <div className="stat-card accent"><div className="stat-icon accent">🎯</div><div className="stat-info"><h3>Fillers</h3><div className="stat-value">{fb.filler_count || 0}</div></div></div>
                    <div className="stat-card danger"><div className="stat-icon danger">📝</div><div className="stat-info"><h3>Vocab</h3><div className="stat-value">{fb.vocabulary_score || 0}/10</div></div></div>
                </div>

                {/* Detailed Feedback */}
                <div className="card" style={{ padding: '24px' }}>
                    {fb.encouragement && <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--success-glow)', color: '#059669', fontWeight: 600, marginBottom: '16px' }}>💪 {fb.encouragement}</div>}
                    {fb.specific_tip && <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--info-glow)', color: '#2563eb', fontWeight: 600, marginBottom: '16px' }}>💡 {fb.specific_tip}</div>}
                    {fb.grammar_errors?.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Grammar Corrections</h4>
                            {fb.grammar_errors.map((e: any, i: number) => (
                                <div key={i} style={{ padding: '8px 12px', marginBottom: '6px', borderRadius: '8px', background: 'var(--danger-glow)', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>{e.error}</span> → <span style={{ color: 'var(--success)', fontWeight: 600 }}>{e.correction}</span>
                                    {e.rule && <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '8px' }}>({e.rule})</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    {fb.strengths?.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#059669' }}>✅ Strengths</h4>
                            {fb.strengths.map((s: string, i: number) => <div key={i} style={{ fontSize: '13px', padding: '4px 0', color: 'var(--text-secondary)' }}>• {s}</div>)}
                        </div>
                    )}
                    {fb.improvements?.length > 0 && (
                        <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#f59e0b' }}>🔧 Improvements</h4>
                            {fb.improvements.map((s: string, i: number) => <div key={i} style={{ fontSize: '13px', padding: '4px 0', color: 'var(--text-secondary)' }}>• {s}</div>)}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ──── Practice Mode ────
    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{exercises.find(e => e.type === exerciseType)?.icon} {exercises.find(e => e.type === exerciseType)?.title}</h1>
                    <p className="page-subtitle">{exercises.find(e => e.type === exerciseType)?.desc}</p>
                </div>
                <button className="btn btn-secondary" onClick={resetPractice}>← Back</button>
            </div>

            {/* Prompt Card */}
            <div className="card" style={{ marginBottom: '24px', padding: '28px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #93c5fd' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                    {exerciseType === 'READ_ALOUD' ? '📖 Read This Passage' : exerciseType === 'ONE_MINUTE_TALK' ? '🎤 Your Topic' : '👅 Try This Twister'}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#1e3a5f', lineHeight: 1.7 }}>
                    {content?.text || content?.topic || 'Loading content...'}
                </div>
                {content?.title && <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '12px', fontWeight: 600 }}>— {content.title}</div>}
            </div>

            {/* Recording Controls */}
            <div className="card" style={{ padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
                {/* Timer */}
                <div style={{ fontSize: '48px', fontWeight: 800, color: isRecording ? '#ef4444' : 'var(--text-primary)', marginBottom: '20px', fontFamily: 'monospace' }}>
                    {formatTime(timer)}
                </div>

                {/* Record Button */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
                    {!isRecording ? (
                        <button className="btn btn-primary btn-lg" onClick={startRecording} style={{ borderRadius: '99px', padding: '16px 40px', fontSize: '16px' }}>
                            🎤 Start Speaking
                        </button>
                    ) : (
                        <button className="btn btn-danger btn-lg" onClick={stopRecording} style={{ borderRadius: '99px', padding: '16px 40px', fontSize: '16px', animation: 'pulse 1.5s infinite' }}>
                            ⏹️ Stop Recording
                        </button>
                    )}
                </div>

                {isRecording && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                        {[...Array(5)].map((_, i) => (
                            <div key={i} style={{ width: '4px', height: '20px', background: '#ef4444', borderRadius: '99px', animation: `pulse ${0.5 + i * 0.15}s infinite alternate` }} />
                        ))}
                    </div>
                )}

                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {isRecording ? '🔴 Recording... Speak clearly into your microphone' : 'Click the button and start speaking. Your speech will be transcribed live.'}
                </p>
            </div>

            {/* Live Transcript */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>📝 Live Transcript</h3>
                <div style={{ minHeight: '80px', padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '14px', lineHeight: 1.7, color: transcript ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {transcript || 'Your speech will appear here as you speak...'}
                </div>
            </div>

            {/* Submit */}
            {transcript && !isRecording && (
                <div style={{ textAlign: 'center' }}>
                    <button className="btn btn-primary btn-lg" onClick={submitForEvaluation} disabled={evaluating} style={{ borderRadius: '14px', padding: '14px 40px' }}>
                        {evaluating ? '⏳ AI is evaluating...' : '🚀 Get AI Feedback'}
                    </button>
                </div>
            )}

            <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scaleY(1)} 50%{opacity:0.5;transform:scaleY(0.5)} }`}</style>
        </div>
    );
}
