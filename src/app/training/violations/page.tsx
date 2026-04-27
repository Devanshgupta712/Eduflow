'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiFetch, getStoredUser } from '@/lib/api';

interface ViolationItem {
    id: string; student_id: string; student_name: string;
    type: string; severity: string; status: string;
    title: string; description: string | null;
    reference_type: string | null; reference_id: string | null; reference_title?: string | null;
    penalty_points: number;
    resolved_by: string | null; resolution_note: string | null;
    resolved_at: string | null; created_at: string;
    screenshot_url?: string | null;
}

interface Summary {
    total: number; open: number; resolved: number;
    total_penalties: number; by_type: Record<string, number>;
}

const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
    DEADLINE_MISSED: { icon: '⏰', color: '#ef4444', label: 'Deadline Missed' },
    LATE_SUBMISSION: { icon: '📅', color: '#f97316', label: 'Late Submission' },
    INCOMPLETE_WORK: { icon: '⚠️', color: '#f59e0b', label: 'Incomplete Work' },
    POOR_ACADEMIC_PERFORMANCE: { icon: '📉', color: '#f59e0b', label: 'Poor Academic Performance' },
    LOW_ATTENDANCE: { icon: '🚫', color: '#0066ff', label: 'Low Attendance' },
    UNAUTHORIZED_ASSISTANCE: { icon: '🤖', color: '#dc2626', label: 'Unauthorized Assistance' },
    HONOR_CODE_VIOLATION: { icon: '⚖️', color: '#9f1239', label: 'Honor Code Violation' },
    DISRUPTIVE_BEHAVIOR: { icon: '🚨', color: '#b91c1c', label: 'Disruptive Behavior' },
    PLAGIARISM: { icon: '📋', color: '#dc2626', label: 'Plagiarism' },
    CODE_VIOLATION: { icon: '💻', color: '#0066ff', label: 'Code Violation' },
    TAB_SWITCHING: { icon: '🔀', color: '#7c3aed', label: 'Tab Switching' },
    FACE_LOSS: { icon: '👤', color: '#e11d48', label: 'Face Loss' },
    FULLSCREEN_EXIT: { icon: '🖥️', color: '#6366f1', label: 'Fullscreen Exit' },
    MIC_OFF: { icon: '🎤', color: '#ea580c', label: 'Mic Off' },
    MISSED_FEEDBACK: { icon: '📝', color: '#d97706', label: 'Missed Feedback' },
    OTHER: { icon: '❓', color: 'var(--text-secondary)', label: 'Other' },
};
const severityConfig: Record<string, { color: string; bg: string }> = {
    LOW: { color: '#10b981', bg: '#10b98118' },
    MEDIUM: { color: '#f59e0b', bg: '#f59e0b18' },
    HIGH: { color: '#f97316', bg: '#f9731618' },
    CRITICAL: { color: '#ef4444', bg: '#ef444418' },
};
const statusConfig: Record<string, { color: string; bg: string }> = {
    OPEN: { color: '#ef4444', bg: '#ef444418' },
    ACKNOWLEDGED: { color: '#f59e0b', bg: '#f59e0b18' },
    RESOLVED: { color: '#10b981', bg: '#10b98118' },
    DISMISSED: { color: 'var(--text-secondary)', bg: '#64748b18' },
};

