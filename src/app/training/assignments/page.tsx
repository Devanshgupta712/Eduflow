'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiFetch, API_BASE } from '@/lib/api';

interface AssignmentItem {
    id: string; title: string; description: string | null;
    type: string; batch_id: string | null; total_marks: number;
    assigned_by: string | null; due_date: string | null;
    submission_count: number; created_at: string;
}

const typeIcons: Record<string, string> = { CODING: '💻', WRITTEN: '✍️', MCQ: '📝', PROJECT: '🏗️' };
const typeColors: Record<string, string> = { CODING: '#6366f1', WRITTEN: '#10b981', MCQ: '#f59e0b', PROJECT: '#06b6d4' };

type ModalStep = 'method' | 'ai_config' | 'ai_review' | 'pdf' | 'assign' | 'common';

export default function AssignmentsPage() {
    const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState<ModalStep>('method');

    // Date filter — defaults to today
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [showAllDates, setShowAllDates] = useState(false);

    // Overdue detail modal
    const [showOverdueModal, setShowOverdueModal] = useState(false);
    const [overdueDetails, setOverdueDetails] = useState<any[]>([]);
    const [loadingOverdue, setLoadingOverdue] = useState(false);

    // Batches & Students
    const [batches, setBatches] = useState<any[]>([]);
    const [batchStudents, setBatchStudents] = useState<any[]>([]);
    const [assignTarget, setAssignTarget] = useState<'batch' | 'student'>('batch');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState('');

    // Form
    const [form, setForm] = useState({ title: '', description: '', type: 'CODING', types: ['CODING'], total_marks: '100', due_date: '', time_limit: '0' });
    const [saving, setSaving] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<any>(null);

    // AI generation
    const [aiTopic, setAiTopic] = useState('');
    const [aiDifficulty, setAiDifficulty] = useState('Intermediate');
    const [aiQuestionCount, setAiQuestionCount] = useState(5);
    const [aiTimeLimit, setAiTimeLimit] = useState(0);
    const [aiRandomize, setAiRandomize] = useState(true);
    const [aiScheduledAt, setAiScheduledAt] = useState('');
    const [generating, setGenerating] = useState(false);

    const [aiPreview, setAiPreview] = useState<any>(null);
    const [aiPreviews, setAiPreviews] = useState<any[]>([]);
    const [aiError, setAiError] = useState('');

    // PDF upload
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Submissions
    const [viewSubmissions, setViewSubmissions] = useState<any>(null);
    const [submissionsData, setSubmissionsData] = useState<any[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);
    const [subFilter, setSubFilter] = useState<'ALL' | 'SUBMITTED' | 'PENDING'>('ALL');
    const searchParams = useSearchParams();

    useEffect(() => { loadAssignments(); loadBatches(); }, []);

    // Check for deep-link from search
    useEffect(() => {
        const id = searchParams.get('id');
        if (id && assignments.length > 0 && !viewSubmissions) {
            const a = assignments.find(x => x.id === id);
            if (a) handleViewSubmissions(a);
        }
    }, [searchParams, assignments]);

    const loadAssignments = async () => {
        try { setAssignments(await apiGet('/api/training/assignments')); } catch { } finally { setLoading(false); }
    };

    const loadBatches = async () => {
        try { setBatches(await apiGet('/api/admin/batches')); } catch { }
    };

    const loadStudents = async (batchId: string) => {
        if (!batchId) { setBatchStudents([]); return; }
        try {
            const data = await apiGet(`/api/training/batches/${batchId}/students`);
            setBatchStudents(data);
        } catch { setBatchStudents([]); }
    };

    const resetModal = () => {
        setStep('method');
        setForm({ title: '', description: '', type: 'CODING', types: ['CODING'], total_marks: '100', due_date: '', time_limit: '0' });
        setAiTopic(''); setAiDifficulty('Intermediate');
        setAiScheduledAt('');
        setAiQuestionCount(5); setAiTimeLimit(0); setAiRandomize(true);
        setAiPreview(null); setAiPreviews([]); setAiError('');
        setPdfFile(null);
        setSelectedBatch(''); setSelectedStudent('');
        setAssignTarget('batch'); setBatchStudents([]);
        setEditingAssignment(null);
    };

    const openEditModal = (a: any) => {
        setEditingAssignment(a);
        setForm({
            title: a.title || '',
            description: a.description || '',
            type: a.type || 'CODING',
            types: [a.type || 'CODING'],
            total_marks: String(a.total_marks || 100),
            due_date: a.due_date ? a.due_date.slice(0, 16) : '',
            time_limit: String(a.time_limit || 0),
        });
        setSelectedBatch(a.batch_id || '');
        if (a.batch_id) loadStudents(a.batch_id);
        setSelectedStudent(a.student_id || '');
        setAssignTarget(a.student_id ? 'student' : 'batch');
        if (a.structured_content) {
            try {
                const sc = JSON.parse(a.structured_content);
                setAiPreviews([{ ...sc, generatedType: a.type }]);
                setAiPreview(sc);
            } catch {}
        }
        setStep('common');
        setShowModal(true);
    };

    // ── AI Generation ─────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        const typesToGenerate = form.types && form.types.length > 0 ? form.types : [form.type];
        if (!aiTopic.trim()) { setAiError('Please enter a topic.'); return; }
        if (typesToGenerate.length === 0) { setAiError('Please select at least one assignment type.'); return; }
        
        setGenerating(true); setAiError(''); setAiPreviews([]); setAiPreview(null);
        try {
            const results = await Promise.all(typesToGenerate.map(async (t) => {
                const resp = await apiFetch('/api/training/generate-task', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        topic: aiTopic, 
                        task_type: t, 
                        difficulty: aiDifficulty, 
                        question_count: Number(aiQuestionCount),
                        time_limit: Number(aiTimeLimit),
                        is_randomized: aiRandomize,
                        scheduled_at: aiScheduledAt
                    })
                });
                if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.detail || `Failed to generate ${t}`); }
                const data = await resp.json();
                return { ...data, generatedType: t };
            }));

            setAiPreviews(results);
            setAiPreview(results[0]); // fallback for StepIndicator

            const combinedTitle = results.map(r => r.title).join(' & ');
            
            setForm(f => ({
                ...f,
                title: combinedTitle || f.title,
                time_limit: (aiTimeLimit || 0).toString(),
            }));
            setStep('ai_review');
        } catch (e: any) { setAiError(e?.message || 'AI generation failed.'); }
        finally { setGenerating(false); }
    };

    // ── Save Assignment ───────────────────────────────────────────────────────
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            let pdfUrl: string | undefined;
            if (pdfFile) {
                const fd = new FormData();
                fd.append('file', pdfFile);
                const token = localStorage.getItem('auth_token');
                const uploadResp = await fetch(`${API_BASE}/api/training/upload-assignment-pdf`, {
                    method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: fd,
                });
                if (uploadResp.ok) { const d = await uploadResp.json(); pdfUrl = d.url; }
            }

            // EDIT MODE
            if (editingAssignment) {
                const body: any = {
                    title: form.title, description: form.description,
                    type: form.type, total_marks: parseInt(form.total_marks) || 100,
                    due_date: form.due_date || null, time_limit: parseInt(form.time_limit) || 0,
                    is_randomized: aiRandomize,
                    ...(aiPreviews.length > 0 ? { structured_content: JSON.stringify(aiPreviews[0]) } : {}),
                    ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
                };
                const resp = await apiFetch(`/api/training/assignments/${editingAssignment.id}`, { method: 'PATCH', body: JSON.stringify(body) });
                if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || 'Failed to update');
                setShowModal(false); resetModal(); loadAssignments();
                return;
            }

            const baseBody: any = {
                ...form, 
                total_marks: parseInt(form.total_marks) || 100,
                time_limit: parseInt(form.time_limit) || 0,
                batch_id: selectedBatch || null,
                is_randomized: aiRandomize,
                ...(selectedStudent ? { student_id: selectedStudent } : {}),
                ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
            };

            if (aiPreviews && aiPreviews.length > 0) {
                await Promise.all(aiPreviews.map(async (preview: any) => {
                    const generatedDescription = form.type === 'CODING' && preview.questions?.[0] ? `${preview.description}\n\nProblem: ${preview.questions[0].question}` : preview.description;
                    const taskBody = {
                        ...baseBody,
                        title: aiPreviews.length > 1 ? `${form.title} - ${preview.generatedType}` : (preview.title || form.title),
                        description: generatedDescription || baseBody.description,
                        type: preview.generatedType,
                        total_marks: preview.total_marks || baseBody.total_marks,
                        structured_content: JSON.stringify(preview)
                    };
                    const resp = await apiFetch('/api/training/assignments', { method: 'POST', body: JSON.stringify(taskBody) });
                    if (!resp.ok) throw new Error(`Failed to create ${preview.generatedType} assignment`);
                }));
            } else {
                const resp = await apiFetch('/api/training/assignments', { method: 'POST', body: JSON.stringify(baseBody) });
                if (!resp.ok) throw new Error('Failed to create');
            }

            setShowModal(false); resetModal(); loadAssignments();
        } catch (err: any) { alert(err?.message || "Failed to save assignment."); } finally { setSaving(false); }
    };

    const handleViewSubmissions = async (assignment: any) => {
        setViewSubmissions(assignment); setSubmissionsData([]); setLoadingSubmissions(true);
        try { 
            const data = await apiGet(`/api/training/assignments/${assignment.id}/submissions`);
            setSubmissionsData(data); 
        } catch (e) {
            console.error("Failed to load submissions", e);
        } finally {
            setLoadingSubmissions(false);
        }
    };

    const isOverdue = (d: string | null) => !!d && new Date(d) < new Date();

    // Filter assignments by selected date
    const filteredAssignments = showAllDates
        ? assignments
        : assignments.filter(a => {
            const created = a.created_at ? a.created_at.split('T')[0] : '';
            const due = a.due_date ? a.due_date.split('T')[0] : '';
            return created === selectedDate || due === selectedDate;
        });

    // Build overdue student details
    const overdueAssignments = assignments.filter(a => isOverdue(a.due_date));

    const handleOverdueClick = async () => {
        setShowOverdueModal(true);
        setLoadingOverdue(true);
        try {
            const details: any[] = [];
            for (const a of overdueAssignments) {
                try {
                    const subs = await apiGet(`/api/training/assignments/${a.id}/submissions`);
                    const pending = subs.filter((s: any) => s.status !== 'SUBMITTED');
                    const submitted = subs.filter((s: any) => s.status === 'SUBMITTED');
                    details.push({
                        assignment: a,
                        pending,
                        submitted,
                        totalStudents: subs.length
                    });
                } catch { }
            }
            setOverdueDetails(details);
        } catch { } finally {
            setLoadingOverdue(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this assignment?')) return;
        try {
            const resp = await apiFetch(`/api/training/assignments/${id}`, { method: 'DELETE' });
            if (!resp.ok) throw new Error('Failed to delete assignment');
            loadAssignments();
        } catch (e) {
            console.error('Delete error', e);
            alert('Could not delete assignment. You may not have permission.');
        }
    };

    // ── Steps rendering ───────────────────────────────────────────────────────
    const StepIndicator = ({ steps, current }: { steps: string[]; current: number }) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
            {steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700,
                        background: i < current ? '#10b981' : i === current ? 'var(--primary)' : 'var(--border)',
                        color: i <= current ? '#fff' : 'var(--text-muted)',
                    }}>{i < current ? '✓' : i + 1}</div>
                    <span style={{ fontSize: '12px', color: i === current ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === current ? 600 : 400 }}>{s}</span>
                    {i < steps.length - 1 && <div style={{ width: '24px', height: '1px', background: 'var(--border)' }} />}
                </div>
            ))}
        </div>
    );

    const aiSteps = ['Method', 'Configure', 'Review', 'Assign', 'Details'];
    const pdfSteps = ['Method', 'Upload PDF', 'Assign', 'Details'];

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Assignments</h1>
                    <p className="page-subtitle">Graded coursework with deadlines & submissions</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetModal(); setShowModal(true); }}>+ New Assignment</button>
            </div>

            {/* Stats */}
            <div className="grid-4 mb-24">
                <div className="stat-card primary"><div className="stat-icon primary">📝</div><div className="stat-info"><h3>Total</h3><div className="stat-value">{assignments.length}</div></div></div>
                <div className="stat-card accent"><div className="stat-icon accent">💻</div><div className="stat-info"><h3>Coding</h3><div className="stat-value">{assignments.filter(a => a.type === 'CODING').length}</div></div></div>
                <div className="stat-card success"><div className="stat-icon success">📨</div><div className="stat-info"><h3>Submissions</h3><div className="stat-value">{assignments.reduce((s, a) => s + a.submission_count, 0)}</div></div></div>
                <div className="stat-card danger" onClick={handleOverdueClick} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <div className="stat-icon danger">⚠️</div>
                    <div className="stat-info">
                        <h3>Overdue</h3>
                        <div className="stat-value">{overdueAssignments.length}</div>
                        <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Click to view students →</div>
                    </div>
                </div>
            </div>

            {/* Date Filter Bar */}
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
                    Showing {filteredAssignments.length} of {assignments.length} assignments
                </span>
            </div>

            {/* Table */}
            {loading ? <p>Loading...</p> : filteredAssignments.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-icon">📝</div><h3>{assignments.length === 0 ? 'No assignments yet' : 'No assignments for this date'}</h3><p className="text-sm text-muted">{assignments.length === 0 ? 'Create your first assignment' : 'Try selecting a different date or click "Show All Dates"'}</p></div></div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>Assignment</th><th>Type</th><th>Marks</th><th>Due Date</th><th>Submissions</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                            {filteredAssignments.map(a => (
                                <tr key={a.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{a.title}</div>
                                        {a.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{a.description.slice(0, 60)}...</div>}
                                    </td>
                                    <td><span className="badge" style={{ background: `${typeColors[a.type]}20`, color: typeColors[a.type] }}>{typeIcons[a.type]} {a.type}</span></td>
                                    <td style={{ fontWeight: 600 }}>{a.total_marks}</td>
                                    <td>{a.due_date ? <span style={{ color: isOverdue(a.due_date) ? '#ef4444' : 'var(--text-muted)' }}>{new Date(a.due_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}{isOverdue(a.due_date) && ' ⚠️'}</span> : '—'}</td>
                                    <td>
                                        <button 
                                            className="btn btn-sm" 
                                            onClick={() => handleViewSubmissions(a)} 
                                            style={{ 
                                                background: 'var(--primary-glow)', 
                                                color: 'var(--primary)', 
                                                border: '1px solid var(--primary)',
                                                borderRadius: '20px',
                                                padding: '4px 12px',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            👁️ {a.submission_count} Submitted
                                        </button>
                                    </td>
                                    <td><span className={`badge ${isOverdue(a.due_date) ? 'badge-danger' : 'badge-success'}`}>{isOverdue(a.due_date) ? 'Overdue' : 'Active'}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-sm btn-ghost" onClick={() => handleViewSubmissions(a)} style={{ color: 'var(--primary)', padding: '4px 8px' }} title="View Submissions & Performance">
                                                📊
                                            </button>
                                            <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(a)} style={{ color: 'var(--primary)', padding: '4px 8px' }} title="Edit Assignment">
                                                ✏️
                                            </button>
                                            <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(a.id)} style={{ color: '#ef4444', padding: '4px 8px' }} title="Delete Assignment">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Create Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h2 className="modal-title" style={{ margin: 0 }}>{editingAssignment ? '✏️ Edit Assignment' : 'New Assignment'}</h2>
                            <button className="btn btn-sm btn-ghost" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        {/* ─ STEP: method ─ */}
                        {step === 'method' && (
                            <>
                                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>How do you want to create this assignment?</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setStep('ai_config')}
                                        style={{ padding: '28px 20px', border: '2px solid var(--border)', borderRadius: '12px', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                                    >
                                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>✨</div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>Generate with AI</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Describe a topic — AI builds the full task for you</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStep('pdf')}
                                        style={{ padding: '28px 20px', border: '2px solid var(--border)', borderRadius: '12px', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                                    >
                                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>Upload PDF</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload a task sheet or instructions PDF</div>
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ─ STEP: ai_config ─ */}
                        {step === 'ai_config' && (
                            <>
                                <StepIndicator steps={aiSteps} current={1} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                        <div className="form-group" style={{ margin: 0, gridRow: 'span 2' }}>
                                            <label className="form-label" style={{ marginBottom: '8px' }}>Assignment Types</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {['CODING', 'WRITTEN', 'MCQ', 'PROJECT'].map(t => (
                                                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', background: form.types?.includes(t) || (!form.types && form.type === t) ? 'var(--primary-glow)' : 'transparent', padding: '6px 10px', borderRadius: '8px', border: form.types?.includes(t) || (!form.types && form.type === t) ? '1px solid var(--primary)' : '1px solid transparent', transition: 'all 0.2s' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={form.types?.includes(t) || (!form.types && form.type === t)}
                                                            onChange={e => {
                                                                const currentTypes = form.types || [form.type];
                                                                if (e.target.checked) {
                                                                    setForm({ ...form, types: [...currentTypes, t], type: t });
                                                                } else {
                                                                    setForm({ ...form, types: currentTypes.filter(x => x !== t) });
                                                                }
                                                            }}
                                                            style={{ transform: 'scale(1.1)', accentColor: 'var(--primary)', cursor: 'pointer' }} 
                                                        />
                                                        {typeIcons[t]} {t}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Difficulty</label>
                                            <select className="form-input" value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)}>
                                                <option>Introductory</option>
                                                <option>Beginner</option>
                                                <option>Intermediate</option>
                                                <option>Advanced</option>
                                                <option>Professional</option>
                                                <option>Expert</option>
                                                <option>Master</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Items Count</label>
                                            <input type="number" min={1} max={25} className="form-input" value={aiQuestionCount} onChange={e => setAiQuestionCount(parseInt(e.target.value) || 5)} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Time Limit (mins, 0=none)</label>
                                            <input type="number" min={0} className="form-input" value={aiTimeLimit} onChange={e => setAiTimeLimit(parseInt(e.target.value) || 0)} />
                                        </div>
                                        <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', paddingTop: '28px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                                                <input type="checkbox" checked={aiRandomize} onChange={e => setAiRandomize(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                                                Shuffle questions per student
                                            </label>
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Topic / Subject *</label>
                                        <input className="form-input" value={aiTopic} onChange={e => { setAiTopic(e.target.value); setAiError(''); }}
                                            placeholder="e.g. Spring Boot REST API, React Hooks, SQL Joins..." />
                                        {aiError && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px' }}>⚠️ {aiError}</p>}
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Schedule Deployment (Optional)</label>
                                        <input type="datetime-local" className="form-input" value={aiScheduledAt} onChange={e => setAiScheduledAt(e.target.value)} />
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Leave blank to deploy immediately.</p>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn btn-ghost" onClick={() => setStep('method')}>← Back</button>
                                        <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                                            {generating ? '⏳ Generating...' : '✨ Generate Task'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ─ STEP: ai_review ─ */}
                        {step === 'ai_review' && aiPreviews && aiPreviews.length > 0 && (
                            <>
                                <StepIndicator steps={aiSteps} current={2} />
                                <div style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase' }}>✨ AI Generated — Question Preview</p>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>{form.title || aiPreviews[0].title}</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '45vh', overflowY: 'auto', paddingRight: '8px', marginBottom: '16px' }}>
                                    {aiPreviews.map((preview: any, idx: number) => (
                                        <div key={idx} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '16px', border: `1px solid ${typeColors[preview.generatedType]}30` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <div>
                                                    <p style={{ fontSize: '11px', color: typeColors[preview.generatedType], fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{typeIcons[preview.generatedType]} {preview.generatedType} SECTION</p>
                                                    <h3 style={{ margin: 0, fontSize: '16px' }}>{preview.title || "Generated Task"}</h3>
                                                </div>
                                                <span style={{ fontSize: '11px', padding: '2px 8px', background: `${typeColors[preview.generatedType]}20`, color: typeColors[preview.generatedType], borderRadius: '99px', fontWeight: 600 }}>
                                                    {aiDifficulty}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>{preview.description}</p>
                                            
                                            {preview.requirements?.length > 0 && (
                                                <div style={{ marginBottom: '16px' }}>
                                                    <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 6px' }}>Requirements:</p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {preview.requirements.map((r: string, i: number) => (
                                                            <div key={i} style={{ fontSize: '12px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                <span style={{ color: '#10b981', fontWeight: 700 }}>{i + 1}.</span> {r}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {(preview.questions || []).map((q: any, i: number) => {
                                                    const isMCQ = preview.generatedType === 'MCQ' || !!q.options;
                                                    return (
                                                        <div key={i} style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: `1px solid var(--border)` }}>
                                                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Q{i+1}. {q.question}</div>
                                                            {isMCQ && q.options && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                                                                    {q.options.map((opt: string, oi: number) => (
                                                                        <div key={oi} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: q.answer === oi ? '#10b98115' : 'transparent', border: q.answer === oi ? '1px solid #10b981' : '1px solid transparent', color: q.answer === oi ? '#10b981' : 'var(--text-secondary)' }}>
                                                                            {String.fromCharCode(65+oi)}. {opt} {q.answer === oi ? '✓' : ''}
                                                                        </div>
                                                                    ))}
                                                                    {q.explanation && <p style={{ fontSize: '11px', color: 'var(--primary)', margin: '6px 0 0', paddingLeft: '4px' }}>💡 {q.explanation}</p>}
                                                                </div>
                                                            )}
                                                            {!isMCQ && q.initial_code && (
                                                                <pre style={{ fontSize: '11px', background: '#1e1e1e', color: '#4ade80', padding: '8px', borderRadius: '6px', overflow: 'auto', margin: '4px 0 0' }}>{q.initial_code.slice(0, 200)}</pre>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Editable fields */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Base Title</label>
                                        <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>If multiple types are generated, their type will be appended.</div>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Base Description / Instructions</label>
                                        <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setStep('ai_config')}>← Regenerate</button>
                                    <button type="button" className="btn btn-primary" onClick={() => setStep('assign')}>Next: Assign To →</button>
                                </div>
                            </>
                        )}

                        {/* ─ STEP: pdf ─ */}
                        {step === 'pdf' && (
                            <>
                                <StepIndicator steps={pdfSteps} current={1} />
                                <div className="form-group" style={{ margin: '0 0 14px' }}>
                                    <label className="form-label">Title *</label>
                                    <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Build a Student Management API" />
                                </div>
                                <div
                                    style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-secondary)', marginBottom: '16px' }}
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                                    {pdfFile ? (
                                        <div><div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                                            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>{pdfFile.name}</p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{(pdfFile.size / 1024).toFixed(1)} KB — click to change</p>
                                        </div>
                                    ) : (
                                        <div><div style={{ fontSize: '40px', marginBottom: '8px' }}>📂</div>
                                            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Click to upload PDF</p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Task sheet or instructions (PDF only)</p>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setStep('method')}>← Back</button>
                                    <button type="button" className="btn btn-primary" disabled={!form.title.trim()} onClick={() => setStep('assign')}>Next: Assign To →</button>
                                </div>
                            </>
                        )}

                        {/* ─ STEP: assign ─ */}
                        {(step === 'assign') && (
                            <>
                                <StepIndicator steps={step === 'assign' ? (aiPreview ? aiSteps : pdfSteps) : []} current={aiPreview ? 3 : 2} />
                                <p style={{ fontWeight: 600, marginBottom: '12px' }}>Who should receive this assignment?</p>

                                {/* Radio toggle */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                    {['batch', 'student'].map(t => (
                                        <button key={t} type="button" onClick={() => { setAssignTarget(t as any); setSelectedStudent(''); }}
                                            style={{ flex: 1, padding: '12px', border: `2px solid ${assignTarget === t ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '10px', background: assignTarget === t ? 'var(--primary)10' : 'var(--bg-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: assignTarget === t ? 'var(--primary)' : 'var(--text-primary)' }}>
                                            {t === 'batch' ? '🏫 Entire Batch' : '👤 Specific Student'}
                                        </button>
                                    ))}
                                </div>

                                {/* Batch selector */}
                                <div className="form-group">
                                    <label className="form-label">Select Batch {assignTarget === 'batch' ? '*' : '(to pick student from)'}</label>
                                    <select className="form-input" value={selectedBatch} onChange={e => { setSelectedBatch(e.target.value); setSelectedStudent(''); loadStudents(e.target.value); }}>
                                        <option value="">— Select Batch —</option>
                                        {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.course_name})</option>)}
                                    </select>
                                </div>

                                {/* Student selector */}
                                {assignTarget === 'student' && selectedBatch && (
                                    <div className="form-group">
                                        <label className="form-label">Select Student *</label>
                                        <select className="form-input" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                                            <option value="">— Select Student —</option>
                                            {batchStudents.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                                        </select>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setStep(aiPreview ? 'ai_review' : 'pdf')}>← Back</button>
                                    <button type="button" className="btn btn-primary"
                                        disabled={!selectedBatch && assignTarget === 'batch' || (assignTarget === 'student' && !selectedStudent)}
                                        onClick={() => setStep('common')}>
                                        Next: Details →
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ─ STEP: common ─ */}
                        {step === 'common' && (
                            <>
                                <StepIndicator steps={aiPreview ? aiSteps : pdfSteps} current={aiPreview ? 4 : 3} />
                                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Title *</label>
                                        <input className="form-input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Description / Instructions</label>
                                        <textarea className="form-input" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Type</label>
                                            <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                                <option value="CODING">💻 Coding</option>
                                                <option value="WRITTEN">✍️ Written</option>
                                                <option value="MCQ">📝 MCQ</option>
                                                <option value="PROJECT">🏗️ Project</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Marks</label>
                                            <input type="number" className="form-input" value={form.total_marks} onChange={e => setForm({ ...form, total_marks: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Due Time</label>
                                            <input type="datetime-local" className="form-input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Limit (Min)</label>
                                            <input type="number" placeholder="0 = No limit" className="form-input" value={form.time_limit} onChange={e => setForm({ ...form, time_limit: e.target.value })} />
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        📋 <strong>Assigning to:</strong> {assignTarget === 'batch'
                                            ? `${batches.find(b => b.id === selectedBatch)?.name || 'Selected batch'} (all students)`
                                            : `${batchStudents.find((s: any) => s.id === selectedStudent)?.name || 'Selected student'}`
                                        }
                                        {aiPreview && <> · <span style={{ color: '#10b981' }}>✨ AI Generated</span></>}
                                        {pdfFile && <> · <span style={{ color: '#6366f1' }}>📄 {pdfFile.name}</span></>}
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn btn-ghost" onClick={() => setStep('assign')}>← Back</button>
                                        <button type="submit" className="btn btn-primary" disabled={saving}>
                                            {saving ? 'Creating...' : '✅ Create Assignment'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Submissions Modal ── */}
            {viewSubmissions && (
                <div className="modal-overlay" onClick={() => { setViewSubmissions(null); setSubmissionsData([]); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 className="modal-title" style={{ margin: 0 }}>Submissions: {viewSubmissions.title}</h2>
                            <button className="btn btn-sm btn-ghost" onClick={() => { setViewSubmissions(null); setSubmissionsData([]); }}>✕ Close</button>
                        </div>
                        {loadingSubmissions ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                <p className="text-muted">Loading submissions...</p>
                            </div>
                        ) : submissionsData.length === 0 ? (
                            <div className="empty-state"><div className="empty-icon">📭</div><p className="text-muted">No submissions found for this assignment.</p></div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <button className={`btn btn-sm ${subFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubFilter('ALL')}>All</button>
                                    <button className={`btn btn-sm ${subFilter === 'SUBMITTED' ? 'btn-success' : 'btn-ghost'}`} onClick={() => setSubFilter('SUBMITTED')}>Completed</button>
                                    <button className={`btn btn-sm ${subFilter === 'PENDING' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setSubFilter('PENDING')}>Missing</button>
                                </div>
                                {submissionsData.filter(s => subFilter === 'ALL' ? true : subFilter === 'SUBMITTED' ? s.status === 'SUBMITTED' : s.status !== 'SUBMITTED').map(sub => {
                                    const hasViolation = (sub.proctoring_report?.tab_switches > 0) || 
                                                       (sub.proctoring_report?.fullscreen_exits > 0) || 
                                                       (sub.proctoring_report?.face_violations > 0) || 
                                                       (sub.proctoring_report?.mic_violations > 0);
                                    
                                    return (
                                        <div key={sub.id} className="card" style={{ 
                                            padding: '16px', 
                                            background: 'var(--bg-secondary)', 
                                            border: hasViolation ? '2px solid #ef4444' : (sub.proctoring_report?.auto_submitted ? '1px solid #ef444430' : (sub.status !== 'SUBMITTED' ? '1px dashed #ef444450' : '1px solid var(--border)')),
                                            boxShadow: hasViolation ? '0 0 15px rgba(239, 68, 68, 0.1)' : 'none'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {sub.student_name}
                                                        {sub.status !== 'SUBMITTED' && <span className="badge badge-warning" style={{ fontSize: '10px' }}>{sub.status}</span>}
                                                        {hasViolation && <span className="badge badge-danger" style={{ fontSize: '10px', animation: 'pulse 2s infinite' }}>⚠️ VIOLATION DETECTED</span>}
                                                    </h3>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        {sub.student_email} • {sub.status === 'SUBMITTED' ? (sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'Processing') : 'Awaiting Submission'}
                                                    </div>
                                                </div>
                                                {(sub.status === 'SUBMITTED' || sub.status === 'IN_PROGRESS') && (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 800, color: sub.marks !== null ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '4px' }}>
                                                            {sub.marks !== null ? `${sub.marks} / ${viewSubmissions?.total_marks || 100}` : 'Not Graded'}
                                                        </div>
                                                        {sub.proctoring_report?.auto_submitted && (
                                                            <span className="badge badge-danger" style={{ marginBottom: '4px', display: 'inline-block', fontSize: '10px' }}>⛔ AUTO-SUBMITTED</span>
                                                        )}
                                                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                            ⏱️ {Math.floor((sub.proctoring_report?.completion_time || 0) / 60)}m {(sub.proctoring_report?.completion_time || 0) % 60}s
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Proctoring Report Brief */}
                                            {(sub.status === 'SUBMITTED' || sub.status === 'IN_PROGRESS') && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Tab Switches</div>
                                                        <div style={{ fontSize: '14px', fontWeight: 700, color: sub.proctoring_report?.tab_switches > 0 ? '#ef4444' : 'inherit' }}>{sub.proctoring_report?.tab_switches || 0}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>FS Exits</div>
                                                        <div style={{ fontSize: '14px', fontWeight: 700, color: sub.proctoring_report?.fullscreen_exits > 0 ? '#ef4444' : 'inherit' }}>{sub.proctoring_report?.fullscreen_exits || 0}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Face Loss</div>
                                                        <div style={{ fontSize: '14px', fontWeight: 700, color: sub.proctoring_report?.face_violations > 0 ? '#ef4444' : 'inherit' }}>{sub.proctoring_report?.face_violations || 0}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Mic Interrupts</div>
                                                        <div style={{ fontSize: '14px', fontWeight: 700, color: sub.proctoring_report?.mic_violations > 0 ? '#ef4444' : 'inherit' }}>{sub.proctoring_report?.mic_violations || 0}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {sub.content && sub.status === 'SUBMITTED' && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Submission Content Summary:</p>
                                                    <pre style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', overflowX: 'auto', fontSize: '12px', border: '1px solid var(--border)' }}>
                                                        {sub.content.slice(0, 400)}{sub.content.length > 400 ? '...' : ''}
                                                    </pre>
                                                </div>
                                            )}
                                            {sub.file_url && sub.status === 'SUBMITTED' && (
                                                <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>📥 Download PDF Attachment</a>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Overdue Students Modal ── */}
            {showOverdueModal && (
                <div className="modal-overlay" onClick={() => setShowOverdueModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 className="modal-title" style={{ margin: 0 }}>⚠️ Overdue Assignments — Student Details</h2>
                            <button className="btn btn-sm btn-ghost" onClick={() => setShowOverdueModal(false)}>✕ Close</button>
                        </div>

                        {loadingOverdue ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                <p className="text-muted">Loading overdue details...</p>
                            </div>
                        ) : overdueDetails.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">✅</div>
                                <h3>No overdue assignments!</h3>
                                <p className="text-sm text-muted">All assignments are up to date.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {overdueDetails.map((item, idx) => (
                                    <div key={idx} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid #ef444430' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{item.assignment.title}</h3>
                                                <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                                                    Due: {new Date(item.assignment.due_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className="badge" style={{ background: `${typeColors[item.assignment.type]}20`, color: typeColors[item.assignment.type] }}>
                                                    {typeIcons[item.assignment.type]} {item.assignment.type}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Pending students */}
                                        {item.pending.length > 0 && (
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                    ❌ Not Submitted ({item.pending.length})
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {item.pending.map((s: any) => (
                                                        <span key={s.student_id} style={{
                                                            padding: '4px 10px', borderRadius: '20px', fontSize: '12px',
                                                            background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 600
                                                        }}>
                                                            {s.student_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Submitted students */}
                                        {item.submitted.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                    ✅ Submitted ({item.submitted.length})
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {item.submitted.map((s: any) => (
                                                        <span key={s.student_id} style={{
                                                            padding: '4px 10px', borderRadius: '20px', fontSize: '12px',
                                                            background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 600
                                                        }}>
                                                            {s.student_name} ({s.marks ?? '—'}/{item.assignment.total_marks})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {item.submitted.length}/{item.totalStudents} submitted
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
