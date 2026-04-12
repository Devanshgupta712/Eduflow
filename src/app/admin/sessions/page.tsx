'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, getStoredUser } from '@/lib/api';

interface Session {
    id: string; title: string; description: string;
    batch_id: string; trainer_id: string;
    start_time: string; end_time: string;
    status: string; meeting_link: string | null; resources_url: string | null;
    batch_schedule_link: string | null;
}

interface Batch {
    id: string;
    name: string;
    schedule_link: string | null;
}

export default function AdminSessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ 
        title: '', description: '', batch_id: '', trainer_id: '', 
        start_time: '', end_time: '', meeting_link: '', resources_url: '',
        recurrence: { type: 'NONE', count: 1 } 
    });
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [error, setError] = useState('');
    
    // Dependencies
    const [batches, setBatches] = useState<Batch[]>([]);
    const [trainers, setTrainers] = useState<{id:string, name:string}[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sessRes, batchRes, userRes] = await Promise.all([
                apiGet('/api/sessions'),
                apiGet('/api/admin/batches'),
                apiGet('/api/admin/students?role=TRAINER')
            ]);
            setSessions(Array.isArray(sessRes) ? sessRes : []);
            setBatches(Array.isArray(batchRes) ? batchRes : []);
            setTrainers(Array.isArray(userRes) ? userRes : []);
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
            const endpoint = editingSession ? `/api/sessions/${editingSession.id}` : '/api/sessions';
            const method = editingSession ? apiPatch : apiPost;
            
            const res = await method(endpoint, form);
            if (res.ok) {
                setShowModal(false);
                setEditingSession(null);
                loadData();
            } else {
                const d = await res.json().catch(()=>({}));
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
            const res = await apiDelete(`/api/sessions/${id}`);
            loadData();
        } catch (err: any) {
            alert(err.message || 'Failed to delete');
        }
    };

    const getBatchName = (bid: string) => batches.find(b => b.id === bid)?.name || 'Unknown Batch';
    const getTrainerName = (tid: string) => trainers.find(t => t.id === tid)?.name || 'Unknown Trainer';

    return (
        <div className="reveal-on-scroll active">
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">Session Schedule</h1>
                    <p className="page-subtitle">Manage live training classes and batch schedules.</p>
                </div>
                <button onClick={() => {setForm({ title: '', description: '', batch_id: '', trainer_id: '', start_time: '', end_time: '', meeting_link: '', resources_url: '' }); setShowModal(true);}} className="btn btn-primary">+ Schedule Session</button>
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
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trainer & Batch</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timing</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
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
                                            <div style={{ fontWeight: 600 }}>{new Date(s.start_time).toLocaleString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                                            <div style={{ color: 'var(--text-muted)' }}>To {new Date(s.end_time).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span className={`badge ${s.status === 'SCHEDULED' ? 'badge-primary' : s.status === 'COMPLETED' ? 'badge-success' : 'badge-secondary'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '13px' }}>
                                            {s.meeting_link ? (
                                                <a href={s.meeting_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, display: 'block' }}>🎥 Join Meet</a>
                                            ) : s.batch_schedule_link ? (
                                                <a href={s.batch_schedule_link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>🔗 Batch Link (Default)</a>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>No Meet</span>
                                            )}
                                            {s.resources_url && <a href={s.resources_url} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', fontWeight: 600, display: 'block', marginTop: '4px' }}>📚 Resources</a>}
                                        </td>
                                        <td style={{ padding: '20px 24px', display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-sm btn-ghost" onClick={() => {
                                                setEditingSession(s);
                                                setForm({
                                                    title: s.title,
                                                    description: s.description || '',
                                                    batch_id: s.batch_id,
                                                    trainer_id: s.trainer_id,
                                                    start_time: s.start_time.slice(0, 16),
                                                    end_time: s.end_time.slice(0, 16),
                                                    meeting_link: s.meeting_link || '',
                                                    resources_url: s.resources_url || ''
                                                });
                                                setShowModal(true);
                                            }}>Edit</button>
                                            <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(s.id)} style={{ color: 'var(--danger)' }}>Cancel</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">{editingSession ? 'Edit Session' : 'Schedule New Session'}</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group mb-0">
                                <label className="form-label">Session Title</label>
                                <input type="text" className="form-input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. React Day 1" />
                            </div>
                            <div className="grid-2 mb-0">
                                <div className="form-group mb-0">
                                    <label className="form-label">Batch</label>
                                    <select className="form-select" required value={form.batch_id} onChange={e => {
                                        const bid = e.target.value;
                                        const b = batches.find(x => x.id === bid);
                                        setForm(f => ({ 
                                            ...f, 
                                            batch_id: bid,
                                            // Auto-fill meeting link if currently empty
                                            meeting_link: f.meeting_link || b?.schedule_link || '' 
                                        }));
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
                            <div className="form-group mb-0">
                                <label className="form-label">Meeting / Schedule Link <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>(Google Meet, Zoom, etc.)</span></label>
                                <input type="url" className="form-input" value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} placeholder="https://meet.google.com/..." />
                            </div>
                            <div className="form-group mb-0">
                                <label className="form-label">Resources / Notes Link <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>(Optional)</span></label>
                                <input type="url" className="form-input" value={form.resources_url} onChange={e => setForm(f => ({ ...f, resources_url: e.target.value }))} placeholder="https://drive.google.com/..." />
                            </div>
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
                                <button type="submit" className="btn btn-primary">Schedule Session</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
