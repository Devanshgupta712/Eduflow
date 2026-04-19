'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiFetch } from '@/lib/api';
import Editor from '@monaco-editor/react';

interface Question {
    index: number;
    question: string;
    options: string[];
}

interface RunResult {
    stdout: string;
    stderr: string;
    code: number;
}

export default function AssessmentSessionPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.taskId as string;

    const [loading, setLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('Starting secure session...');
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [isCompleted, setIsCompleted] = useState(false);
    const retryRef = useRef(0);

    // Assessment Data
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [timeLimitMins, setTimeLimitMins] = useState(0);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    // Anti-Cheating
    const [tabSwitchCount, setTabSwitchCount] = useState(0);

    // User Input State
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [codeAnswers, setCodeAnswers] = useState<Record<number, string>>({});
    const [language, setLanguage] = useState('python');

    // Code Runner State
    const [runningCode, setRunningCode] = useState<Record<number, boolean>>({});
    const [runOutputs, setRunOutputs] = useState<Record<number, RunResult | null>>({});

    // Final Results State
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [submitError, setSubmitError] = useState('');
    const [aiGrading, setAiGrading] = useState<'pending' | 'done' | 'n/a'>('n/a');

    // Save & Continue + Review
    const [savedQuestions, setSavedQuestions] = useState<Set<number>>(new Set());
    const [showReview, setShowReview] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);

    const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
    const isCompletedRef = useRef(false);

    useEffect(() => {
        if (!taskId) return;
        startSession();

        // Anti-cheating: Tab switch detection
        const handleVisibilityChange = () => {
            if (document.hidden && !isCompletedRef.current && sessionId) {
                logTabSwitch();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId]);

    // Keep ref updated
    useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);

    const startSession = async (retryCount = 0) => {
        try {
            setLoadingMsg(retryCount === 0 ? 'Starting secure session...' : `Waking up server... (attempt ${retryCount + 1}/4)`);

            // 1. Start or resume
            const res = await apiFetch(`/api/training/assessments/TASK/${taskId}/start`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to start assessment');
            const startData = await res.json();
            setSessionId(startData.session_id);

            // 2. Fetch questions/details
            const qData = await apiGet(`/api/training/assessments/${startData.session_id}/questions`);
            setTitle(qData.title);
            setDescription(qData.description);
            setQuestions(qData.questions || []);
            setTimeLimitMins(qData.time_limit_mins);
            setRemainingSeconds(qData.remaining_seconds);
            setIsCompleted(qData.is_completed);
            setTabSwitchCount(qData.tab_switch_count || 0);

            // Pre-fill coding answers with initial_code if it's a coding task
            if (qData.questions && qData.questions.length > 0) {
                const initialCodes: Record<number, string> = {};
                qData.questions.forEach((q: any, i: number) => {
                    if (q.initial_code) initialCodes[i] = q.initial_code;
                });
                if (Object.keys(initialCodes).length > 0) setCodeAnswers(initialCodes);
            } else if (qData.description && !qData.questions?.length) {
                setCodeAnswers({ 0: '# Write your code here\n' });
            }

            if (qData.is_completed) {
                setFinalScore(qData.score || 0);
                setResults(qData.results || []);
                setAiGrading(qData.ai_grading || 'n/a');
                if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            } else {
                startHeartbeat(startData.session_id);
            }
        } catch (err: any) {
            const isNetworkError = err.message === 'Failed to fetch' || err.message?.includes('fetch');
            if (isNetworkError && retryCount < 3) {
                // Auto-retry for Render cold-start (backend sleeping)
                const delay = 8000;
                setLoadingMsg(`Server is waking up... retrying in ${delay / 1000}s (${retryCount + 1}/3)`);
                setTimeout(() => startSession(retryCount + 1), delay);
                return;
            }
            setError(err.message || 'An error occurred. Please refresh the page.');
        } finally {
            if (retryCount === 0 || !error) setLoading(false);
        }
    };

    // Polling for AI Grading results
    useEffect(() => {
        let pollTimer: NodeJS.Timeout | null = null;

        if (isCompleted && aiGrading === 'pending' && sessionId) {
            pollTimer = setInterval(async () => {
                try {
                    const qData = await apiGet(`/api/training/assessments/${sessionId}/questions`);
                    if (qData.ai_grading !== 'pending') {
                        setFinalScore(qData.score || 0);
                        setResults(qData.results || []);
                        setAiGrading(qData.ai_grading || 'n/a');
                        if (pollTimer) clearInterval(pollTimer);
                    }
                } catch (e) {
                    console.error('Polling for AI grading failed', e);
                }
            }, 5000);
        }

        return () => { if (pollTimer) clearInterval(pollTimer); };
    }, [isCompleted, aiGrading, sessionId]);

    const startHeartbeat = (sid: string) => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(async () => {
            if (isCompletedRef.current) return;
            try {
                // Use functional state updates to grab the freshest answers and codeAnswers without stale closures
                setAnswers(currentAnswers => {
                    setCodeAnswers(currentCodeAnswers => {
                        const payload = { ...currentAnswers, ...currentCodeAnswers };
                        apiFetch(`/api/training/assessments/${sid}/heartbeat`, {
                            method: 'POST',
                            body: JSON.stringify({ answers: payload })
                        }).then(res => res.json()).then(data => {
                            if (data.status === 'auto_submitted') {
                                alert(`Assessment Auto-Submitted: ${data.reason.replace('_', ' ')}`);
                                handleSubmissionResult(true);
                            } else {
                                if (data.remaining_seconds !== undefined) {
                                    setRemainingSeconds(data.remaining_seconds);
                                }
                                if (data.tab_switch_count !== undefined) {
                                    setTabSwitchCount(data.tab_switch_count);
                                }
                            }
                        }).catch(console.error);
                        return currentCodeAnswers; // don't mutate state
                    });
                    return currentAnswers; // don't mutate state
                });
            } catch (e) { console.error('Heartbeat failed', e); }
        }, 5000);
    };

    const logTabSwitch = async () => {
        try {
            const res = await apiFetch(`/api/training/assessments/${sessionId}/heartbeat`, {
                method: 'POST',
                body: JSON.stringify({ tab_switched: true })
            });
            const data = await res.json();
            if (data.status === 'auto_submitted') {
                alert('You have switched tabs too many times. Your assessment has been auto-submitted.');
                handleSubmissionResult(true);
            } else {
                alert(`Warning! Tab switch detected. Switch count: ${data.tab_switch_count}/3. At 3, your assessment will be submitted automatically.`);
                setTabSwitchCount(data.tab_switch_count);
            }
        } catch (e) { console.error('Failed to log tab switch', e); }
    };

    const handleAnswerSelect = (qIndex: number, optIndex: number) => {
        setAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
    };

    const handleSaveAndContinue = (qIndex: number) => {
        setSavedQuestions(prev => new Set(prev).add(qIndex));
        // Move to next question
        if (qIndex < questions.length - 1) {
            setCurrentQuestion(qIndex + 1);
        }
    };

    const submitAssessment = async (retryCount = 0) => {
        if (retryCount === 0 && !confirm('Are you sure you want to finish and submit the assessment?')) return;
        setLoading(true);
        setSubmitError('');
        try {
            // Combine MCQ answers and Coding answers
            const finalAnswers = { ...answers, ...codeAnswers };
            
            const res = await apiFetch(`/api/training/assessments/${sessionId}/submit`, {
                method: 'POST',
                body: JSON.stringify({ answers: finalAnswers })
            });
            const data = await res.json();
            if (res.ok) {
                setFinalScore(data.score);
                setResults(data.results || []);
                setAiGrading(data.ai_grading || 'n/a');
                setIsCompleted(true);
                if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            } else {
                setSubmitError(data.detail || 'Submit failed. Please try again.');
            }
        } catch (e: any) {
            const isNetworkError = e.message === 'Failed to fetch' || e.message?.includes('fetch');
            if (isNetworkError && retryCount < 3) {
                setSubmitError(`Server is waking up, retrying submission... (${retryCount + 1}/3)`);
                setTimeout(() => submitAssessment(retryCount + 1), 8000);
                return;
            }
            setSubmitError('Submission failed: server may be temporarily unavailable. Please try the Retry button.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmissionResult = (wasAuto: boolean) => {
        setIsCompleted(true);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        // Force a submit call to finalize score
        setAnswers(currentAnswers => {
            setCodeAnswers(currentCodeAnswers => {
                const finalAnswers = { ...currentAnswers, ...currentCodeAnswers };
                apiFetch(`/api/training/assessments/${sessionId}/submit`, {
                    method: 'POST',
                    body: JSON.stringify({ answers: finalAnswers })
                }).then(res => res.json()).then(data => {
                    setFinalScore(data.score || 0);
                    setResults(data.results || []);
                    setAiGrading(data.ai_grading || 'n/a');
                });
                return currentCodeAnswers;
            });
            return currentAnswers;
        });
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const runCode = async (qIdx: number) => {
        const codeToRun = codeAnswers[qIdx] || '';
        if (!codeToRun.trim()) return;

        setRunningCode(prev => ({ ...prev, [qIdx]: true }));
        setRunOutputs(prev => ({ ...prev, [qIdx]: null }));
        try {
            const res = await apiFetch('/api/training/run-code', {
                method: 'POST',
                body: JSON.stringify({ language, code: codeToRun })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Execution failed');
            setRunOutputs(prev => ({ ...prev, [qIdx]: data }));
        } catch (e: any) {
            setRunOutputs(prev => ({ ...prev, [qIdx]: { stdout: '', stderr: e.message, code: 1 } }));
        } finally {
            setRunningCode(prev => ({ ...prev, [qIdx]: false }));
        }
    };

    if (loading) return (
        <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚙️</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{loadingMsg}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                This may take up to 30 seconds on first load (server warm-up).
            </div>
            <div style={{ marginTop: '20px', width: '200px', margin: '20px auto 0', height: '4px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--primary)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite', width: '60%' }} />
            </div>
        </div>
    );
    if (error) return (
        <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <div style={{ color: 'red', fontWeight: 600, marginBottom: '16px' }}>{error}</div>
            <button className="btn btn-primary" onClick={() => { setError(''); setLoading(true); startSession(); }}>Retry</button>
        </div>
    );

    const isCodingTask = questions.length === 0;

    // ─── POST-QUIZ RESULTS VIEW ───
    if (isCompleted) {
        return (
            <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                    <h2>Assessment Completed</h2>
                    {finalScore !== null && (
                        <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)', margin: '20px 0' }}>
                            Overall Score: {finalScore}%
                        </div>
                    )}
                    
                    {/* AI Tutor Feedback card */}
                    {results.find(r => r.type === 'coding_feedback') ? (
                        <div className="card" style={{ textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--primary)', margin: '20px 0', padding: '20px' }}>
                            <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ✨ AI Tutor Feedback &mdash; Score: {results.find(r => r.type === 'coding_feedback').score}%
                            </h3>
                            <div style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {results.find(r => r.type === 'coding_feedback').feedback}
                            </div>
                        </div>
                    ) : aiGrading === 'pending' ? (
                        <div className="card" style={{ textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--border)', margin: '20px 0', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontSize: '24px' }}>⏳</div>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>AI Tutor Feedback</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Your code is being graded by AI in the background. Your trainer will see the score shortly. You can safely return to the tasks list.</div>
                            </div>
                        </div>
                    ) : null}

                    <button className="btn btn-primary" onClick={() => router.push('/student/tasks')}>Return to Tasks</button>
                    {tabSwitchCount >= 3 && (
                        <p style={{ marginTop: '16px', color: 'red', fontWeight: 'bold' }}>This assessment was auto-submitted due to tab switching rules.</p>
                    )}
                </div>

                {/* Provide Feedback on MCQs */}
                {!isCodingTask && results.length > 0 && (
                    <div style={{ marginTop: '32px' }}>
                        <h3 className="section-title">Review Answers</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {results.filter(r => r.type !== 'coding_feedback').map((r, i) => (
                                <div key={i} className="card" style={{ border: `1px solid ${r.is_correct ? '#4ade80' : '#ef4444'}` }}>
                                    <p style={{ fontWeight: 600, fontSize: '15px' }}>{i + 1}. {r.question}</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                        {r.options.map((opt: string, optIdx: number) => {
                                            const isSelected = r.selected === optIdx.toString() || r.selected === optIdx;
                                            const isCorrectActual = r.correct === optIdx;
                                            let bg = 'var(--bg-secondary)';
                                            let border = '1px solid var(--border)';
                                            if (isCorrectActual) { bg = 'rgba(74, 222, 128, 0.1)'; border = '1px solid #4ade80'; }
                                            else if (isSelected && !r.is_correct) { bg = 'rgba(239, 68, 68, 0.1)'; border = '1px solid #ef4444'; }
                                            
                                            return (
                                                <div key={optIdx} style={{ padding: '10px 14px', borderRadius: '8px', background: bg, border, display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                                                    {isCorrectActual && <span>✅</span>}
                                                    {isSelected && !r.is_correct && <span>❌</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {r.explanation && !r.is_correct && (
                                        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--primary-glow)', borderRadius: '8px', fontSize: '13px', color: 'var(--primary)' }}>
                                            <strong>Explanation:</strong> {r.explanation}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const totalQuestions = questions.length || 1;
    const answeredCount = isCodingTask 
        ? (codeAnswers[0]?.trim() ? 1 : 0)
        : questions.filter((q, i) => {
            const isMCQ = q.options && q.options.length > 0;
            return isMCQ ? answers[q.index] !== undefined : !!codeAnswers[i]?.trim();
        }).length;
    const unansweredQuestions = isCodingTask
        ? (!codeAnswers[0]?.trim() ? [0] : [])
        : questions.map((q, i) => {
            const isMCQ = q.options && q.options.length > 0;
            const isAnswered = isMCQ ? answers[q.index] !== undefined : !!codeAnswers[i]?.trim();
            return isAnswered ? -1 : i;
        }).filter(i => i >= 0);

    // ─── REVIEW SCREEN ───
    if (showReview) {
        return (
            <div style={{ maxWidth: '700px', margin: '20px auto', padding: '0 20px' }}>
                <div className="card" style={{ padding: '28px' }}>
                    <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800 }}>📋 Review Before Submitting</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 20px' }}>
                        {answeredCount}/{totalQuestions} questions answered
                    </p>

                    {unansweredQuestions.length > 0 && (
                        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '20px' }}>
                            <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px', marginBottom: '6px' }}>⚠️ Unanswered Questions</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {unansweredQuestions.map(idx => (
                                    <button key={idx} onClick={() => { setShowReview(false); setCurrentQuestion(idx); }}
                                        style={{ padding: '6px 14px', borderRadius: '20px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                                    >
                                        Q{idx + 1}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                        {(isCodingTask ? [{ question: description, index: 0, options: [] }] : questions).map((q, i) => {
                            const isMCQ = q.options && q.options.length > 0;
                            const isAnswered = isMCQ ? answers[q.index] !== undefined : !!codeAnswers[i]?.trim();
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: isAnswered ? '#ecfdf5' : '#fef2f2', borderRadius: '10px', border: `1px solid ${isAnswered ? '#a7f3d0' : '#fecaca'}` }}>
                                    <span style={{ fontSize: '16px' }}>{isAnswered ? '✅' : '❌'}</span>
                                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>Question {i + 1}</span>
                                    <span style={{ fontSize: '12px', color: isAnswered ? '#065f46' : '#991b1b', fontWeight: 700 }}>
                                        {isAnswered ? 'Answered' : 'Missing'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => setShowReview(false)}>← Back to Questions</button>
                        <button className="btn btn-primary" onClick={() => submitAssessment()} disabled={loading}>
                            {loading ? 'Submitting...' : `✅ Submit (${answeredCount}/${totalQuestions} answered)`}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── ACTIVE ASSESSMENT UI ───
    return (
        <div style={{ maxWidth: '1000px', margin: '20px auto', padding: '0 20px', paddingBottom: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'var(--bg-primary)', position: 'sticky', top: '10px', zIndex: 10, padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-premium)' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{title || 'Assessment'}</h2>
                    {tabSwitchCount > 0 && <span style={{ fontSize: '12px', color: 'red', fontWeight: 600 }}>⚠️ Tab Switches: {tabSwitchCount}/3</span>}
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {remainingSeconds !== null && (
                        <div style={{ fontSize: '20px', fontWeight: 800, color: remainingSeconds < 60 ? '#ef4444' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            ⏱️ {formatTime(remainingSeconds)}
                        </div>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {answeredCount}/{totalQuestions}
                    </span>
                    <button className="btn btn-primary" onClick={() => setShowReview(true)}>
                        📋 Review & Submit
                    </button>
                </div>
            </div>

            {submitError && (
                <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '10px', color: '#ef4444', fontSize: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚠️ {submitError}</span>
                    <button className="btn btn-sm" style={{ color: '#ef4444', border: '1px solid #ef4444', marginLeft: '12px' }} onClick={() => submitAssessment()}>Retry</button>
                </div>
            )}

            {/* Question Navigation Dots */}
            {questions.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    {questions.map((q, i) => {
                        const isMCQ = q.options && q.options.length > 0;
                        const isAnswered = isMCQ ? answers[q.index] !== undefined : !!codeAnswers[i]?.trim();
                        const isCurrent = currentQuestion === i;
                        return (
                            <button key={i} onClick={() => setCurrentQuestion(i)}
                                style={{
                                    width: '36px', height: '36px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                                    border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: isAnswered ? '#10b981' : isCurrent ? 'var(--primary-glow)' : 'var(--bg-primary)',
                                    color: isAnswered ? '#fff' : isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                </div>
            )}

            {description && (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <p style={{ margin: 0 }}>{description}</p>
                </div>
            )}

            {/* QUESTION RENDERER */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {questions.length === 0 ? (
                    <CodingEditor 
                        index={0} 
                        questionText={description} 
                        code={codeAnswers[0] || ''}
                        onChange={(val) => setCodeAnswers(prev => ({ ...prev, 0: val }))}
                        onRun={() => runCode(0)}
                        running={!!runningCode[0]}
                        output={runOutputs[0]}
                        language={language}
                        setLanguage={setLanguage}
                    />
                ) : (
                    questions.map((q, i) => {
                        // Show only current question for focused experience (or all if only 1-2 questions)
                        if (questions.length > 2 && i !== currentQuestion) return null;
                        const isMCQ = q.options && q.options.length > 0;
                        const isAnswered = isMCQ ? answers[q.index] !== undefined : !!codeAnswers[i]?.trim();
                        if (isMCQ) {
                            return (
                                <div key={i} className="card" style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', lineHeight: '1.5' }}>
                                            {i + 1}. {q.question}
                                        </h3>
                                        {savedQuestions.has(i) && (
                                            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✅ Saved</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {q.options.map((opt, optIdx) => (
                                            <label key={optIdx} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                                                background: answers[q.index] === optIdx ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                                                border: `1px solid ${answers[q.index] === optIdx ? 'var(--primary)' : 'transparent'}`,
                                                borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500
                                            }}>
                                                <input
                                                    type="radio"
                                                    name={`q_${q.index}`}
                                                    checked={answers[q.index] === optIdx}
                                                    onChange={() => handleAnswerSelect(q.index, optIdx)}
                                                    style={{ accentColor: 'var(--primary)', transform: 'scale(1.2)' }}
                                                />
                                                <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {/* Save & Continue */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '10px' }}>
                                        {i > 0 && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentQuestion(i - 1)}>
                                                ← Previous
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleSaveAndContinue(i)}
                                            disabled={!isAnswered}
                                            style={{ opacity: isAnswered ? 1 : 0.5 }}
                                        >
                                            {i < questions.length - 1 ? '💾 Save & Continue →' : '💾 Save & Review'}
                                        </button>
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <div key={i}>
                                    <CodingEditor 
                                        index={i} 
                                        questionText={q.question} 
                                        code={codeAnswers[i] || ''}
                                        onChange={(val) => setCodeAnswers(prev => ({ ...prev, [i]: val }))}
                                        onRun={() => runCode(i)}
                                        running={!!runningCode[i]}
                                        output={runOutputs[i]}
                                        language={language}
                                        setLanguage={setLanguage}
                                        hints={(q as any).hints}
                                        constraints={(q as any).constraints}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', gap: '10px' }}>
                                        {i > 0 && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentQuestion(i - 1)}>
                                                ← Previous
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleSaveAndContinue(i)}
                                            disabled={!isAnswered}
                                            style={{ opacity: isAnswered ? 1 : 0.5 }}
                                        >
                                            {i < questions.length - 1 ? '💾 Save & Continue →' : '💾 Save & Review'}
                                        </button>
                                    </div>
                                </div>
                            );
                        }
                    })
                )}
            </div>
        </div>
    );
}

interface CodingEditorProps {
    index: number;
    questionText: string;
    code: string;
    onChange: (val: string) => void;
    onRun: () => void;
    running: boolean;
    output: RunResult | null;
    language: string;
    setLanguage: (l: string) => void;
    hints?: string[];
    constraints?: string[];
}

function CodingEditor({ index, questionText, code, onChange, onRun, running, output, language, setLanguage, hints, constraints }: CodingEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Question {index + 1}</h3>
                <p style={{ fontSize: '15px', lineHeight: 1.6, margin: '0 0 16px' }}>{questionText}</p>
                
                {(constraints && constraints.length > 0) && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Constraints</div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {constraints.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                    </div>
                )}

                {(hints && hints.length > 0) && (
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Hints</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {hints.map((h, i) => (
                                <span key={i} style={{ padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border)' }}>💡 {h}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select className="form-input" style={{ width: '130px', padding: '4px 8px', fontSize: '12px' }} value={language} onChange={e => setLanguage(e.target.value)}>
                        <option value="python">Python</option>
                        <option value="javascript">Node.js</option>
                        <option value="java">Java</option>
                        <option value="c++">C++</option>
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={onRun} disabled={running}>
                        {running ? 'Running...' : '▶ Run Code'}
                    </button>
                </div>
                <div style={{ height: '350px', width: '100%' }}>
                    <Editor
                        height="100%"
                        language={language}
                        theme="vs-dark"
                        value={code}
                        onChange={val => onChange(val || '')}
                        options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 4, scrollBeyondLastLine: false }}
                    />
                </div>
            </div>

            {/* Console Output */}
            <div className="card" style={{ background: '#1e1e1e', color: '#fff', padding: '16px', fontFamily: 'monospace', minHeight: '100px' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>CONSOLE OUTPUT (Q{index + 1})</div>
                {output ? (
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '12px', lineHeight: 1.5 }}>
                        {output.stderr ? (
                            <span style={{ color: '#ef4444' }}>{output.stderr}</span>
                        ) : (
                            <span style={{ color: '#4ade80' }}>{output.stdout || 'Program exited with code 0'}</span>
                        )}
                    </div>
                ) : (
                    <div style={{ color: '#555', fontSize: '12px' }}>Output will appear here...</div>
                )}
            </div>
        </div>
    );
}
