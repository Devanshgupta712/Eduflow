'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiFetch } from '@/lib/api';
import WebDevEditor from '@/components/WebDevEditor';
import ProctoringOverlay from '@/components/ProctoringOverlay';

function StudentAssessmentsContent() {
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubmission, setActiveSubmission] = useState<any>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    const router = useRouter();
    // useSearchParams requires wrapping the page in Suspense strictly, but since it's a client component Next.js handles it mostly fine.
    // To be perfectly safe across all Next.js versions we use a dummy fallback if useSearchParams issues a warning, but normally it's fine.
    const searchParams = useSearchParams();
    const startId = searchParams.get('start');
    const [submitDone, setSubmitDone] = useState(false);
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds remaining

    // Date filter — defaults to today
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [showAllDates, setShowAllDates] = useState(false);

    const [content, setContent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [reportData, setReportData] = useState<any>(null);

    // Proctoring & Lock State
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
    const [faceViolationCount, setFaceViolationCount] = useState(0);
    const [micViolationCount, setMicViolationCount] = useState(0);
    const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
    const [isProctoringActive, setIsProctoringActive] = useState(false);
    const [graceCountdown, setGraceCountdown] = useState<number | null>(null);
    const [violationType, setViolationType] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const heartbeatRef = useRef<any>(null);

    useEffect(() => { loadAssignments(); }, []);

    // Fullscreen and Tab Locking Logic
    useEffect(() => {
        if (!activeSubmission || submitDone) {
            setIsProctoringActive(false);
            setGraceCountdown(null);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            return;
        }

        const onVisibilityChange = () => {
            if (document.hidden && !submitDone) {
                setTabSwitchCount(prev => prev + 1);
                triggerGracePeriod('TAB_SWITCH');
            }
        };

        const onFullscreenChange = () => {
            if (!document.fullscreenElement && !submitDone) {
                setFullscreenExitCount(prev => prev + 1);
                triggerGracePeriod('FULLSCREEN_EXIT');
            }
        };

        const preventSecurityRisks = (e: any) => {
            if (e.type === 'copy' || e.type === 'paste') {
                e.preventDefault();
                alert('Copying & Pasting is strictly disabled during assessments.');
            }
            if (e.type === 'contextmenu') {
                e.preventDefault();
                triggerGracePeriod("Right-click disabled");
            }
            if (e.type === 'keydown') {
                const keyEvent = e as KeyboardEvent;
                if ((keyEvent.ctrlKey || keyEvent.metaKey) && (keyEvent.key.toLowerCase() === 'c' || keyEvent.key.toLowerCase() === 'v')) {
                    keyEvent.preventDefault();
                    alert('Copying & Pasting is strictly disabled during assessments.');
                }
                // Block Alt, Tab, Escape, and Meta/Windows Keys
                if (keyEvent.key === 'Alt' || keyEvent.key === 'Tab' || keyEvent.key === 'Escape' || keyEvent.metaKey) {
                    keyEvent.preventDefault();
                }
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('copy', preventSecurityRisks, { capture: true });
        document.addEventListener('paste', preventSecurityRisks, { capture: true });
        document.addEventListener('keydown', preventSecurityRisks, { capture: true });
        document.addEventListener('contextmenu', preventSecurityRisks, { capture: true });

        // Start Heartbeat
        heartbeatRef.current = setInterval(sendHeartbeat, 30000);

        // Sidebar/body scroll lock
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener('copy', preventSecurityRisks, { capture: true });
            document.removeEventListener('paste', preventSecurityRisks, { capture: true });
            document.removeEventListener('keydown', preventSecurityRisks, { capture: true });
            document.removeEventListener('contextmenu', preventSecurityRisks, { capture: true });
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            document.body.style.overflow = 'unset';
        };
    }, [activeSubmission, submitDone]);

    // Timer and Grace Period Countdown
    useEffect(() => {
        let timer: any;
        if (graceCountdown !== null && graceCountdown > 0) {
            timer = setInterval(() => {
                setGraceCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
            }, 1000);
        } else if (graceCountdown === 0) {
            forceSubmit('Security Violation: Time-out');
        }

        return () => clearInterval(timer);
    }, [graceCountdown]);

    const triggerGracePeriod = (type: string) => {
        // Use functional state updates to avoid stale closure resets while active
        setViolationType(prev => prev ? prev : type);
        setGraceCountdown(prev => prev !== null ? prev : 30);
    };

    const resumeFullscreen = async () => {
        if (containerRef.current) {
            try {
                await containerRef.current.requestFullscreen();
                if ('keyboard' in navigator && (navigator as any).keyboard && (navigator as any).keyboard.lock) {
                    try { await (navigator as any).keyboard.lock(); } catch (e) { console.warn('Keyboard lock not fully supported', e); }
                }
                setGraceCountdown(null);
                setViolationType(null);
            } catch (e) {
                console.error('Fullscreen failed', e);
            }
        }
    };

    const loadAssignments = async () => {
        try {
            const data = await apiGet('/api/training/assignments');
            setAssignments(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-start assignment from deep link
    useEffect(() => {
        if (!loading && assignments.length > 0 && startId && !activeSubmission) {
            const target = assignments.find(a => a.id === startId);
            if (target && !target.my_submission && !isOverdue(target.due_date)) {
                startSession(target);
                // Remove start param from URL so refresh doesn't replay it
                router.replace('/student/assessments');
            }
        }
    }, [loading, assignments, startId, activeSubmission, router]);

    const startSession = async (assignment: any) => {
        try {
            const res = await apiFetch(`/api/training/assessments/ASSIGNMENT/${assignment.id}/start`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSessionId(data.session_id);
                // Store randomized questions and RESUME partial answers if found
                const sessionContent = data.responses ? JSON.parse(data.responses) : null;
                // Prefer session questions (randomized order), fall back to structured_content from the assignment
                let activeQs = sessionContent?.questions;
                if (!activeQs && assignment.structured_content) {
                    try {
                        const sc = JSON.parse(assignment.structured_content);
                        activeQs = sc.questions || null;
                    } catch(e) { console.error("Could not parse structured_content", e); }
                }
                
                // LOAD PREVIOUS PROGRESS (if any)
                let savedAnsMap = {};
                if (sessionContent?.saved_answers) {
                    const saved = sessionContent.saved_answers;
                    // If backend saved it as { content: stringified_json }
                    if (saved.content) {
                        try {
                            savedAnsMap = JSON.parse(saved.content);
                        } catch(err) { console.error("Could not parse saved answers", err); }
                    } else {
                        savedAnsMap = saved;
                    }
                }

                setActiveSubmission({
                    ...assignment,
                    activeQuestions: activeQs || null
                });
                
                setMcqAnswers(savedAnsMap);
                setContent(JSON.stringify(savedAnsMap));
                
                setIsProctoringActive(true);
                setSubmitDone(false);
                setFile(null);
                
                // Trigger auto-fullscreen
                setTimeout(resumeFullscreen, 500);
            } else {
                alert(data.detail || 'Could not start session. You may have already completed this assignment.');
            }
        } catch (e) {
            alert('Error starting session');
        }
    };

    const sendHeartbeat = async (customAnswers?: any) => {
        if (!sessionId || submitDone) return;
        try {
            // Priority: Use customAnswers if passed (forced save), otherwise use current state
            const answersToSave = customAnswers ? { content: JSON.stringify(customAnswers) } : { content };
            
            await apiFetch(`/api/training/assessments/${sessionId}/heartbeat`, {
                method: 'POST',
                body: JSON.stringify({
                    answers: answersToSave,
                    fullscreen_exited: fullscreenExitCount > 0,
                    face_violation: faceViolationCount > 0,
                    tab_switched: tabSwitchCount > 0,
                    mic_violation: micViolationCount > 0
                })
            });
        } catch (e) { console.error('Heartbeat failed', e); }
    };

    const forceSubmit = async (reason: string) => {
        alert(`Assignment Auto-Submitted: ${reason}`);
        submitHandler(true);
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
    };

    const submitHandler = async (isAuto = false) => {
        if (submitLoading) return;
        setSubmitLoading(true);
        try {
            const formData = new FormData();
            if (content) formData.append('content', content);
            if (file) formData.append('file', file);
            let url = `/api/training/assignments/${activeSubmission.id}/submit`;
            let fetchOptions: any = { method: 'POST', body: formData };

            // If we are in a proctored session, ALWAYS use the secure session route
            if (sessionId) {
                url = `/api/training/assessments/${sessionId}/submit`;
                fetchOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        answers: activeSubmission.type === 'MCQ' ? mcqAnswers : { content: content || " " } 
                    })
                };
            }

            const res = await apiFetch(url, fetchOptions);

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                setFinalScore(data.score !== undefined ? data.score : (data.marks !== undefined ? data.marks : null));
                setSubmitDone(true);
                if (document.fullscreenElement) document.exitFullscreen();
                setTimeout(() => {
                    setActiveSubmission(null);
                    setSessionId(null);
                    setSubmitDone(false);
                    setFinalScore(null);
                    loadAssignments();
                }, 5000);
            } else {
                alert('Submission failed.');
            }
        } catch (error) {
            alert('Error submitting.');
        } finally {
            setSubmitLoading(false);
        }
    };

    const isOverdue = (dueDate: string | null) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Assignments</h1>
                    <p className="page-subtitle">Standard proctored assessments environment</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid-4 mb-24">
                <div className="stat-card primary"><div className="stat-icon primary">📝</div><div className="stat-info"><h3>Total</h3><div className="stat-value">{assignments.length}</div></div></div>
                <div className="stat-card success"><div className="stat-icon success">✅</div><div className="stat-info"><h3>Submitted</h3><div className="stat-value">{assignments.filter(a => a.my_submission).length}</div></div></div>
                <div className="stat-card danger"><div className="stat-icon danger">⏰</div><div className="stat-info"><h3>Pending</h3><div className="stat-value">{assignments.filter(a => !a.my_submission).length}</div></div></div>
                <div className="stat-card accent"><div className="stat-icon accent">🔒</div><div className="stat-info"><h3>Security</h3><div className="stat-value">Active</div></div></div>
            </div>

            {/* Date Filter */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Date:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => { setSelectedDate(e.target.value); setShowAllDates(false); }}
                        style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                    />
                </div>
                <button
                    className={`btn btn-sm ${showAllDates ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setShowAllDates(!showAllDates)}
                    style={{ borderRadius: '20px', fontSize: '12px', padding: '6px 14px' }}
                >
                    {showAllDates ? '✕ Showing All' : 'Show All Dates'}
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Showing {(showAllDates ? assignments : assignments.filter(a => {
                        const created = a.created_at ? a.created_at.split('T')[0] : '';
                        const due = a.due_date ? a.due_date.split('T')[0] : '';
                        return created === selectedDate || due === selectedDate;
                    })).length} of {assignments.length}
                </span>
            </div>

            {loading ? <p>Loading...</p> : (() => {
                const filteredAssignments = showAllDates
                    ? assignments
                    : assignments.filter(a => {
                        const created = a.created_at ? a.created_at.split('T')[0] : '';
                        const due = a.due_date ? a.due_date.split('T')[0] : '';
                        return created === selectedDate || due === selectedDate;
                    });
                return filteredAssignments.length === 0 ? (
                    <div className="card"><div className="empty-state"><div className="empty-icon">📝</div><h3>{assignments.length === 0 ? 'No assignments yet' : 'No assignments for this date'}</h3><p className="text-sm text-muted">{assignments.length === 0 ? 'No assignments assigned to you yet.' : 'Select a different date or click "Show All Dates".'}</p></div></div>
                ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {filteredAssignments.map(a => (
                        <div key={a.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontWeight: 600 }}>{a.title}</h3>
                                    {a.my_submission && (
                                        <div style={{ 
                                            display: 'inline-block', marginTop: '6px',
                                            background: 'var(--primary-glow)', color: 'var(--primary)', 
                                            padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                                            border: '1px solid var(--primary)'
                                        }}>
                                            Score: {a.my_submission.marks ?? '—'} / {a.total_marks}
                                        </div>
                                    )}
                                </div>
                                <span className={`badge ${a.my_submission ? 'badge-success' : 'badge-warning'}`}>
                                    {a.my_submission ? 'Completed' : 'Pending'}
                                </span>
                            </div>
                            <p className="text-muted text-sm">{a.description?.slice(0, 100)}...</p>
                                {a.my_submission ? (
                                    <button
                                        className="btn btn-secondary"
                                        style={{ width: '100%', marginTop: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 700 }}
                                        onClick={() => setReportData(a)}
                                    >
                                        🔍 View Assessment Report
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        style={{ width: '100%', marginTop: 'auto' }}
                                        onClick={() => startSession(a)}
                                        disabled={isOverdue(a.due_date)}
                                    >
                                        Start Secure Assessment
                                    </button>
                                )}
                        </div>
                    ))}
                </div>
                );
            })()}

            {/* Proctoring Implementation */}
            {activeSubmission && typeof document !== 'undefined' && createPortal(
                <div ref={containerRef} style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    zIndex: 9999999, background: 'var(--bg-primary)', 
                    display: 'flex', flexDirection: 'column', overflow: 'hidden' 
                }}>
                    <ProctoringOverlay 
                        isActive={isProctoringActive && !submitDone}
                        onViolation={(type) => {
                            if (type === 'NO_FACE' || type === 'MULTI_FACE') {
                                setFaceViolationCount(prev => prev + 1);
                                triggerGracePeriod(type);
                            } else if (type === 'HIGH_NOISE') {
                                setMicViolationCount(prev => prev + 1);
                                triggerGracePeriod("Background Noise Too High");
                            } else if (type === 'SCREEN_STOPPED') {
                                forceSubmit('Screen sharing stopped');
                            }
                        }}
                        onMetricsUpdate={() => {}}
                    />

                    {/* Grace Period Overlay */}
                    {graceCountdown !== null && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10000001,
                            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            textAlign: 'center', color: '#fff', padding: '40px'
                        }}>
                            <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</div>
                            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px' }}>Security Violation Detected</h2>
                            <p style={{ fontSize: '18px', opacity: 0.8, maxWidth: '500px', marginBottom: '40px' }}>
                                Type: <span style={{ color: '#ef4444', fontWeight: 700 }}>{violationType?.replace('_', ' ')}</span><br />
                                Please return to fullscreen and ensure only one face is visible.
                            </p>
                            
                            <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '48px' }}>
                                <svg width="120" height="120" viewBox="0 0 120 120">
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="#ef4444" strokeWidth="8" 
                                        strokeDasharray="339.292" strokeDashoffset={339.292 * (1 - graceCountdown / 30)}
                                        style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '32px', fontWeight: 800 }}>
                                    {graceCountdown}
                                </div>
                            </div>

                            <button className="btn btn-primary btn-lg" onClick={resumeFullscreen} style={{ padding: '16px 48px' }}>
                                Resume Assessment
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', padding: '32px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <h2 className="modal-title" style={{ marginBottom: '8px', fontSize: '28px' }}>{activeSubmission.title}</h2>
                                    <p className="text-muted" style={{ marginBottom: 0, fontSize: '15px', lineHeight: '1.6', maxWidth: '800px' }}>
                                        {activeSubmission.description || "Refer to the instructions to solve the challenges below."}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className="badge badge-warning" style={{ fontSize: '12px', display: 'inline-block', marginBottom: '4px' }}>Proctoring Active</span>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Keep tab focused & stay in view.</div>
                                    </div>
                                    {!submitDone && (
                                        <button 
                                            onClick={() => submitHandler()} 
                                            className="btn btn-primary btn-lg" 
                                            disabled={submitLoading || (activeSubmission.type === 'CODING' && content.length < 10)}
                                            style={{ height: '48px', padding: '0 32px', fontSize: '15px', fontWeight: 700, boxShadow: 'var(--shadow-premium)' }}
                                        >
                                            {submitLoading ? 'Submitting...' : 'Complete & Submit'}
                                        </button>
                                    )}
                                </div>
                            </div>

                        {submitDone ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                <div className="animate-in" style={{ maxWidth: '400px' }}>
                                    <div style={{ fontSize: '72px', marginBottom: '24px' }}>🏆</div>
                                    <h2 style={{ fontSize: '32px', marginBottom: '8px' }}>Assessment Complete</h2>
                                    <p className="text-muted" style={{ marginBottom: '32px' }}>Your submission has been securely recorded.</p>
                                    
                                    {finalScore !== null && (
                                        <div style={{ 
                                            background: 'var(--primary-glow)', 
                                            border: '1px solid var(--primary)', 
                                            padding: '24px', borderRadius: '16px',
                                            marginBottom: '32px'
                                        }}>
                                            <div style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Your Score</div>
                                            <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--text-primary)' }}>{finalScore}%</div>
                                        </div>
                                    )}
                                    
                                    <p className="text-muted" style={{ fontSize: '14px' }}>Returning to dashboard in a moment...</p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={(e) => { e.preventDefault(); submitHandler(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', borderRadius: '12px', border: '1px solid var(--border)', background: activeSubmission.type === 'CODING' ? '#1e1e1e' : 'var(--bg-secondary)', padding: activeSubmission.type === 'CODING' ? '0' : '24px' }}>
                                    {activeSubmission.type === 'CODING' && (
                                        <WebDevEditor code={content} onChange={setContent} />
                                    )}
                                    
                                    {(activeSubmission.type === 'WRITTEN' || activeSubmission.type === 'PROJECT') && (
                                        <textarea 
                                            value={content} 
                                            onChange={e => setContent(e.target.value)}
                                            placeholder="Write your response here..."
                                            style={{ width: '100%', height: '100%', background: 'transparent', color: 'inherit', border: 'none', outline: 'none', resize: 'none', fontSize: '16px', lineHeight: '1.6' }}
                                        />
                                    )}

                                    {activeSubmission.type === 'MCQ' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                            {(() => {
                                                try {
                                                    // Use ACTIVE randomized questions if available, else original struct
                                                    const struct = JSON.parse(activeSubmission.structured_content || '{}');
                                                    const qs = activeSubmission.activeQuestions || struct.questions || [];
                                                    return qs.map((q: any, i: number) => {
                                                        const isSaved = mcqAnswers[i] !== undefined;
                                                        return (
                                                            <div key={i} className="card shadow-sm" style={{ padding: '28px', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--border)', position: 'relative' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
                                                                    <h4 style={{ margin: 0, fontSize: '18px', lineHeight: 1.5, fontWeight: 700, flex: 1 }}>{i + 1}. {q.question}</h4>
                                                                    {isSaved && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 900, background: '#10b98115', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap', marginLeft: '12px' }}>✓ PROGRESS SAVED</span>}
                                                                </div>
                                                                
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                                                    {q.options.map((opt: string, oi: number) => (
                                                                        <label key={oi} style={{ 
                                                                            display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderRadius: '14px', 
                                                                            background: mcqAnswers[i] === oi ? 'var(--primary-glow)' : 'var(--bg-secondary)', 
                                                                            cursor: 'pointer', transition: 'all 0.2s',
                                                                            border: `2px solid ${mcqAnswers[i] === oi ? 'var(--primary)' : 'transparent'}`,
                                                                            boxShadow: mcqAnswers[i] === oi ? 'var(--shadow-sm)' : 'none'
                                                                        }}>
                                                                            <input 
                                                                                type="radio" 
                                                                                name={`q-${i}`} 
                                                                                checked={mcqAnswers[i] === oi}
                                                                                    onChange={() => {
                                                                                        const newAns = { ...mcqAnswers, [i]: oi };
                                                                                        setMcqAnswers(newAns);
                                                                                        const contentStr = JSON.stringify(newAns);
                                                                                        setContent(contentStr);
                                                                                        // FORCE-SAVE immediately with the new answers to avoid stale state
                                                                                        sendHeartbeat(newAns);
                                                                                    }}
                                                                                style={{ accentColor: 'var(--primary)', transform: 'scale(1.2)' }}
                                                                            />
                                                                            <span style={{ fontSize: '15.5px', fontWeight: mcqAnswers[i] === oi ? 600 : 400 }}>{String.fromCharCode(65 + oi)}. {opt}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>

                                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => sendHeartbeat(mcqAnswers)}
                                                                        className="btn btn-secondary btn-sm"
                                                                        style={{ 
                                                                            fontSize: '11px', padding: '8px 16px', borderRadius: '10px',
                                                                            background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)',
                                                                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
                                                                        }}
                                                                    >
                                                                        📥 Save This Question
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                } catch (e) {
                                                    return <p className="text-danger">Error loading questions. Please contact support.</p>;
                                                }
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>
                </div>, document.body
            )}

            {/* Assessment Report Modal */}
            {reportData && (
                <div className="modal-overlay" onClick={() => setReportData(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '0', borderRadius: '24px' }}>
                        <div style={{ background: 'var(--primary-glow)', padding: '32px', borderBottom: '1px solid var(--primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>{reportData.title}</h2>
                                    <p style={{ margin: '8px 0 0', opacity: 0.7 }}>{reportData.type} Performance Report</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary)' }}>{reportData.my_submission.marks}%</div>
                                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Final Score</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '32px' }}>
                            {reportData.type === 'MCQ' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {(() => {
                                        try {
                                            const sessionResRaw = reportData.my_submission.session_responses;
                                            const sessionContent = sessionResRaw ? JSON.parse(sessionResRaw) : {};
                                            const results = sessionContent.results || [];
                                            
                                            // PRIORITIZE QUESTIONS FROM SESSION (fixes randomization mismatch)
                                            const struct = JSON.parse(reportData.structured_content || '{}');
                                            const questions = sessionContent.questions || struct.questions || [];
                                            
                                            return questions.map((q: any, i: number) => {
                                                const res = results.find((r: any) => r.index === i);
                                                const studentChoice = (res && res.selected !== undefined) ? res.selected : null;
                                                const isCorrect = res ? res.is_correct : false;
                                                const isSkipped = studentChoice === null || studentChoice === undefined;

                                                return (
                                                    <div key={i} style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '20px', border: `1px solid ${isCorrect ? '#10b98130' : (isSkipped ? 'var(--border)' : '#ef444430')}`, boxShadow: 'var(--shadow-sm)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{i + 1}. {q.question}</h4>
                                                                {isSkipped && <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, marginTop: '4px' }}>⚠️ NOT ANSWERED</div>}
                                                            </div>
                                                            <span className={`badge ${isCorrect ? 'badge-success' : 'badge-danger'}`} style={{ 
                                                                height: 'fit-content', padding: '8px 14px', borderRadius: '10px', 
                                                                fontSize: '11px', fontWeight: 900, textTransform: 'uppercase',
                                                                background: isCorrect ? '#10b981' : '#ef4444',
                                                                color: '#fff', border: 'none'
                                                            }}>
                                                                {isCorrect ? '✓ Correct' : '✕ Incorrect'}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            {q.options.map((opt: string, oi: number) => {
                                                                // ROBUST COMPARISON (Handle string vs number)
                                                                const isStudentSelected = studentChoice !== null && studentChoice !== undefined && String(studentChoice) === String(oi);
                                                                const isCorrectAnswer = String(q.answer) === String(oi);
                                                                
                                                                let bg = 'var(--bg-primary)';
                                                                let border = '1px solid var(--border)';
                                                                let opacity = 1;

                                                                if (isCorrectAnswer) {
                                                                    bg = '#10b98110';
                                                                    border = '1px solid #10b981';
                                                                } else if (isStudentSelected && !isCorrectAnswer) {
                                                                    bg = '#ef444410';
                                                                    border = '2px solid #ef4444'; // Make wrong choice border thicker
                                                                } else if (studentChoice !== null && studentChoice !== undefined) {
                                                                    opacity = 0.5; 
                                                                }

                                                                return (
                                                                    <div key={oi} style={{ 
                                                                        padding: '16px 20px', borderRadius: '14px', background: bg, border: border, 
                                                                        fontSize: '14.5px', display: 'flex', justifyContent: 'space-between', 
                                                                        alignItems: 'center', opacity: opacity, transition: 'all 0.2s',
                                                                        boxShadow: isStudentSelected || isCorrectAnswer ? 'var(--shadow-sm)' : 'none'
                                                                    }}>
                                                                        <span style={{ fontWeight: isStudentSelected || isCorrectAnswer ? 650 : 450, color: isStudentSelected && !isCorrectAnswer ? '#ef4444' : 'inherit' }}>
                                                                            <span style={{ opacity: 0.6, marginRight: '8px' }}>{String.fromCharCode(65 + oi)}.</span>
                                                                            {opt}
                                                                        </span>
                                                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                                            {isCorrectAnswer && (
                                                                                <span style={{ color: '#059669', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                                                                                    Correct Answer
                                                                                </span>
                                                                            )}
                                                                            {isStudentSelected && (
                                                                                <span style={{ 
                                                                                    background: isCorrectAnswer ? '#10b981' : '#ef4444', 
                                                                                    color: '#fff', padding: '5px 10px', borderRadius: '8px', 
                                                                                    fontSize: '10px', fontWeight: 900, boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                                                }}>
                                                                                    {isCorrectAnswer ? '✓ YOUR SELECTION' : '✕ YOUR SELECTION'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {(q.explanation || (res && res.explanation)) && (
                                                            <div style={{ 
                                                                marginTop: '24px', padding: '16px 20px', 
                                                                background: 'var(--bg-secondary)', borderRadius: '14px', 
                                                                fontSize: '13px', lineHeight: '1.7', borderLeft: '4px solid var(--primary)',
                                                                color: 'var(--text-muted)'
                                                            }}>
                                                                <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>💡 Educational Explanation</strong>
                                                                {q.explanation || res.explanation}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        } catch (e) {
                                            console.error("Report error:", e);
                                            return <p className="text-danger">Error rendering report. Please check if submission data is complete.</p>;
                                        }
                                    })()}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <h4 style={{ marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', opacity: 0.6 }}>Your Submission</h4>
                                        <div style={{ padding: '20px', background: '#1e1e1e', color: '#fff', borderRadius: '12px', fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
                                            {reportData.my_submission.content || "Empty submission"}
                                        </div>
                                    </div>
                                    {reportData.my_submission.feedback && (
                                        <div>
                                            <h4 style={{ marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', opacity: 0.6 }}>AI Instructor Feedback</h4>
                                            <div style={{ padding: '20px', background: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: '12px', fontSize: '15px', lineHeight: '1.6' }}
                                                dangerouslySetInnerHTML={{
                                                    __html: reportData.my_submission.feedback
                                                        .replace(/### (.*?)(?:\n|$)/g, '<h5 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px; color: var(--text-primary); font-weight: 800">$1</h5>')
                                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                        .replace(/\n/g, '<br/>')
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <button className="btn btn-primary" onClick={() => setReportData(null)} style={{ marginTop: '32px', width: '100%', padding: '16px' }}>Close Report</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StudentAssessmentsPage() {
    return (
        <Suspense fallback={<p>Loading Workspace...</p>}>
            <StudentAssessmentsContent />
        </Suspense>
    );
}
