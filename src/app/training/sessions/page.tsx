'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api';

interface Session {
    id: string; title: string; description: string;
    batch_id: string; trainer_id: string;
    start_time: string; end_time: string;
    status: string; meeting_link: string | null; resources_url: string | null;
    batch_schedule_link: string | null;
}

export default function TrainerSessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [batches, setBatches] = useState<{id:string, name:string}[]>([]);
    const [editLinkModal, setEditLinkModal] = useState<Session | null>(null);
    const [tempUrl, setTempUrl] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sessRes, batchRes] = await Promise.all([
                apiGet('/api/sessions'),
                apiGet('/api/training/batches')
            ]);
            setSessions(sessRes || []);
            setBatches(batchRes || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await apiPatch(`/api/sessions/${id}`, { status });
            setSessions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
        } catch (err: any) {
            alert(err.message || 'Failed to update status');
        }
    };

    const handleSaveLinks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editLinkModal) return;
        try {
            await apiPatch(`/api/sessions/${editLinkModal.id}`, { resources_url: tempUrl });
            setSessions(prev => prev.map(s => s.id === editLinkModal.id ? { ...s, resources_url: tempUrl } : s));
            setEditLinkModal(null);
        } catch (err: any) {
            alert(err.message || 'Failed to update links');
        }
    };

    const getBatchName = (bid: string) => batches.find(b => b.id === bid)?.name || 'Unknown Batch';

    return (
        <div className="reveal-on-scroll active">
            <div className="page-header" style={{ marginBottom: '20px' }}>
                <div>
                    <h1 className="page-title">My Class Schedule</h1>
                    <p className="page-subtitle">View your upcoming live classes, join meetings, and access post-class materials.</p>
                </div>
            </div>

            <div className="glass-premium" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {loading ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}><div className="animate-spin" style={{ fontSize: '32px' }}>⏳</div></div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '24px' }}>📅</div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700 }}>No Sessions assigned</h3>
                        <p style={{ color: 'var(--text-muted)' }}>You have no classes scheduled at the moment.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Session Details</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Schedule</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Links & Materials</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{s.title}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '6px', fontWeight: 600 }}>{getBatchName(s.batch_id)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.description}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '13px' }}>
                                            <div style={{ fontWeight: 600 }}>{new Date(s.start_time).toLocaleString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                                            <div style={{ color: 'var(--text-muted)' }}>To {new Date(s.end_time).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            {s.status === 'SCHEDULED' ? (
                                                <button className="btn btn-sm btn-primary" onClick={() => handleUpdateStatus(s.id, 'ONGOING')}>Start Class</button>
                                            ) : s.status === 'ONGOING' ? (
                                                <button className="btn btn-sm" style={{background: 'var(--success)', color: '#fff'}} onClick={() => handleUpdateStatus(s.id, 'COMPLETED')}>Mark Completed</button>
                                            ) : (
                                                <span className={`badge ${s.status === 'COMPLETED' ? 'badge-success' : 'badge-secondary'}`}>{s.status}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '13px' }}>
                                            {s.meeting_link ? (
                                                <a href={s.meeting_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>🎥 Join Meet</a>
                                            ) : s.batch_schedule_link ? (
                                                <a href={s.batch_schedule_link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>🔗 Batch Link (Default)</a>
                                            ) : null}
                                            {s.resources_url ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <a href={s.resources_url} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', fontWeight: 600 }}>📚 Resources Linked</a>
                                                    <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => {setEditLinkModal(s); setTempUrl(s.resources_url || '');}}>Edit</button>
                                                </div>
                                            ) : (
                                                <button className="btn btn-sm btn-ghost" onClick={() => {setEditLinkModal(s); setTempUrl('');}}>+ Link Resources</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {editLinkModal && (
                <div className="modal-overlay" onClick={() => setEditLinkModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Attach Resources Link</h2>
                        <form onSubmit={handleSaveLinks} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group mb-0">
                                <label className="form-label">Google Drive / Notion URL</label>
                                <input type="url" className="form-input" required value={tempUrl} onChange={e => setTempUrl(e.target.value)} placeholder="https://..." />
                            </div>
                            <div className="modal-footer" style={{ marginTop: '10px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setEditLinkModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Link</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
