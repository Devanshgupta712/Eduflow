'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPost, apiPut, apiDelete, getStoredUser } from '@/lib/api';

interface Batch {
    id: string; name: string; start_date: string; end_date: string;
    is_active: boolean; course_name: string; trainer_name: string | null; student_count: number; schedule_time: string | null;
    schedule_link: string | null;
}

export default function BatchesPage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [trainers, setTrainers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ course_id: '', name: '', start_date: '', end_date: '', schedule_time: '', trainer_id: '', schedule_link: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>('');
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    // Roster Modal State
    const [viewStudentsId, setViewStudentsId] = useState<string | null>(null);
    const [viewStudentsName, setViewStudentsName] = useState<string>('');
    const [studentsList, setStudentsList] = useState<any[]>([]);
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [enrollStudentId, setEnrollStudentId] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [studentSearchFocus, setStudentSearchFocus] = useState(false);
    const [selectedStudentName, setSelectedStudentName] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [enrollMsg, setEnrollMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const searchParams = useSearchParams();

    useEffect(() => { 
        loadData(); 
        const user = getStoredUser();
        if (user?.role) setCurrentUserRole(user.role.toUpperCase());
    }, []);


    // Check for search param deep-link
    useEffect(() => {
        const batchId = searchParams.get('id');
        if (batchId && batches.length > 0) {
            const b = batches.find(x => x.id === batchId);
            if (b) handleViewStudents(b.id, b.name);
        }
    }, [searchParams, batches]);


    const loadData = async () => {
        try {
            const [b, c, t] = await Promise.all([
                apiGet('/api/admin/batches').catch(() => []),
                apiGet('/api/admin/courses').catch(() => []),
                apiGet('/api/admin/students?role=TRAINER').catch(() => []),
            ]);
            setBatches(b); setCourses(c); setTrainers(t);
            if (!c || c.length === 0) setError('No courses found. Please create a course first before creating a batch.');
            else setError('');
        } catch {
            setError('Failed to load data. Please refresh.');
        } finally { setLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                course_id: form.course_id || null,
                name: form.name,
                start_date: form.start_date,
                end_date: form.end_date,
                schedule_time: form.schedule_time || null,
                schedule_link: form.schedule_link || null,
                trainer_id: form.trainer_id || null,
            };
            
            if (editingId) {
                await apiPut(`/api/admin/batches/${editingId}`, payload);
                setShowModal(false);
                setEditingId(null);
                setForm({ course_id: '', name: '', start_date: '', end_date: '', schedule_time: '', trainer_id: '', schedule_link: '' });
                loadData();
            } else {
                const res = await apiPost('/api/admin/batches', payload);
                if (res.ok) {
                    setShowModal(false);
                    setForm({ course_id: '', name: '', start_date: '', end_date: '', schedule_time: '', trainer_id: '', schedule_link: '' });
                    loadData();
                } else {
                    const d = await res.json().catch(() => ({}));
                    if (Array.isArray(d.detail)) {
                        setError(d.detail.map((e: any) => `${e.loc?.join('.')} — ${e.msg}`).join('; '));
                    } else {
                        setError(d.detail || d.message || JSON.stringify(d) || 'Failed to create batch.');
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || 'Network error.');
        } finally {
            setSubmitting(false);
        }
    };
    
    const openEdit = (b: Batch) => {
        setEditingId(b.id);
        setForm({
            course_id: b.course_name ? courses.find(c => c.name === b.course_name)?.id || '' : '',
            name: b.name,
            start_date: b.start_date.split('T')[0],
            end_date: b.end_date.split('T')[0],
            schedule_time: b.schedule_time || '',
            schedule_link: b.schedule_link || '',
            trainer_id: b.trainer_name ? trainers.find(t => t.name === b.trainer_name)?.id || '' : ''
        });
        setShowModal(true);
    };
    
    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete batch "${name}"? All enrolled students, scheduled sessions, and records will be completely removed.`)) return;
        
        try {
            setDeletingIds(prev => new Set(prev).add(id));
            
            // Wake-up ping for render.com free tier cold starts
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com';
            await fetch(apiBase + '/api/health').catch(() => {});
            
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${apiBase}/api/admin/batches/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) {
                let errMsg = `Delete failed (${res.status})`;
                try {
                    const errData = await res.json();
                    errMsg = errData.detail || errData.message || errMsg;
                } catch {}
                
                // Real server errors (500) vs potential cold start network failures
                if (res.status === 500) {
                    alert(`Server Error: ${errMsg}. This often happens if the batch has complex dependencies. Please try again.`);
                } else {
                    alert(errMsg);
                }
                return;
            }
            
            // Success
            loadData();
        } catch (err: any) {
            console.error('Delete error:', err);
            if (err.message === 'Failed to fetch') {
                alert('Connection failed. The server might still be warming up or your network is unstable. Please try again in a few moments.');
            } else {
                alert(err.message || 'Failed to delete batch');
            }
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleViewStudents = async (id: string, name: string) => {
        setViewStudentsId(id);
        setViewStudentsName(name);
        setStudentsList([]);
        try {
            const [batchStudents, allStuds] = await Promise.all([
                apiGet(`/api/training/batches/${id}/students`),
                apiGet(`/api/admin/students?role=STUDENT`)
            ]);
            setStudentsList(batchStudents);
            setAllStudents(allStuds);
        } catch {}
    };

    const handleEnrollStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!enrollStudentId || !viewStudentsId) return;
        await doEnroll(enrollStudentId, selectedStudentName);
    };

    const doEnroll = async (studentId: string, studentName: string) => {
        if (!viewStudentsId || !studentId) return;
        setEnrolling(true);
        setEnrollMsg(null);
        try {
            await apiPost(`/api/admin/users/${studentId}/assign-batch`, { batch_id: viewStudentsId });
            setEnrollStudentId('');
            setStudentSearch('');
            setSelectedStudentName('');
            setEnrollMsg({ type: 'success', text: `✅ ${studentName || 'Student'} enrolled successfully!` });
            setTimeout(() => setEnrollMsg(null), 3000);
            handleViewStudents(viewStudentsId, viewStudentsName); // Reload roster
        } catch {
            setEnrollMsg({ type: 'error', text: '❌ Failed to enroll. Student may already be in this batch.' });
        } finally {
            setEnrolling(false);
        }
    };

    const handleRemoveStudent = async (studentId: string) => {
        if (!viewStudentsId || !confirm('Remove this student from the batch?')) return;
        try {
            await apiDelete(`/api/admin/users/${studentId}/batches/${viewStudentsId}`);
            setStudentsList(studentsList.filter(s => s.id !== studentId));
        } catch { alert('Failed to remove student.'); }
    };

    const closeRosterModal = () => {
        setViewStudentsId(null);
        setStudentSearch('');
        setEnrollStudentId('');
        setSelectedStudentName('');
        setEnrollMsg(null);
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div><h1 className="page-title">Batches</h1><p className="page-subtitle">Manage training batches</p></div>
                {['SUPER_ADMIN', 'ADMIN'].includes(currentUserRole) && (
                    <button className="btn btn-primary" onClick={() => { setError(''); setShowModal(true); }}>+ New Batch</button>
                )}
            </div>

            {error && (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', color: '#f59e0b', fontSize: '14px' }}>
                    ⚠️ {error} {courses.length === 0 && <a href="/admin/courses" style={{ color: '#0066ff', marginLeft: '8px' }}>→ Go to Courses →</a>}
                </div>
            )}

            <div className="card">
                {loading ? <p>Loading...</p> : batches.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon">👥</div><h3>No batches yet</h3><p>Create courses first, then create batches.</p></div>
                ) : (
            <div className="grid-3">
                {batches.map(b => (
                    <div className="card-glass" key={b.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>{b.name}</h3>
                            <p className="text-sm" style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>{b.course_name || 'Independent Batch'}</p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>📅</span> 
                                    <span>{new Date(b.start_date).toLocaleDateString()}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>👥</span> 
                                    <span>{b.student_count} Students Enrolled</span>
                                </div>
                                {b.schedule_time && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>⏰</span> 
                                        <span>{b.schedule_time}</span>
                                    </div>
                                )}
                                {b.schedule_link && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>🔗</span>
                                        <a href={b.schedule_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>Join Meeting</a>
                                    </div>
                                )}
                                {b.trainer_name && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--info-dark)', fontWeight: 600 }}>
                                        <span style={{ fontSize: '16px' }}>👨‍🏫</span> 
                                        <span>{b.trainer_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                            <span className={`badge ${b.is_active ? 'badge-success' : 'badge-danger'}`}>{b.is_active ? 'Active' : 'Ended'}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-sm btn-primary" onClick={() => handleViewStudents(b.id, b.name)}>Student</button>
                                {['SUPER_ADMIN', 'ADMIN'].includes(currentUserRole.toUpperCase()) && (
                                    <>
                                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(b)} disabled={deletingIds.has(b.id)}>Edit</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b.id, b.name)} disabled={deletingIds.has(b.id)}>
                                            {deletingIds.has(b.id) ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <h2 className="modal-title">{editingId ? 'Modify Training Batch' : 'Initialize New Batch'}</h2>
                        <p style={{ margin: '-16px 0 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>Configure session schedules and assign trainers for the new cohort.</p>

                        {error && (
                            <div className="badge badge-danger" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginBottom: '20px', borderRadius: '12px' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="form-group">
                                <label className="form-label">Associated Course Program</label>
                                <select className="form-select" value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                                    <option value="">Independent Training (No Course)</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Batch Identity Name</label>
                                <input className="form-input" placeholder="e.g. FullStack-2024-B1" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Commencement Date</label>
                                    <input className="form-input" type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Expected Completion</label>
                                    <input className="form-input" type="date" required value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Schedule Timeframe</label>
                                    <input className="form-input" placeholder="e.g. 10:00 AM - 01:00 PM" value={form.schedule_time} onChange={e => setForm({ ...form, schedule_time: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Designated Lead Trainer</label>
                                    <select className="form-select" value={form.trainer_id} onChange={e => setForm({ ...form, trainer_id: e.target.value })}>
                                        <option value="">Unassigned (No Trainer)</option>
                                        {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">📅 Schedule / Meeting Link <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>(Optional – Google Meet, Zoom, etc.)</span></label>
                                <input className="form-input" type="url" placeholder="https://meet.google.com/..." value={form.schedule_link} onChange={e => setForm({ ...form, schedule_link: e.target.value })} />
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Processing Session...' : (editingId ? 'Commit Changes' : 'Launch Batch')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Roster Modal */}
            {viewStudentsId && (
                <div className="modal-overlay" onClick={closeRosterModal}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 className="modal-title" style={{ margin: 0 }}>Roster: {viewStudentsName}</h2>
                            <button className="btn btn-sm btn-ghost" onClick={closeRosterModal}>✕ Close</button>
                        </div>

                        {/* Add Student — Searchable Picker */}
                        {['SUPER_ADMIN', 'ADMIN'].includes(currentUserRole) && (() => {
                            // Students not yet in this batch
                            const available = allStudents.filter(u => !studentsList.some(s => s.id === u.id));
                            // Filter by search query (name or email)
                            const q = studentSearch.trim().toLowerCase();
                            const filtered = q
                                ? available.filter(u =>
                                    u.name?.toLowerCase().includes(q) ||
                                    u.email?.toLowerCase().includes(q) ||
                                    u.student_id?.toLowerCase().includes(q)
                                  )
                                : [];

                            return (
                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>➕ Add Student to Batch</h4>
                                    <form onSubmit={handleEnrollStudent}>
                                        <div style={{ position: 'relative' }}>
                                            {/* Search input */}
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <div style={{ flex: 1, position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', pointerEvents: 'none' }}>🔍</span>
                                                    <input
                                                        className="form-input"
                                                        placeholder="Search student by name, email or ID..."
                                                        style={{ paddingLeft: '38px', borderRadius: '12px' }}
                                                        value={studentSearch}
                                                        onChange={e => {
                                                            setStudentSearch(e.target.value);
                                                            // Clear selection if user types again
                                                            if (enrollStudentId) {
                                                                setEnrollStudentId('');
                                                                setSelectedStudentName('');
                                                            }
                                                        }}
                                                        onFocus={() => setStudentSearchFocus(true)}
                                                        onBlur={() => setTimeout(() => setStudentSearchFocus(false), 180)}
                                                        autoComplete="off"
                                                    />

                                                    {/* Dropdown suggestions */}
                                                    {studentSearchFocus && q && filtered.length > 0 && (
                                                        <div style={{
                                                            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                            borderRadius: '12px', boxShadow: 'var(--shadow-lg)',
                                                            zIndex: 9999, maxHeight: '220px', overflowY: 'auto'
                                                        }}>
                                                            {filtered.slice(0, 20).map(s => (
                                                                <div
                                                                    key={s.id}
                                                                    onMouseDown={async (e) => {
                                                                        // onMouseDown fires BEFORE onBlur, so the dropdown stays open
                                                                        e.preventDefault();
                                                                        setStudentSearchFocus(false);
                                                                        setStudentSearch(s.name);
                                                                        // Immediately enroll on click — no second button click needed
                                                                        await doEnroll(s.id, s.name);
                                                                    }}
                                                                    style={{
                                                                        padding: '10px 14px', cursor: enrolling ? 'wait' : 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '12px',
                                                                        transition: 'background 0.15s',
                                                                        borderBottom: '1px solid var(--border-light)'
                                                                    }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                                >
                                                                    <div style={{
                                                                        width: '36px', height: '36px', borderRadius: '50%',
                                                                        background: 'var(--primary)', color: '#fff',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        fontWeight: 700, fontSize: '14px', flexShrink: 0
                                                                    }}>
                                                                        {s.name?.[0]?.toUpperCase()}
                                                                    </div>
                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{s.name}</div>
                                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            {s.email} {s.student_id ? `• ${s.student_id}` : ''}
                                                                        </div>
                                                                    </div>
                                                                    <span style={{
                                                                        fontSize: '13px', fontWeight: 700,
                                                                        color: 'var(--primary)',
                                                                        background: 'var(--primary-glow)',
                                                                        padding: '3px 10px', borderRadius: '8px',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {enrolling ? '⏳' : '+ Add'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {filtered.length > 20 && (
                                                                <div style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                                    {filtered.length - 20} more — type more to narrow results
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {studentSearchFocus && q && filtered.length === 0 && (
                                                        <div style={{
                                                            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                            borderRadius: '12px', padding: '14px', textAlign: 'center',
                                                            fontSize: '13px', color: 'var(--text-muted)', zIndex: 9999
                                                        }}>
                                                            No students found matching "{studentSearch}"
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    type="submit"
                                                    className="btn btn-primary"
                                                    disabled={!enrollStudentId || enrolling}
                                                    style={{ borderRadius: '12px', whiteSpace: 'nowrap', minWidth: '100px' }}
                                                >
                                                    {enrolling ? '...' : '✓ Add'}
                                                </button>
                                            </div>

                                            {/* Selected student confirmation chip */}
                                            {enrollStudentId && selectedStudentName && (
                                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        padding: '4px 10px', borderRadius: '20px',
                                                        background: 'var(--primary-glow)', color: 'var(--primary)',
                                                        fontSize: '13px', fontWeight: 600, border: '1px solid var(--primary)'
                                                    }}>
                                                        ✓ {selectedStudentName} selected
                                                        <button
                                                            type="button"
                                                            onClick={() => { setEnrollStudentId(''); setStudentSearch(''); setSelectedStudentName(''); }}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '0 2px', fontSize: '14px', lineHeight: 1 }}
                                                        >✕</button>
                                                    </span>
                                                </div>
                                            )}

                                            {/* Feedback message */}
                                            {enrollMsg && (
                                                <div style={{
                                                    marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                                    background: enrollMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                    color: enrollMsg.type === 'success' ? '#16a34a' : '#dc2626',
                                                    border: `1px solid ${enrollMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`
                                                }}>
                                                    {enrollMsg.type === 'success' ? '✅' : '❌'} {enrollMsg.text}
                                                </div>
                                            )}
                                        </div>
                                    </form>
                                    <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0' }} />
                                </div>
                            );
                        })()}

                        {studentsList.length === 0 ? (
                            <div className="empty-state"><div className="empty-icon">👥</div><p className="text-muted">No students enrolled in this batch.</p></div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {studentsList.map(s => (
                                    <div key={s.id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <h3 style={{ margin: 0, fontSize: '15px' }}>{s.name}</h3>
                                                <span className="badge" style={{ fontSize: '10px', background: 'var(--bg-secondary)' }}>{s.student_id}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{s.email}</p>
                                        </div>
                                        
                                        <div style={{ flex: 1, padding: '0 24px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', fontWeight: 600 }}>
                                                <span>Assignments Progress</span>
                                                <span style={{ color: s.progress_percentage === 100 ? 'var(--success)' : 'var(--text-primary)' }}>
                                                    {s.progress_percentage || 0}% ({s.completed || 0}/{s.total_activities || 0})
                                                </span>
                                            </div>
                                            <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${s.progress_percentage || 0}%`, height: '100%', background: s.progress_percentage === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s ease' }} />
                                            </div>
                                        </div>

                                        {['SUPER_ADMIN', 'ADMIN'].includes(currentUserRole) && (
                                            <div>
                                                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleRemoveStudent(s.id)}>Remove</button>
                                            </div>
                                        )}
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
