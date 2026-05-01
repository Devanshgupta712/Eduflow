'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, apiFetch } from '@/lib/api';

interface TimeLog {
    id: string;
    date: string;
    login_time: string;
    logout_time: string | null;
    total_minutes: number | null;
    user: {
        id: string;
        name: string;
        email: string;
        student_id: string | null;
        role?: string;
    };
}

interface UserSummary {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface PersonDaySummary {
    userId: string;
    name: string;
    email: string;
    role: string;
    studentId: string | null;
    sessions: number;
    firstIn: string | null;
    lastOut: string | null;
    totalMinutes: number;
    activeNow: boolean;
    logs: TimeLog[];
}

export default function TimeTrackingPage() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [logs, setLogs] = useState<TimeLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ avgHours: '0h', activeToday: 0, onTime: 0, late: 0, absent: 0 });
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrUrl, setQrUrl] = useState('');

    // Management State
    const [showManualModal, setShowManualModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [formLoading, setFormLoading] = useState(false);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        user_id: '',
        date: new Date().toISOString().split('T')[0],
        login_time: '',
        logout_time: ''
    });

    // Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportStartDate, setExportStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [exportRole, setExportRole] = useState('');
    const [exportUserId, setExportUserId] = useState('');
    const [exportUsers, setExportUsers] = useState<UserSummary[]>([]);
    const [exporting, setExporting] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string>('ALL');

    useEffect(() => {
        loadData();
    }, [selectedDate]);

    useEffect(() => {
        if (showManualModal) {
            loadUsers();
        }
    }, [showManualModal]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await apiGet(`/api/training/time-tracking?date=${selectedDate}`);
            setLogs(data.logs || []);
            setStats(data.stats || { avgHours: '0h', activeToday: 0, onTime: 0, late: 0, absent: 0 });
        } catch (err) {
            console.error('Failed to load time tracking data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const data = await apiGet('/api/admin/students?role=STUDENT');
            setUsers(data || []);
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    const [qrSecret, setQrSecret] = useState('');
    const [qrError, setQrError] = useState('');

    const fetchQrConfig = async () => {
        try {
            setQrError('');
            const res = await apiFetch('/api/training/qr-config');
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Server error: ${res.status}`);
            }
            const data = await res.json();
            if (data?.qr_secret) {
                setQrSecret(data.qr_secret);
                setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr_secret)}`);
            }
        } catch (err: any) {
            console.error('Failed to fetch QR config:', err);
            setQrError(err.message || 'Failed to connect to backend.');
        }
    };

    const handleOpenQrModal = async () => {
        setQrUrl('');
        setQrError('');
        setShowQrModal(true);
        await fetchQrConfig();
    };

    const handleRegenerateQr = async () => {
        if (!confirm('This will invalidate all current QR codes printed or displayed elsewhere. Trainees must scan the NEW code. Continue?')) return;
        try {
            setQrUrl('');
            setQrError('');
            const res = await apiPost('/api/training/qr-config/regenerate', {});
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Regeneration failed: ${res.status}`);
            }
            const data = await res.json();
            if (data?.qr_secret) {
                setQrSecret(data.qr_secret);
                setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr_secret)}`);
                alert('New QR code generated successfully.');
            }
        } catch (err: any) {
            alert(err.message || 'Failed to regenerate QR code.');
            setQrError(err.message || 'Regeneration failed.');
        }
    };

    const formatTimeForInput = (isoString: string | null) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toTimeString().slice(0, 5);
    };

    const handleAddManual = () => {
        setFormData({
            user_id: '',
            date: selectedDate,
            login_time: '09:00',
            logout_time: '18:00'
        });
        setShowManualModal(true);
    };

    const handleEdit = (log: TimeLog) => {
        setEditingLog(log);
        setFormData({
            user_id: log.user.id,
            date: log.date.split('T')[0],
            login_time: formatTimeForInput(log.login_time),
            logout_time: formatTimeForInput(log.logout_time)
        });
        setShowEditModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this log?')) return;
        try {
            await apiDelete(`/api/training/time-tracking/${id}`);
            loadData();
        } catch (err) {
            alert('Failed to delete log');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            // Construct naive ISO strings to avoid timezone shifting
            const login_iso = `${formData.date}T${formData.login_time}:00`;
            const logout_iso = formData.logout_time ? `${formData.date}T${formData.logout_time}:00` : null;

            if (showEditModal && editingLog) {
                await apiPatch(`/api/training/time-tracking/${editingLog.id}`, {
                    login_time: login_iso,
                    logout_time: logout_iso
                });
            } else {
                await apiPost('/api/training/time-tracking', {
                    user_id: formData.user_id,
                    date: formData.date,
                    login_time: login_iso,
                    logout_time: logout_iso
                });
            }
            setShowManualModal(false);
            setShowEditModal(false);
            loadData();
        } catch (err) {
            alert('Operation failed. Please check inputs.');
        } finally {
            setFormLoading(false);
        }
    };

    const formatTime = (isoString: string | null) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (minutes: number) => {
        if (minutes <= 0) return '0m';
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        if (h === 0) return `${m}m`;
        return `${h}h ${m}m`;
    };

    // Aggregate logs into per-person summaries
    const personSummaries: PersonDaySummary[] = (() => {
        const map = new Map<string, PersonDaySummary>();
        // Sort logs by login_time ascending to get firstIn/lastOut correctly
        const sortedLogs = [...logs].sort((a, b) => new Date(a.login_time).getTime() - new Date(b.login_time).getTime());
        for (const log of sortedLogs) {
            const uid = log.user.id || log.user.email;
            if (!map.has(uid)) {
                map.set(uid, {
                    userId: uid,
                    name: log.user.name,
                    email: log.user.email,
                    role: log.user.role || 'N/A',
                    studentId: log.user.student_id,
                    sessions: 0,
                    firstIn: null,
                    lastOut: null,
                    totalMinutes: 0,
                    activeNow: false,
                    logs: [],
                });
            }
            const summary = map.get(uid)!;
            summary.sessions += 1;
            summary.logs.push(log);

            // First in is always the first login_time (logs sorted ascending)
            if (!summary.firstIn) summary.firstIn = log.login_time;

            // Last out: update whenever we have a logout_time
            if (log.logout_time) summary.lastOut = log.logout_time;

            if (log.total_minutes) summary.totalMinutes += log.total_minutes;
            if (!log.logout_time) summary.activeNow = true;
        }
        const rolePriority: Record<string, number> = { 'ADMIN': 1, 'TRAINER': 2, 'MARKETER': 3, 'STUDENT': 4 };
        return Array.from(map.values()).sort((a, b) => {
            const pa = rolePriority[a.role] || 5;
            const pb = rolePriority[b.role] || 5;
            if (pa !== pb) return pa - pb;
            return a.name.localeCompare(b.name);
        });
    })();

    const ROLE_TABS = [
        { key: 'ALL', label: '🌐 All', color: '#6366f1' },
        { key: 'STUDENT', label: '🎓 Students', color: '#0ea5e9' },
        { key: 'TRAINER', label: '🏋️ Trainee', color: '#10b981' },
        { key: 'ADMIN', label: '🔑 Admin', color: '#f59e0b' },
        { key: 'MARKETER', label: '📣 Marketing', color: '#ec4899' },
    ];

    const filteredSummaries = selectedRole === 'ALL'
        ? personSummaries
        : personSummaries.filter(p => p.role === selectedRole);

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'badge-primary';
            case 'TRAINER': return 'badge-success';
            case 'STUDENT': return 'badge-info';
            case 'MARKETER': return 'badge-warning';
            default: return '';
        }
    };

    return (
        <div className="animate-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="page-title">Work Hours</h1>
                    <p className="page-subtitle">Daily work hours summary for all staff &amp; trainees</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="form-control"
                        style={{ width: 'auto' }}
                    />
                    <button className="btn btn-ghost" onClick={handleAddManual} style={{ border: '1px solid var(--border)' }}>
                        ➕ Manual Entry
                    </button>
                    <button className="btn btn-primary" onClick={handleOpenQrModal} style={{ background: 'linear-gradient(135deg, #00c853, #0066ff)', padding: '8px 20px', borderRadius: '12px' }}>
                        🎁 Machine Modal
                    </button>
                    <a href="/admin/time-tracking/qr" target="_blank" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #0066ff, #0044cc)', padding: '8px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                        🖥️ Full Screen QR
                    </a>
                    <button className="btn btn-ghost" onClick={loadData}>
                        🔄 Refresh
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowExportModal(true)} style={{ background: 'linear-gradient(135deg, #f59e0b, #ff1744)', padding: '8px 20px', borderRadius: '12px' }}>
                        📥 Download Report
                    </button>
                </div>
            </div>

            <div className="grid-4 mb-24" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="stat-card primary"><div className="stat-icon primary">⏱️</div><div className="stat-info"><h3>Avg. Daily Hours</h3><div className="stat-value">{stats.avgHours}</div></div></div>
                <div className="stat-card accent"><div className="stat-icon accent">👥</div><div className="stat-info"><h3>Active Now</h3><div className="stat-value">{stats.activeToday}</div></div></div>
                <div className="stat-card success"><div className="stat-icon success">✅</div><div className="stat-info"><h3>On Time</h3><div className="stat-value">{stats.onTime}</div></div></div>
                <div className="stat-card danger"><div className="stat-icon danger">⚠️</div><div className="stat-info"><h3>Late Arrivals</h3><div className="stat-value">{stats.late}</div></div></div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ff1744' }}><div className="stat-icon" style={{ background: 'rgba(255,23,68,0.08)', color: '#ff1744' }}>🚫</div><div className="stat-info"><h3>Absent</h3><div className="stat-value">{stats.absent}</div></div></div>
            </div>

            {/* Work Hours Summary Table */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 className="font-semibold">Daily Work Hours — {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</h3>
                    <span className="text-sm text-muted">{filteredSummaries.length} people logged</span>
                </div>

                {/* Role Section Tabs */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                    {ROLE_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedRole(tab.key)}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '20px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '13px',
                                transition: 'all 0.2s',
                                background: selectedRole === tab.key ? tab.color : 'rgba(255,255,255,0.05)',
                                color: selectedRole === tab.key ? '#fff' : 'var(--text-muted)',
                                boxShadow: selectedRole === tab.key ? `0 2px 10px ${tab.color}55` : 'none',
                            }}
                        >
                            {tab.label} <span style={{ opacity: 0.75, fontSize: '11px', marginLeft: '4px' }}>
                                ({tab.key === 'ALL' ? personSummaries.length : personSummaries.filter(p => p.role === tab.key).length})
                            </span>
                        </button>
                    ))}
                </div>
                {loading ? (
                    <p>Loading...</p>
                ) : filteredSummaries.length === 0 ? (
                    <div className="empty-state" style={{ padding: '60px 16px' }}>
                        <div className="empty-icon">⏱️</div>
                        <h3>No work hours recorded</h3>
                        <p className="text-sm text-muted">Work hour data will appear here for {selectedDate}.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Sessions</th>
                                    <th>First In</th>
                                    <th>Last Out</th>
                                    <th>Total Hours</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSummaries.map(person => (
                                    <>
                                        <tr key={person.userId} style={{ cursor: 'pointer' }} onClick={() => setExpandedUser(expandedUser === person.userId ? null : person.userId)}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{person.name}</div>
                                                <div className="text-sm text-muted">{person.email}</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${getRoleBadgeClass(person.role)}`} style={{ fontSize: '11px' }}>
                                                    {person.role?.replace('_', ' ') || 'N/A'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 500 }}>{person.sessions}</span>
                                            </td>
                                            <td>
                                                <span style={{ color: '#00c853', fontWeight: 600, fontSize: '14px' }}>
                                                    {formatTime(person.firstIn)}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ color: person.activeNow ? '#ffab00' : (person.lastOut ? '#ff1744' : 'var(--text-muted)'), fontWeight: 600, fontSize: '14px' }}>
                                                    {person.activeNow && !person.lastOut ? '🟢 Active' : formatTime(person.lastOut)}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 700, fontSize: '15px',
                                                    color: person.totalMinutes >= 480 ? '#00c853' : person.totalMinutes >= 240 ? '#ffab00' : '#ff1744'
                                                }}>
                                                    {formatDuration(person.totalMinutes)}
                                                </span>
                                            </td>
                                            <td>
                                                {person.activeNow ? (
                                                    <span className="badge badge-warning">🟢 Active</span>
                                                ) : (
                                                    <span className="badge badge-success">✅ Complete</span>
                                                )}
                                            </td>
                                            <td>
                                                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setExpandedUser(expandedUser === person.userId ? null : person.userId); }}>
                                                    {expandedUser === person.userId ? '▲' : '▼'}
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded: show individual sessions */}
                                        {expandedUser === person.userId && (
                                            <tr key={`${person.userId}-detail`}>
                                                <td colSpan={8} style={{ padding: '0 16px 16px', background: 'var(--bg-secondary)' }}>
                                                    <div style={{ padding: '12px', borderRadius: '8px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            All Sessions for {person.name}
                                                        </div>
                                                        <table style={{ width: '100%', fontSize: '13px' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>#</th>
                                                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Punch In</th>
                                                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Punch Out</th>
                                                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Duration</th>
                                                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {person.logs.sort((a, b) => new Date(a.login_time).getTime() - new Date(b.login_time).getTime()).map((log, idx) => (
                                                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '6px 8px', color: '#00c853', fontWeight: 500 }}>{formatTime(log.login_time)}</td>
                                                                        <td style={{ padding: '6px 8px', color: log.logout_time ? '#ff1744' : 'var(--text-muted)', fontWeight: 500 }}>
                                                                            {log.logout_time ? formatTime(log.logout_time) : '— tracking...'}
                                                                        </td>
                                                                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                                                                            {log.total_minutes ? formatDuration(log.total_minutes) : (log.logout_time ? '0m' : '...')}
                                                                        </td>
                                                                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                                                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(log)} style={{ fontSize: '12px', padding: '2px 6px' }}>✏️</button>
                                                                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(log.id)} style={{ fontSize: '12px', padding: '2px 6px' }}>🗑️</button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Manual Entry / Edit Modal */}
            {(showManualModal || showEditModal) && (
                <div className="modal-backdrop" onClick={() => { setShowManualModal(false); setShowEditModal(false); }}>
                    <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <h3 className="mb-24">{showEditModal ? 'Edit Time Log' : 'Add Manual Entry'}</h3>
                        <form onSubmit={handleSubmit}>
                            {!showEditModal && (
                                <div className="form-group mb-16">
                                    <label>Select Trainee</label>
                                    <select
                                        className="form-control"
                                        required
                                        value={formData.user_id}
                                        onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                                    >
                                        <option value="">-- Choose Trainee --</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group mb-16">
                                <label>Date</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    required
                                    disabled={showEditModal}
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>

                            <div className="grid-2 mb-24">
                                <div className="form-group">
                                    <label>Punch In Time</label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        required
                                        value={formData.login_time}
                                        onChange={e => setFormData({ ...formData, login_time: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Punch Out Time</label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        value={formData.logout_time}
                                        onChange={e => setFormData({ ...formData, logout_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setShowManualModal(false); setShowEditModal(false); }} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ flex: 2 }}>
                                    {formLoading ? 'Saving...' : 'Save Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showQrModal && (
                <div className="modal-backdrop" onClick={() => setShowQrModal(false)}>
                    <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0 }}>Punch Machine QR</h3>
                            <button className="btn btn-ghost" onClick={() => setShowQrModal(false)} style={{ padding: '4px 8px' }}>✕</button>
                        </div>

                        <div className="text-sm text-muted mb-20" style={{ textAlign: 'left', padding: '12px', background: 'rgba(0, 102, 255, 0.05)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                            <p style={{ marginBottom: '8px' }}><strong>Universal Punch QR Code:</strong></p>
                            <ul style={{ paddingLeft: '20px', listStyleType: 'disc' }}>
                                <li>Scan 1st: <strong>Punch In</strong></li>
                                <li>Scan 2nd: <strong>Punch Out</strong></li>
                                <li><strong>Everyone</strong> can use this (except Super Admin).</li>
                                <li>Location restricted to institute radius.</li>
                            </ul>
                        </div>

                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: '24px',
                            borderRadius: '16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                            border: '1px solid var(--border)',
                            minWidth: '250px',
                            minHeight: '250px'
                        }}>
                            {qrUrl ? (
                                <img src={qrUrl} alt="Permanent Punch QR" width={250} height={250} style={{ display: 'block' }} />
                            ) : qrError ? (
                                <div style={{ color: '#ff1744', padding: '20px', fontSize: '14px' }}>
                                    ⚠️ {qrError}
                                </div>
                            ) : (
                                <div className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Generating QR...</div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn btn-ghost" onClick={() => {
                                const printWindow = window.open('', '_blank');
                                if (printWindow && qrUrl) {
                                    printWindow.document.write(`
                                        <html><head><title>Punch Machine QR</title>
                                        <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;}
                                        h1{font-size:28px;margin-bottom:8px;} p{color:#666;margin-bottom:24px;font-size:16px;}
                                        img{border:8px solid #000;border-radius:16px;}
                                        .info{margin-top:24px;font-size:14px;color:#888;}
                                        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>
                                        </head><body>
                                        <h1>EduSuite.ai — Punch Machine</h1>
                                        <p>Scan to Punch In / Out</p>
                                        <img src="${qrUrl.replace('250x250', '400x400')}" width="400" height="400" />
                                        <p class="info">Everyone can scan (except Super Admin) • Location restricted</p>
                                        </body></html>
                                    `);
                                    printWindow.document.close();
                                    setTimeout(() => { printWindow.print(); }, 500);
                                }
                            }} style={{ flex: 1 }}>🖨️ Print</button>
                            <button className="btn btn-danger" onClick={handleRegenerateQr} style={{ flex: 1 }}>🔄 Regenerate</button>
                        </div>

                        <p className="text-xs text-muted mt-16 italic">
                            Regenerating will invalidate old codes immediately.
                        </p>
                    </div>
                </div>
            )}
            {showExportModal && (
                <div className="modal-backdrop" onClick={() => setShowExportModal(false)}>
                    <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>📥 Download Work Hours Report</h3>
                            <button className="btn btn-ghost" onClick={() => setShowExportModal(false)} style={{ padding: '4px 8px' }}>✕</button>
                        </div>

                        <div className="text-sm text-muted mb-20" style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                            <p style={{ marginBottom: '4px' }}><strong>CSV report includes:</strong></p>
                            <ul style={{ paddingLeft: '20px', listStyleType: 'disc', margin: 0 }}>
                                <li>Grouped by role (Admin, Trainer, Marketer, Student)</li>
                                <li>Total work hours per person per day</li>
                                <li>On Time / Late status for each entry</li>
                            </ul>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label className="form-label">Role Section</label>
                                <select
                                    className="form-control"
                                    value={exportRole}
                                    onChange={async e => {
                                        setExportRole(e.target.value);
                                        setExportUserId(''); // reset user
                                        if (e.target.value) {
                                            const res = await apiGet(`/api/admin/students?role=${e.target.value}`);
                                            setExportUsers(res || []);
                                        } else {
                                            setExportUsers([]);
                                        }
                                    }}
                                >
                                    <option value="">All Roles</option>
                                    <option value="STUDENT">Student</option>
                                    <option value="TRAINER">Trainer</option>
                                    <option value="MARKETER">Marketer</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Specific Person</label>
                                <select
                                    className="form-control"
                                    value={exportUserId}
                                    onChange={e => setExportUserId(e.target.value)}
                                    disabled={!exportRole && exportUsers.length === 0}
                                >
                                    <option value="">All People in Section</option>
                                    {exportUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            <div>
                                <label className="form-label">Start Date</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={exportStartDate}
                                    onChange={e => setExportStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label">End Date</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={exportEndDate}
                                    onChange={e => setExportEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            disabled={exporting}
                            style={{ width: '100%', background: 'linear-gradient(135deg, #f59e0b, #ff1744)', padding: '12px', borderRadius: '12px', fontSize: '15px' }}
                            onClick={async () => {
                                try {
                                    setExporting(true);
                                    const params = new URLSearchParams({ start_date: exportStartDate, end_date: exportEndDate });
                                    if (exportRole) params.append('role', exportRole);
                                    if (exportUserId) params.append('user_id', exportUserId);
                                    const res = await apiFetch(`/api/training/time-tracking/export?${params.toString()}`);
                                    if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.detail || 'Export failed');
                                    }
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `work_hours_${exportStartDate}_to_${exportEndDate}.csv`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                    setShowExportModal(false);
                                } catch (err: any) {
                                    alert(err.message || 'Failed to export');
                                } finally {
                                    setExporting(false);
                                }
                            }}
                        >
                            {exporting ? 'Generating...' : '📥 Download CSV'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
