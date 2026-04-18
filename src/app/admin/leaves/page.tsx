'use client';

import { useState, useEffect } from 'react';
import { apiFetch, apiGet, apiPatch, getStoredUser } from '@/lib/api';

interface LeaveReq {
    id: string; 
    start_date: string; 
    end_date: string; 
    reason: string | null;
    rejection_reason: string | null;
    leave_type: string; 
    proof_url: string | null;
    status: string; 
    created_at: string; 
    user_name: string; 
    user_role: string; 
    user_student_id: string | null;
}

export default function LeavesPage() {
    const [leaves, setLeaves] = useState<LeaveReq[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'TABLE' | 'CALENDAR'>('TABLE');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [filter, setFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [actionError, setActionError] = useState<string | null>(null);
    
    // Modals
    const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showProofModal, setShowProofModal] = useState<string | null>(null);

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const user = getStoredUser();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com';

    // Keep Render server awake by pinging every 30 seconds while admin is on this page
    useEffect(() => {
        loadLeaves();
        const keepAlive = setInterval(() => {
            fetch(`${API_BASE}/api/health`).catch(() => {});
        }, 30 * 1000); // every 30 seconds
        return () => clearInterval(keepAlive);
    }, [searchQuery, dateFilter]);

    const loadLeaves = async () => {
        setLoading(true);
        try { 
            const params = new URLSearchParams();
            if (searchQuery) params.append('q', searchQuery);
            if (dateFilter) params.append('date', dateFilter);
            setLeaves(await apiGet(`/api/admin/leaves?${params.toString()}`)); 
        } catch { } finally { setLoading(false); }
    };

    const handleAction = async (id: string, status: string, reason: string | null = null) => {
        setActionError(null);
        setActionLoading(id + status);

        const wakeUpServer = async () => {
            try { await fetch(`${API_BASE}/api/health`); } catch { /* ignore */ }
        };

        const attemptAction = async (): Promise<void> => {
            const res = await apiFetch('/api/admin/leaves', {
                method: 'PATCH',
                body: JSON.stringify({ id, status, rejection_reason: reason }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.detail || `Server error ${res.status}`);
            }
        };

        try {
            // Pre-action ping to wake up Render before the real PATCH request
            await wakeUpServer();

            try {
                await attemptAction();
            } catch (err: any) {
                // Network error = server still spinning up. Wait 8s and retry.
                if (!err?.message?.includes('Server error')) {
                    await new Promise(r => setTimeout(r, 8000));
                    await attemptAction();
                } else {
                    throw err;
                }
            }
            setShowRejectionModal(null);
            setRejectionReason('');
            await loadLeaves();
        } catch (err: any) {
            setActionError(err?.message || 'Server is warming up — please wait 15 seconds and try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const ROLES = ['ALL', 'STUDENT', 'TRAINER', 'ADMIN', 'MARKETER'];
    const TYPES = ['ALL', 'MEDICAL', 'INTERVIEW', 'WORK_FROM_HOME', 'OTHER'];
    
    const filtered = leaves
        .filter(l => filter === 'ALL' || l.status === filter)
        .filter(l => roleFilter === 'ALL' || l.user_role === roleFilter)
        .filter(l => typeFilter === 'ALL' || l.leave_type === typeFilter);

    const getRoleBadge = (role: string) => {
        const map: Record<string, string> = { STUDENT: '#0ea5e9', TRAINER: '#10b981', ADMIN: '#f59e0b', MARKETER: '#ec4899', SUPER_ADMIN: '#6366f1' };
        return map[role] || '#888';
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div><h1 className="page-title">Leave Requests</h1><p className="page-subtitle">Approve or reject leave requests</p></div>
                <button 
                    onClick={() => {
                        const headers = "Person,StudentID,Role,Start Date,End Date,Type,Reason,Status\n";
                        const rows = filtered.map(l => 
                            `"${l.user_name}","${l.user_student_id || ''}","${l.user_role}","${l.start_date.split('T')[0]}","${l.end_date.split('T')[0]}","${l.leave_type}","${(l.reason || '').replace(/"/g, '""')}","${l.status}"`
                        ).join('\n');
                        const blob = new Blob([headers + rows], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `leave_report_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                    }}
                    className="btn btn-ghost"
                    style={{ background: 'rgba(255,255,255,0.05)', fontSize: '12px' }}
                >
                    📥 Export to CSV
                </button>
            </div>

            {actionError && (
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', color: '#f87171', fontSize: '14px' }}>
                    ⚠️ {actionError}
                </div>
            )}

            {/* Filters Row */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Status Filters */}
                <div>
                    <label className="text-sm text-muted mb-8 block">Status</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                            <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(s)}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Role Filters */}
                <div>
                    <label className="text-sm text-muted mb-8 block">Role</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {ROLES.map(r => (
                            <button
                                key={r}
                                onClick={() => setRoleFilter(r)}
                                className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ background: roleFilter === r ? getRoleBadge(r) : undefined }}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Type Filters */}
                <div>
                    <label className="text-sm text-muted mb-8 block">Leave Type</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {TYPES.map(t => (
                            <button key={t} className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTypeFilter(t)}>
                                {t.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Advanced Search */}
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <label className="text-sm text-muted mb-8 block">Advanced Search</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ position: 'relative', flex: 2 }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                            <input 
                                type="text" 
                                placeholder="Search by name or ID..." 
                                className="form-input" 
                                style={{ paddingLeft: '38px', borderRadius: '10px' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input 
                                type="date" 
                                className="form-input" 
                                style={{ borderRadius: '10px' }}
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                            {dateFilter && (
                                <button 
                                    onClick={() => setDateFilter('')}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >✕</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
                <button 
                    onClick={() => setViewMode('TABLE')} 
                    className={`btn btn-sm ${viewMode === 'TABLE' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ borderRadius: '8px' }}
                >📋 Table View</button>
                <button 
                    onClick={() => setViewMode('CALENDAR')} 
                    className={`btn btn-sm ${viewMode === 'CALENDAR' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ borderRadius: '8px' }}
                >📅 Calendar View</button>
            </div>

            {viewMode === 'TABLE' ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>Loading leave requests...</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state" style={{ padding: '60px' }}>
                            <div className="empty-icon">🗓️</div>
                            <h3>No matching requests</h3>
                            <p className="text-muted text-sm">Try adjusting your filters.</p>
                        </div>
                    ) : (
                        <div className="table-responsive"><table className="table">
                            <thead><tr><th>Person</th><th>Dates</th><th>Type & Reason</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>{filtered.map(l => (
                                <tr key={l.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <strong style={{ fontSize: '15px' }}>{l.user_name}</strong>
                                            <span style={{ background: getRoleBadge(l.user_role), color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>
                                                {l.user_role}
                                            </span>
                                        </div>
                                        <div className="text-sm text-muted">{l.user_student_id || 'Staff'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{new Date(l.start_date).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to {new Date(l.end_date).toLocaleDateString()}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.leave_type.replace(/_/g, ' ')}</div>
                                        <div className="text-muted text-sm" style={{ maxWidth: '300px' }}>{l.reason || '-'}</div>
                                        
                                        {l.proof_url && (
                                            <button 
                                                onClick={() => setShowProofModal(l.proof_url!)}
                                                style={{ marginTop: '8px', padding: '6px 12px', background: 'rgba(0,102,255,0.1)', border: '1px solid rgba(0,102,255,0.2)', borderRadius: '6px', color: '#0066ff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                View Attachment {(l.proof_url.toLowerCase().endsWith('.pdf') || l.proof_url.startsWith('data:application/pdf') || l.proof_url.includes('/raw/upload/')) ? '📄' : '🖼️'}
                                            </button>
                                        )}

                                        {l.rejection_reason && (
                                            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', borderLeft: '3px solid #ef4444', fontSize: '12px', color: '#ef4444' }}>
                                                <strong>Rejection Reason:</strong> {l.rejection_reason}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${l.status === 'APPROVED' ? 'badge-success' : l.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td>
                                        {l.user_role === 'TRAINER' && !isSuperAdmin ? (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>🔒 Super Admin only</span>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {l.status !== 'APPROVED' && (
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleAction(l.id, 'APPROVED')}
                                                        disabled={actionLoading !== null}
                                                        style={{ padding: '4px 10px', opacity: actionLoading !== null ? 0.6 : 1 }}
                                                    >
                                                        {actionLoading === l.id + 'APPROVED' ? '⏳ Wait...' : 'Approve'}
                                                    </button>
                                                )}
                                                {l.status !== 'REJECTED' && (
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => setShowRejectionModal(l.id)}
                                                        disabled={actionLoading !== null}
                                                        style={{ padding: '4px 10px', opacity: actionLoading !== null ? 0.6 : 1 }}
                                                    >
                                                        Reject
                                                    </button>
                                                )}
                                                {l.status !== 'PENDING' && (
                                                    <button
                                                        className="btn btn-sm btn-ghost"
                                                        onClick={() => handleAction(l.id, 'PENDING')}
                                                        disabled={actionLoading !== null}
                                                        style={{ padding: '4px 10px', opacity: actionLoading !== null ? 0.6 : 1 }}
                                                    >
                                                        {actionLoading === l.id + 'PENDING' ? '⏳ Wait...' : 'Reset'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}</tbody>
                        </table></div>
                    )}
                </div>
            ) : (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 className="font-semibold">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-sm btn-ghost" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>◀ Previous</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setCurrentMonth(new Date())}>Today</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>Next ▶</button>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', paddingBottom: '8px' }}>{d}</div>
                        ))}
                        
                        {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} style={{ height: '100px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}></div>
                        ))}
                        
                        {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                            const date = i + 1;
                            const dStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                            const dayLeaves = filtered.filter(l => {
                                const start = l.start_date.split('T')[0];
                                const end = l.end_date.split('T')[0];
                                return dStr >= start && dStr <= end;
                            });
                            
                            return (
                                <div key={date} style={{ height: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', border: dStr === new Date().toISOString().split('T')[0] ? '1px solid var(--primary-color)' : '1px solid transparent' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{date}</span>
                                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {dayLeaves.map(l => (
                                            <div 
                                                key={l.id} 
                                                title={`${l.user_name}: ${l.leave_type}`}
                                                style={{ 
                                                    fontSize: '9px', 
                                                    padding: '2px 4px', 
                                                    borderRadius: '4px', 
                                                    background: l.status === 'APPROVED' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                                                    color: l.status === 'APPROVED' ? '#10b981' : '#f59e0b',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    border: `1px solid ${l.status === 'APPROVED' ? '#10b98144' : '#f59e0b44'}`
                                                }}
                                            >
                                                {l.user_name.split(' ')[0]}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}


            {/* Rejection Reason Modal */}
            {showRejectionModal && (
                <div className="modal-overlay" onClick={() => setShowRejectionModal(null)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>Reject Leave Request</h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-muted)' }}>Enter a reason for rejection (optional). The student will be notified.</p>

                        <textarea
                            className="form-input"
                            rows={4}
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            style={{ width: '100%', marginBottom: '20px', boxSizing: 'border-box' }}
                            autoFocus
                        />

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setShowRejectionModal(null)}>Cancel</button>
                            <button
                                className="btn btn-danger"
                                disabled={actionLoading !== null}
                                onClick={() => handleAction(showRejectionModal!, 'REJECTED', rejectionReason)}
                            >
                                {actionLoading ? '⏳ Rejecting...' : '❌ Reject Leave'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Proof Lightbox Modal */}
            {showProofModal && (
                <div 
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', padding: '24px' }}
                    onClick={() => setShowProofModal(null)}
                >
                    <div style={{ position: 'absolute', top: '24px', right: '24px', color: '#fff', fontSize: '24px', cursor: 'pointer', zIndex: 10 }}>✕</div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }} onClick={e => e.stopPropagation()}>
                        {(showProofModal.toLowerCase().endsWith('.pdf') || showProofModal.startsWith('data:application/pdf') || showProofModal.includes('/raw/upload/')) ? (
                            <iframe 
                                src={showProofModal} 
                                style={{ width: '100%', height: '100%', maxWidth: '1000px', border: 'none', borderRadius: '12px', background: 'var(--bg-primary)' }} 
                            />
                        ) : (
                            <img 
                                src={showProofModal} 
                                alt="Proof" 
                                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} 
                            />
                        )}
                    </div>
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <a href={showProofModal} download className="btn btn-primary" onClick={e => e.stopPropagation()}>⬇️ Download Original File</a>
                    </div>
                </div>
            )}
        </div>
    );
}
