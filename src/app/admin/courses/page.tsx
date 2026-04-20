'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, getStoredUser } from '@/lib/api';
import SkeletonLoader from '@/components/SkeletonLoader';

interface Course {
    id: string; name: string; description: string | null;
    duration: string | null; fee: number; is_active: boolean;
    created_at: string; batch_count: number; student_count: number;
}

const EMPTY_FORM = { name: '', description: '', duration: '', fee: '' };

export default function CoursesPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editCourse, setEditCourse] = useState<Course | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(false);

    useEffect(() => { 
        loadCourses();
        const stored = getStoredUser();
        if (stored) {
            setCanEdit(stored.role === 'SUPER_ADMIN' || ((stored.role === 'ADMIN' || stored.role === 'TRAINER') && stored.permissions?.manage_courses));
        }
    }, []);

    const loadCourses = async () => {
        try { setCourses(await apiGet('/api/admin/courses')); }
        catch { } finally { setLoading(false); }
    };

    const openCreate = () => {
        setEditCourse(null); setForm(EMPTY_FORM); setError(''); setShowModal(true);
    };

    const openEdit = (c: Course) => {
        setEditCourse(c);
        setForm({ name: c.name, description: c.description || '', duration: c.duration || '', fee: String(c.fee) });
        setError(''); setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setSubmitting(true);
        try {
            const payload = { name: form.name, description: form.description, duration: form.duration, fee: parseFloat(form.fee) || 0 };
            if (editCourse) {
                await apiPatch(`/api/admin/courses/${editCourse.id}`, { ...payload, is_active: editCourse.is_active });
                // Optimistic update
                setCourses(prev => prev.map(c => c.id === editCourse.id ? { ...c, ...payload } : c));
                setShowModal(false);
            } else {
                const res = await apiPost('/api/admin/courses', payload);
                if (res.ok) {
                    setShowModal(false);
                    loadCourses();
                } else {
                    const d = await res.json().catch(() => ({}));
                    setError(Array.isArray(d.detail) ? d.detail.map((e: any) => e.msg).join('; ') : d.detail || 'Failed.');
                }
            }
        } catch (err: any) { setError(err.message || 'Network error.'); }
        finally { setSubmitting(false); }
    };

    const handleToggleActive = async (c: Course) => {
        // Optimistic update
        setCourses(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
        try {
            await apiPatch(`/api/admin/courses/${c.id}`, { is_active: !c.is_active });
        } catch (err: any) {
            // Rollback on failure
            setCourses(prev => prev.map(x => x.id === c.id ? { ...x, is_active: c.is_active } : x));
            alert(err.message || 'Failed to toggle course status.');
        }
    };

    const handleDelete = async (courseId: string) => {
        setDeletingId(courseId);
        setConfirmDeleteId(null);
        // Optimistic remove from list
        const removed = courses.find(c => c.id === courseId);
        setCourses(prev => prev.filter(c => c.id !== courseId));
        try {
            await apiDelete(`/api/admin/courses/${courseId}`);
        } catch (err: any) {
            // Rollback on failure
            if (removed) setCourses(prev => [...prev, removed].sort((a, b) => a.name.localeCompare(b.name)));
            alert(err.message || 'Failed to delete course.');
        } finally {
            setDeletingId(null);
        }
    };

    const totalBatches = courses.reduce((a, c) => a + c.batch_count, 0);
    const totalStudents = courses.reduce((a, c) => a + c.student_count, 0);

    return (
        <div className="reveal-on-scroll active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: '8px' }}>Course Management</h1>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Design and deploy academy programs across the platform.</p>
                </div>
                {canEdit && (
                    <button onClick={openCreate} className="btn btn-primary">+ Create New Program</button>
                )}
            </div>

            <div className="grid-4" style={{ marginBottom: '40px' }}>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Active Programs</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{courses.filter(c => c.is_active).length}</div>
                </div>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Enrollment</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{totalStudents}</div>
                </div>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Current Batches</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{totalBatches}</div>
                </div>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Academy Reach</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{courses.length}</div>
                </div>
            </div>

            <div className="glass-premium" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {loading ? (
                    <div style={{ padding: '24px' }}><SkeletonLoader count={4} type="row" /></div>
                ) : courses.length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '24px' }}>📚</div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Initialize Your Academy</h3>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '12px auto' }}>Start by creating your first course program to begin student enrollment.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Program Identity</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tuition Fee</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                                    {canEdit && <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Control</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {courses.map(c => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', opacity: deletingId === c.id ? 0.4 : 1 }} className="hover-lift">
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{c.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{c.description?.slice(0, 80)}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px', fontWeight: 700, fontSize: '14px' }}>{c.duration || 'Flexible'}</td>
                                        <td style={{ padding: '20px 24px', fontWeight: 700, fontSize: '14px', color: 'var(--primary)' }}>₹{c.fee.toLocaleString()}</td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span
                                                onClick={() => canEdit && handleToggleActive(c)}
                                                className={`badge ${c.is_active ? 'badge-success' : 'badge-secondary'}`}
                                                style={{ cursor: canEdit ? 'pointer' : 'default' }}
                                            >
                                                {c.is_active ? 'ACTIVE' : 'PAUSED'}
                                            </span>
                                        </td>
                                        {canEdit && (
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <button onClick={() => openEdit(c)} className="btn btn-sm btn-ghost" style={{ padding: '8px', width: '36px', height: '36px' }}>✏️</button>

                                                    {/* Inline delete confirmation */}
                                                    {confirmDeleteId === c.id ? (
                                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '4px 8px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                            <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600 }}>Sure?</span>
                                                            <button
                                                                onClick={() => handleDelete(c.id)}
                                                                className="btn btn-sm"
                                                                style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--danger)', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                                                            >Yes</button>
                                                            <button
                                                                onClick={() => setConfirmDeleteId(null)}
                                                                className="btn btn-sm btn-ghost"
                                                                style={{ padding: '2px 6px', fontSize: '11px' }}
                                                            >No</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDeleteId(c.id)}
                                                            className="btn btn-sm btn-ghost"
                                                            style={{ padding: '8px', width: '36px', height: '36px' }}
                                                        >🗑️</button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', letterSpacing: '-0.04em' }}>{editCourse ? 'Modify Program' : 'New Program Identity'}</h2>

                        {error && (
                            <div style={{ background: 'hsla(0, 80%, 60%, 0.1)', border: '1px solid hsla(0, 80%, 60%, 0.2)', padding: '12px', borderRadius: '12px', color: '#ef4444', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Program Name</label>
                                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Executive Description</label>
                                <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</label>
                                    <input placeholder="e.g. 24 Weeks" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tuition (₹)</label>
                                    <input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                                    {submitting ? 'Syncing...' : editCourse ? 'Confirm Update' : 'Initialize Program'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