export default function ViolationsPage() {
    const [violations, setViolations] = useState<ViolationItem[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
    const [resolveNote, setResolveNote] = useState('');
    const user = getStoredUser();
    const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'TRAINER';
    const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
    const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        student_id: '', type: 'POOR_ACADEMIC_PERFORMANCE', severity: 'MEDIUM',
        title: '', description: '', penalty_points: '5',
        reference_type: '', reference_id: '',
    });

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [v, s] = await Promise.all([
                apiGet('/api/training/violations'),
                apiGet('/api/training/violations/summary'),
            ]);
            setViolations(v);
            setSummary(s);
        } catch { } finally { setLoading(false); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await apiPost('/api/training/violations', {
            ...form, penalty_points: parseInt(form.penalty_points) || 0,
        });
        setShowCreateModal(false);
        setForm({ student_id: '', type: 'POOR_ACADEMIC_PERFORMANCE', severity: 'MEDIUM', title: '', description: '', penalty_points: '5', reference_type: '', reference_id: '' });
        load();
    };

    const handleResolve = async (action: 'RESOLVED' | 'DISMISSED') => {
        if (!showResolveModal) return;
        await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/training/violations/' + showResolveModal, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ status: action, resolution_note: resolveNote }),
        });
        setShowResolveModal(null);
        setResolveNote('');
        load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this violation? This action cannot be undone.')) return;
        setDeletingId(id);
        try {
            await apiFetch(`/api/training/violations/${id}`, { method: 'DELETE' });
            setViolations(prev => prev.filter(v => v.id !== id));
        } catch (e) {
            alert('Failed to delete violation');
        } finally {
            setDeletingId(null);
        }
    };

    const handleCheckDeadlines = async () => {
        const res: any = await apiPost('/api/training/violations/check-deadlines', {});
        alert(`Deadline check complete. ${res.violations_created || 0} new violation(s) created.`);
        load();
    };

    const filtered = violations.filter(v => {
        if (filterType !== 'ALL' && v.type !== filterType) return false;
        if (filterStatus !== 'ALL' && v.status !== filterStatus) return false;
        return true;
    });

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Academic Integrity & Conduct</h1>
                    <p className="page-subtitle">Track poor academic performance, plagiarism, & honor code violations</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {isAdmin && (
                        <>
                            <button className="btn btn-ghost" onClick={handleCheckDeadlines} title="Scan overdue projects & tasks">🔍 Check Deadlines</button>
                            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ Report Violation</button>
                        </>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid-4 mb-24">
                    <div className="stat-card primary">
                        <div className="stat-icon primary">⚠️</div>
                        <div className="stat-info"><h3>Total Violations</h3><div className="stat-value">{summary.total}</div></div>
                    </div>
                    <div className="stat-card danger">
                        <div className="stat-icon danger">🔴</div>
                        <div className="stat-info"><h3>Open</h3><div className="stat-value">{summary.open}</div></div>
                    </div>
                    <div className="stat-card success">
                        <div className="stat-icon success">✅</div>
                        <div className="stat-info"><h3>Resolved</h3><div className="stat-value">{summary.resolved}</div></div>
                    </div>
                    <div className="stat-card accent">
                        <div className="stat-icon accent">💔</div>
                        <div className="stat-info"><h3>Total Penalties</h3><div className="stat-value">{summary.total_penalties} pts</div></div>
                    </div>
                </div>
            )}

            {/* Type Distribution */}
            {summary && Object.keys(summary.by_type).length > 0 && (
                <div className="card mb-24" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Violation Types</h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {Object.entries(summary.by_type).map(([type, count]) => {
                            const cfg = typeConfig[type] || { icon: '❓', color: 'var(--text-secondary)', label: type };
                            return (
                                <div key={type} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 14px', background: `${cfg.color}12`,
                                    border: `1px solid ${cfg.color}30`, borderRadius: '10px',
                                }}>
                                    <span>{cfg.icon}</span>
                                    <span style={{ color: cfg.color, fontWeight: 600, fontSize: '13px' }}>{cfg.label}</span>
                                    <span style={{ background: cfg.color, color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <select className="form-input" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="ALL">All Types</option>
                    {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
                <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">🔴 Open</option>
                    <option value="ACKNOWLEDGED">🟡 Acknowledged</option>
                    <option value="RESOLVED">🟢 Resolved</option>
                    <option value="DISMISSED">⚪ Dismissed</option>
                </select>
            </div>

            {/* Violations List */}
            {loading ? <p>Loading...</p> : filtered.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-icon">✅</div><h3>No violations found</h3><p className="text-sm text-muted">All clear! No violations to report.</p></div></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.map(v => {
                        const tCfg = typeConfig[v.type] || { icon: '❓', color: 'var(--text-secondary)', label: v.type };
                        const sCfg = severityConfig[v.severity] || severityConfig.MEDIUM;
                        const stCfg = statusConfig[v.status] || statusConfig.OPEN;
                        return (
                            <div key={v.id} className="card" style={{ borderLeft: `4px solid ${tCfg.color}`, position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '20px' }}>{tCfg.icon}</span>
                                            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{v.title}</h3>
                                            <span className="badge" style={{ background: sCfg.bg, color: sCfg.color, fontSize: '11px' }}>{v.severity}</span>
                                            <span className="badge" style={{ background: stCfg.bg, color: stCfg.color, fontSize: '11px' }}>{v.status}</span>
                                        </div>
                                        {v.description && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 10px', lineHeight: 1.5 }}>{v.description}</p>}
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            <span>👤 {v.student_name}</span>
                                            <span style={{ background: `${tCfg.color}18`, color: tCfg.color, padding: '2px 8px', borderRadius: '8px' }}>{tCfg.label}</span>
                                            {v.reference_title && (
                                                <span style={{ background: '#3b82f618', color: '#3b82f6', padding: '2px 8px', borderRadius: '8px' }}>
                                                    🔗 {v.reference_type}: {v.reference_title}
                                                </span>
                                            )}
                                            {v.penalty_points > 0 && <span style={{ color: '#ef4444' }}>-{v.penalty_points} pts</span>}
                                            <span>📅 {new Date(v.created_at).toLocaleDateString()}</span>
                                            {v.resolved_by && <span>✅ Resolved by {v.resolved_by}</span>}
                                        </div>
                                        {v.resolution_note && (
                                            <div style={{ marginTop: '10px', padding: '8px 12px', background: '#10b98110', borderRadius: '8px', fontSize: '12px', color: '#6ee7b7' }}>
                                                <strong>Resolution:</strong> {v.resolution_note}
                                            </div>
                                        )}
                                        {/* Screenshot Evidence */}
                                        {v.screenshot_url && (
                                            <div style={{ marginTop: '12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>📸 Screenshot Evidence</div>
                                                <img 
                                                    src={v.screenshot_url} 
                                                    alt="Violation screenshot"
                                                    onClick={() => setExpandedScreenshot(v.screenshot_url!)}
                                                    style={{ 
                                                        width: '160px', height: '120px', objectFit: 'cover',
                                                        borderRadius: '10px', border: '2px solid var(--border)',
                                                        cursor: 'pointer', transition: 'transform 0.2s',
                                                    }}
                                                    onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                                                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                                        {isAdmin && v.status === 'OPEN' && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => setShowResolveModal(v.id)}>
                                                Resolve
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button 
                                                className="btn btn-sm" 
                                                onClick={() => handleDelete(v.id)}
                                                disabled={deletingId === v.id}
                                                style={{ 
                                                    background: 'hsla(0,85%,60%,0.1)', color: '#ef4444',
                                                    border: '1px solid #ef444430', fontSize: '12px',
                                                    opacity: deletingId === v.id ? 0.5 : 1
                                                }}
                                            >
                                                {deletingId === v.id ? '...' : '🗑️ Delete'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Violation Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <h2 className="modal-title">Report Violation</h2>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group"><label className="form-label">Student ID</label><input className="form-input" required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} placeholder="Enter student user ID" /></div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Violation Type</label>
                                    <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                        {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Severity</label>
                                    <select className="form-input" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                                        <option value="LOW">🟢 Low</option><option value="MEDIUM">🟡 Medium</option><option value="HIGH">🟠 High</option><option value="CRITICAL">🔴 Critical</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group"><label className="form-label">Title</label><input className="form-input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Brief description of the violation" /></div>
                            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Details about the violation..." /></div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Penalty Points</label><input type="number" className="form-input" value={form.penalty_points} onChange={e => setForm({ ...form, penalty_points: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Reference Type</label>
                                    <select className="form-input" value={form.reference_type} onChange={e => setForm({ ...form, reference_type: e.target.value })}>
                                        <option value="">None</option><option value="PROJECT">Project</option><option value="TASK">Task</option><option value="ASSIGNMENT">Assignment</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Report Violation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Resolve Modal */}
            {showResolveModal && (
                <div className="modal-overlay" onClick={() => setShowResolveModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <h2 className="modal-title">Resolve Violation</h2>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label className="form-label">Resolution Note</label>
                            <textarea className="form-input" rows={3} value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="How was this resolved..." />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => handleResolve('DISMISSED')}>Dismiss</button>
                            <button className="btn btn-primary" onClick={() => handleResolve('RESOLVED')}>Mark Resolved</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Screenshot Lightbox */}
            {expandedScreenshot && (
                <div 
                    className="modal-overlay" 
                    onClick={() => setExpandedScreenshot(null)}
                    style={{ zIndex: 999999, background: 'rgba(0,0,0,0.9)', cursor: 'pointer' }}
                >
                    <div style={{ 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', 
                        justifyContent: 'center', height: '100%', gap: '20px' 
                    }}>
                        <img 
                            src={expandedScreenshot} 
                            alt="Violation evidence"
                            style={{ 
                                maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain',
                                borderRadius: '16px', border: '3px solid rgba(255,255,255,0.2)',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                            }}
                        />
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Click anywhere to close</div>
                    </div>
                </div>
            )}
        </div>
    );
}
