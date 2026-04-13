'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, getStoredUser } from '@/lib/api';

interface Session {
    id: string; title: string; description: string;
    batch_id: string; trainer_id: string;
    start_time: string; end_time: string;
    status: string; meeting_link: string | null; resources_url: string | null;
    batch_schedule_link: string | null;
    selective_attendance: boolean;
    attendee_ids: string[];
}

interface Batch {
    id: string;
    name: string;
    schedule_link: string | null;
}

interface StudentInBatch {
    id: string;
    name: string;
    student_id: string | null;
    email: string;
}

interface BatchWithStudents {
    batch_id: string;
    batch_name: string;
    course_name: string;
    students: StudentInBatch[];
}

const emptyForm = {
    title: '', description: '', batch_id: '', trainer_id: '',
    start_time: '', end_time: '', meeting_link: '', resources_url: '',
    recurrence: { type: 'NONE', count: 1 },
    selective_attendance: false,
    attendee_ids: [] as string[],
};

export default function AdminSessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [error, setError] = useState('');

    // Dependencies
    const [batches, setBatches] = useState<Batch[]>([]);
    const [trainers, setTrainers] = useState<{ id: string, name: string }[]>([]);
    const [batchesWithStudents, setBatchesWithStudents] = useState<BatchWithStudents[]>([]);
    const [studentSearch, setStudentSearch] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sessRes, batchRes, userRes, batchStudentsRes] = await Promise.all([
                apiGet('/api/sessions'),
                apiGet('/api/admin/batches'),
                apiGet('/api/admin/students?role=TRAINER'),
                apiGet('/api/admin/students-by-batch').catch(() => []),
            ]);
            setSessions(Array.isArray(sessRes) ? sessRes : []);
            setBatches(Array.isArray(batchRes) ? batchRes : []);
            setTrainers(Array.isArray(userRes) ? userRes : []);
            setBatchesWithStudents(Array.isArray(batchStudentsRes) ? batchStudentsRes : []);
        } catch (err) {
            console.error("Failed to load session data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const payload = {
                ...form,
                attendee_ids: form.selective_attendance ? form.attendee_ids : [],
            };
            const endpoint = editingSession ? `/api/sessions/${editingSession.id}` : '/api/sessions';
            const method = editingSession ? apiPatch : apiPost;
            const res = await method(endpoint, payload);
            if (res.ok) {
                setShowModal(false);
                setEditingSession(null);
                loadData();
            } else {
                const d = await res.json().catch(() => ({}));
                if (res.status === 409) {
                    setError(`Conflict: ${d.detail}`);
                } else {
                    setError(d.detail || 'Failed to save session');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Cancel this session completely?')) return;
        try {
            await apiDelete(`/api/sessions/${id}`);
            loadData();
        } catch (err: any) {
            alert(err.message || 'Failed to delete');
        }
    };

    const openNew = () => {
        setEditingSession(null);
        setForm(emptyForm);
        setStudentSearch('');
        setShowModal(true);
    };

    const openEdit = (s: Session) => {
        setEditingSession(s);
        setForm({
            title: s.title,
            description: s.description || '',
            batch_id: s.batch_id,
            trainer_id: s.trainer_id,
            start_time: s.start_time.slice(0, 16),
            end_time: s.end_time.slice(0, 16),
            meeting_link: s.meeting_link || '',
            resources_url: s.resources_url || '',
            recurrence: { type: 'NONE', count: 1 },
            selective_attendance: s.selective_attendance ?? false,
            attendee_ids: s.attendee_ids ?? [],
        });
        setStudentSearch('');
        setShowModal(true);
    };

    const toggleAttendee = (studentId: string) => {
        setForm(f => ({
            ...f,
            attendee_ids: f.attendee_ids.includes(studentId)
                ? f.attendee_ids.filter(id => id !== studentId)
                : [...f.attendee_ids, studentId]
        }));
    };

    const selectAllInBatch = (batchId: string) => {
        const batchData = batchesWithStudents.find(b => b.batch_id === batchId);
        if (!batchData) return;
        const ids = batchData.students.map(s => s.id);
        const allSelected = ids.every(id => form.attendee_ids.includes(id));
        if (allSelected) {
            setForm(f => ({ ...f, attendee_ids: f.attendee_ids.filter(id => !ids.includes(id)) }));
        } else {
            setForm(f => ({ ...f, attendee_ids: [...new Set([...f.attendee_ids, ...ids])] }));
        }
    };

    const selectAllStudents = () => {
        const allIds = batchesWithStudents.flatMap(b => b.students.map(s => s.id));
        const allSelected = allIds.every(id => form.attendee_ids.includes(id));
        setForm(f => ({ ...f, attendee_ids: allSelected ? [] : [...new Set(allIds)] }));
    };

    // Filter batches/students by search
    const filteredBatchesWithStudents = useMemo(() => {
        if (!studentSearch.trim()) return batchesWithStudents;
        const q = studentSearch.toLowerCase();
        return batchesWithStudents.map(b => ({
            ...b,
            students: b.students.filter(s =>
                s.name.toLowerCase().includes(q) ||
                (s.student_id || '').toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q)
            )
        })).filter(b => b.students.length > 0);
    }, [batchesWithStudents, studentSearch]);

    const totalStudents = batchesWithStudents.reduce((acc, b) => acc + b.students.length, 0);

    const getBatchName = (bid: string) => batches.find(b => b.id === bid)?.name || 'Unknown Batch';
    const getTrainerName = (tid: string) => trainers.find(t => t.id === tid)?.name || 'Unknown Trainer';

    return (
        <div className="reveal-on-scroll active">
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">Session Schedule</h1>
                    <p className="page-subtitle">Manage live training classes and batch schedules.</p>
                </div>
                <button onClick={openNew} className="btn btn-primary">+ Schedule Session</button>
            </div>

            <div className="glass-premium" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {loading ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}>
                        <div className="animate-spin" style={{ fontSize: '32px' }}>⏳</div>
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '24px' }}>📅</div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700 }}>No Sessions Scheduled</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Create a session to schedule live classes for batches.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Session Title</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trainer &amp; Batch</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timing</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audience</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Links</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Control</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-lift">
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{s.title}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.description?.slice(0, 50)}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{getTrainerName(s.trainer_id)}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px' }}>{getBatchName(s.batch_id)}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '13px' }}>
                                            <div style={{ fontWeight: 600 }}>{new Date(s.start_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                            <div style={{ color: 'var(--text-muted)' }}>To {new Date(s.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span className={`badge ${s.status === 'SCHEDULED' ? 'badge-primary' : s.status === 'COMPLETED' ? 'badge-success' : 'badge-secondary'}`}>{s.status}</span>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            {s.selective_attendance ? (
                                                <span style={{ fontSize: '12px', background: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                                                    👥 {s.attendee_ids?.length || 0} Selected
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '12px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                                                    🌐 All Batch
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '13px' }}>
                                            {s.meeting_link ? (
                                                <a href={s.meeting_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, display: 'block' }}>🎥 Join Meet</a>
                                            ) : s.batch_schedule_link ? (
                                                <a href={s.batch_schedule_link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>🔗 Batch Link</a>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>No Meet</span>
                                            )}
                                            {s.resources_url && <a href={s.resources_url} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', fontWeight: 600, display: 'block', marginTop: '4px' }}>📚 Resources</a>}
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn btn-sm btn-ghost" onClick={() => openEdit(s)}>Edit</button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(s.id)} style={{ color: 'var(--danger)' }}>Cancel</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ width: '95%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">{editingSession ? 'Edit Session' : 'Schedule New Session'}</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Title */}
                            <div className="form-group mb-0">
                                <label className="form-label">Session Title</label>
                                <input type="text" className="form-input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. React Day 1" />
                            </div>

                            {/* Batch + Trainer */}
                            <div className="grid-2 mb-0">
                                <div className="form-group mb-0">
                                    <label className="form-label">Primary Batch</label>
                                    <select className="form-select" required value={form.batch_id} onChange={e => {
                                        const bid = e.target.value;
                                        const b = batches.find(x => x.id === bid);
                                        setForm(f => ({ ...f, batch_id: bid, meeting_link: f.meeting_link || b?.schedule_link || '' }));
                                    }}>
                                        <option value="">Select Batch</option>
                                        {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group mb-0">
                                    <label className="form-label">Trainer</label>
                                    <select className="form-select" required value={form.trainer_id} onChange={e => setForm(f => ({ ...f, trainer_id: e.target.value }))}>
                                        <option value="">Select Trainer</option>
                                        {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Times */}
                            <div className="grid-2 mb-0">
                                <div className="form-group mb-0">
                                    <label className="form-label">Start Time</label>
                                    <input type="datetime-local" className="form-input" required value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                                </div>
                                <div className="form-group mb-0">
                                    <label className="form-label">End Time</label>
                                    <input type="datetime-local" className="form-input" required value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                                </div>
                            </div>

                            {/* Links */}
                            <div className="form-group mb-0">
                                <label className="form-label">Meeting / Schedule Link <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>(Google Meet, Zoom, etc.)</span></label>
                                <input type="url" className="form-input" value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} placeholder="https://meet.google.com/..." />
                            </div>
                            <div className="form-group mb-0">
                                <label className="form-label">Resources / Notes Link <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>(Optional)</span></label>
                                <input type="url" className="form-input" value={form.resources_url} onChange={e => setForm(f => ({ ...f, resources_url: e.target.value }))} placeholder="https://drive.google.com/..." />
                            </div>

                            {/* ── Attendance Mode ─────────────────────────── */}
                            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px', padding: '16px' }}>
                                <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', display: 'block' }}>
                                    👥 Attendance Mode
                                </label>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: form.selective_attendance ? '16px' : '0' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '10px 14px', borderRadius: '10px', border: `2px solid ${!form.selective_attendance ? 'var(--primary)' : 'var(--border)'}`, background: !form.selective_attendance ? 'rgba(99,102,241,0.1)' : 'transparent', transition: 'all 0.2s' }}>
                                        <input type="radio" name="att_mode" checked={!form.selective_attendance} onChange={() => setForm(f => ({ ...f, selective_attendance: false, attendee_ids: [] }))} style={{ accentColor: 'var(--primary)' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>🌐 All Batch Students</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All students in the primary batch</div>
                                        </div>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '10px 14px', borderRadius: '10px', border: `2px solid ${form.selective_attendance ? '#d97706' : 'var(--border)'}`, background: form.selective_attendance ? 'rgba(245,158,11,0.08)' : 'transparent', transition: 'all 0.2s' }}>
                                        <input type="radio" name="att_mode" checked={form.selective_attendance} onChange={() => setForm(f => ({ ...f, selective_attendance: true }))} style={{ accentColor: '#d97706' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#d97706' }}>👤 Specific Students</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pick from any batch</div>
                                        </div>
                                    </label>
                                </div>

                                {/* Cross-batch student picker */}
                                {form.selective_attendance && (
                                    <div>
                                        {/* Search + Select All */}
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="🔍 Search students by name, ID or email..."
                                                value={studentSearch}
                                                onChange={e => setStudentSearch(e.target.value)}
                                                style={{ flex: 1 }}
                                            />
                                            <button type="button" className="btn btn-sm btn-ghost" onClick={selectAllStudents} style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                                                {form.attendee_ids.length === totalStudents ? '☐ Deselect All' : '☑ Select All'}
                                            </button>
                                        </div>

                                        {/* Selected count badge */}
                                        {form.attendee_ids.length > 0 && (
                                            <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 600, marginBottom: '10px', padding: '4px 10px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', display: 'inline-block' }}>
                                                ✅ {form.attendee_ids.length} student{form.attendee_ids.length !== 1 ? 's' : ''} selected
                                            </div>
                                        )}

                                        {/* Batch-grouped student list */}
                                        <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                                            {filteredBatchesWithStudents.length === 0 ? (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                                                    {batchesWithStudents.length === 0 ? 'No students found in any batch.' : 'No results for your search.'}
                                                </p>
                                            ) : filteredBatchesWithStudents.map(bwg => {
                                                const batchStudentIds = bwg.students.map(s => s.id);
                                                const allChecked = batchStudentIds.every(id => form.attendee_ids.includes(id));
                                                const someChecked = batchStudentIds.some(id => form.attendee_ids.includes(id));
                                                return (
                                                    <div key={bwg.batch_id} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                                                        {/* Batch header */}
                                                        <div
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-tertiary)', cursor: 'pointer' }}
                                                            onClick={() => selectAllInBatch(bwg.batch_id)}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }} onChange={() => selectAllInBatch(bwg.batch_id)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--primary)' }} />
                                                                <div>
                                                                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{bwg.batch_name}</span>
                                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({bwg.course_name})</span>
                                                                </div>
                                                            </div>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bwg.students.length} student{bwg.students.length !== 1 ? 's' : ''}</span>
                                                        </div>
                                                        {/* Students in this batch */}
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            {bwg.students.map((st, idx) => (
                                                                <label
                                                                    key={st.id}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', cursor: 'pointer', background: form.attendee_ids.includes(st.id) ? 'rgba(99,102,241,0.06)' : 'transparent', borderTop: idx > 0 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                                                                >
                                                                    <input type="checkbox" checked={form.attendee_ids.includes(st.id)} onChange={() => toggleAttendee(st.id)} style={{ accentColor: 'var(--primary)' }} />
                                                                    <div style={{ flex: 1 }}>
                                                                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{st.name}</div>
                                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{st.student_id || st.email}</div>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Recurrence (create only) */}
                            {!editingSession && (
                                <div className="glass-premium" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(99,102,241,0.05)', border: '1px dashed var(--primary)' }}>
                                    <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>🔄 Repeat Session</span>
                                        <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>(Bulk Create)</span>
                                    </label>
                                    <div className="grid-2 mb-0" style={{ marginTop: '8px' }}>
                                        <select className="form-select" value={form.recurrence.type} onChange={e => setForm(f => ({ ...f, recurrence: { ...f.recurrence, type: e.target.value } }))}>
                                            <option value="NONE">No Repeat</option>
                                            <option value="DAILY">Daily</option>
                                            <option value="WEEKLY">Weekly</option>
                                        </select>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '12px' }}>For</span>
                                            <input type="number" min="1" max="30" className="form-input" style={{ width: '70px' }} value={form.recurrence.count} onChange={e => setForm(f => ({ ...f, recurrence: { ...f.recurrence, count: parseInt(e.target.value) || 1 } }))} />
                                            <span style={{ fontSize: '12px' }}>days/weeks</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && <div className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
                            <div className="modal-footer" style={{ marginTop: '10px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingSession ? 'Save Changes' : 'Schedule Session'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
