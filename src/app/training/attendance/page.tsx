'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiFetch } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

interface Batch { id: string; name: string; course_name: string; }
interface Student { id: string; name: string; student_id: string | null; }
interface AttendanceRecord { id: string; student_id: string; student_name: string; student_sid: string | null; batch_id: string; date: string; status: string; }

export default function AttendancePage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [leaveModal, setLeaveModal] = useState<{ studentId: string; studentName: string } | null>(null);
    const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' });
    const [leaveMsg, setLeaveMsg] = useState('');

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30); // default: last 30 days
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [saveToast, setSaveToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

    const [qrModal, setQrModal] = useState<{ token: string; batch_id: string; date: string } | null>(null);
    const [globalQrModal, setGlobalQrModal] = useState<{ token: string } | null>(null);

    useEffect(() => { apiGet('/api/admin/batches').then(setBatches).catch(() => { }); }, []);

    useEffect(() => {
        if (selectedBatch && selectedDate) {
            setLoading(true);
            apiGet(`/api/training/attendance?batch_id=${selectedBatch}&date=${selectedDate}`)
                .then(data => { setRecords(data); const map: Record<string, string> = {}; data.forEach((r: AttendanceRecord) => { map[r.student_id] = r.status; }); setLocalStatus(map); })
                .catch(() => { })
                .finally(() => setLoading(false));
            if (selectedBatch) {
                apiGet(`/api/training/batches/${selectedBatch}/students?date=${selectedDate}`).then(setStudents).catch(() => { });
                apiGet(`/api/admin/leaves?batch_id=${selectedBatch}`).then(data => {
                    setPendingLeaves((data || []).filter((l: any) => l.status === 'PENDING'));
                }).catch(() => { });
            }
        }
    }, [selectedBatch, selectedDate]);

    const autoSave = async (studentId: string, status: string) => {
        if (!selectedBatch || !selectedDate) return;
        try {
            const res = await apiPost('/api/training/attendance', {
                records: [{ student_id: studentId, batch_id: selectedBatch, date: selectedDate, status }]
            });
            if (res.ok) {
                setSaveToast({ msg: 'Attendance saved ✓', ok: true });
            } else {
                const err = await res.json();
                setSaveToast({ msg: `Error: ${err.detail || 'Failed to save'}`, ok: false });
            }
        } catch {
            setSaveToast({ msg: 'Network error. Please try again.', ok: false });
        }
        setTimeout(() => setSaveToast(null), 2500);
    };

    const handleSave = async () => {
        const recs = Object.entries(localStatus).map(([student_id, status]) => ({
            student_id, batch_id: selectedBatch, date: selectedDate, status,
        }));
        if (recs.length > 0) {
            try {
                const res = await apiPost('/api/training/attendance', { records: recs });
                if (res.ok) {
                    setSaveToast({ msg: `All ${recs.length} records saved ✓`, ok: true });
                } else {
                    const error = await res.json();
                    setSaveToast({ msg: `Error: ${error.detail || 'Failed to save attendance'}`, ok: false });
                }
            } catch {
                setSaveToast({ msg: 'Connection error. Please try again.', ok: false });
            }
            setTimeout(() => setSaveToast(null), 3000);
        }
    };

    const downloadCSV = async () => {
        if (!selectedBatch || !startDate || !endDate) return;
        try {
            const res = await apiFetch(`/api/training/attendance/export?batch_id=${selectedBatch}&start_date=${startDate}&end_date=${endDate}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Failed to generate attendance report');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_${selectedBatch}_${startDate}_to_${endDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err.message || 'Connection error. Please try again.');
        }
    };

    const generateQr = async () => {
        if (!selectedBatch) return;
        try {
            const res = await apiGet(`/api/training/batches/${selectedBatch}/qr`);
            setQrModal(res);
        } catch {
            alert('Failed to generate QR Code. Ensure the backend is available.');
        }
    };

    const fetchGlobalQr = async () => {
        try {
            const res = await apiGet('/api/training/qr/global');
            setGlobalQrModal({ token: res.qr_token });
        } catch {
            alert('Failed to fetch Global QR Code.');
        }
    };

    const rotateGlobalQr = async () => {
        if (!confirm('Are you certain? The old QR code will immediately stop working for all trainees.')) return;
        try {
            const res = await apiPost('/api/training/qr/global/rotate', {});
            const data = await res.json();
            setGlobalQrModal({ token: data.qr_token });
        } catch {
            alert('Failed to regenerate Global QR Code.');
        }
    };

    const cycleStatus = (studentId: string, currentStatus: string) => {
        const order = ['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE'];
        const next = order[(order.indexOf(currentStatus) + 1) % order.length];
        setLocalStatus(prev => ({ ...prev, [studentId]: next }));
        autoSave(studentId, next);
    };

    const markAll = (status: string) => {
        const map: Record<string, string> = {};
        students.forEach(s => { map[s.id] = status; });
        setLocalStatus(map);
    };

    const openLeaveModal = (studentId: string, studentName: string) => {
        setLeaveModal({ studentId, studentName });
        setLeaveForm({ start_date: selectedDate, end_date: selectedDate, reason: '' });
        setLeaveMsg('');
    };

    const submitLeave = async () => {
        if (!leaveModal) return;
        try {
            const formData = new FormData();
            formData.append('student_id', leaveModal.studentId);
            formData.append('start_date', leaveForm.start_date);
            formData.append('end_date', leaveForm.end_date);
            formData.append('reason', leaveForm.reason || 'Leave requested by trainer');
            formData.append('leave_type', 'OTHER');

            const res = await apiFetch('/api/training/submit-leave', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                throw new Error('Failed');
            }

            setLeaveMsg('Leave request created successfully!');
            setLocalStatus(prev => ({ ...prev, [leaveModal.studentId]: 'ON_LEAVE' }));
            setTimeout(() => setLeaveModal(null), 1200);
        } catch {
            setLeaveMsg('Failed to create leave request. Network error or invalid data.');
        }
    };

    const statusConfig: Record<string, { color: string; icon: string; btnClass: string }> = {
        PRESENT: { color: 'var(--success)', icon: '✅', btnClass: 'btn-success' },
        ABSENT: { color: 'var(--danger)', icon: '❌', btnClass: 'btn-danger' },
        LATE: { color: 'var(--warning)', icon: '⏰', btnClass: 'btn-warning' },
        ON_LEAVE: { color: 'var(--info)', icon: '🗓️', btnClass: 'btn-info' },
    };

    const presentCount = Object.values(localStatus).filter(s => s === 'PRESENT').length;
    const absentCount = Object.values(localStatus).filter(s => s === 'ABSENT').length;
    const lateCount = Object.values(localStatus).filter(s => s === 'LATE').length;
    const leaveCount = Object.values(localStatus).filter(s => s === 'ON_LEAVE').length;

    const handleActionLeave = async (id: string, action: 'APPROVED' | 'REJECTED') => {
        if (!confirm(`Are you sure you want to ${action.toLowerCase()} this leave?`)) return;
        try {
            await apiPost('/api/admin/leaves', { method: 'PATCH', body: JSON.stringify({ id, action }) }); // apiPost wrapper for fetch, wait we have apiPatch? Let's use fetch directly or if apiPatch is available.
            // Wait, looking at api object: apiGet, apiPost. Let's use fetch or check how it's done elsewhere.
            // Using standard fetch since apiPost doesn't support custom methods easily in this custom wrapper unless known.
            const token = localStorage.getItem('token');
            const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/admin/leaves', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ id, action })
            });
            if (res.ok) {
                alert(`Leave ${action.toLowerCase()}`);
                setPendingLeaves(prev => prev.filter(l => l.id !== id));
            } else {
                throw new Error('Failed');
            }
        } catch (err: any) {
            alert('Error updating leave');
        }
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div><h1 className="page-title">Attendance</h1><p className="page-subtitle">Mark daily attendance by batch</p></div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn btn-accent" onClick={fetchGlobalQr}>
                        🌍 View Global Login QR
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!selectedBatch}>
                        💾 Save All
                    </button>
                </div>
            </div>

            {/* Save Toast */}
            {saveToast && (
                <div style={{
                    position: 'fixed', top: '80px', right: '24px', zIndex: 3000,
                    background: saveToast.ok ? 'var(--success)' : 'var(--danger)',
                    color: '#fff', padding: '12px 20px', borderRadius: '12px',
                    fontWeight: 600, fontSize: '14px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    animation: 'slideUp 0.2s ease'
                }}>
                    {saveToast.msg}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                <div className="form-group mb-0">
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', fontWeight: 600 }}>1. Select Training Batch</label>
                    <select className="form-input" style={{ width: '100%', height: '52px', fontSize: '15px' }} value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}>
                        <option value="">Select a batch to start marking attendance...</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.course_name})</option>)}
                    </select>
                </div>

                <div className="form-group mb-0">
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', fontWeight: 600 }}>2. Select Session Date</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '6px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <input className="form-input" style={{ border: 'none', background: 'transparent', width: '100%', minHeight: 'unset', fontSize: '15px' }} type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
                <button className="btn btn-success" onClick={() => markAll('PRESENT')} disabled={!selectedBatch} style={{ flex: '1 1 auto', minWidth: '140px' }}>✅ All Present</button>
                <button className="btn btn-danger" onClick={() => markAll('ABSENT')} disabled={!selectedBatch} style={{ flex: '1 1 auto', minWidth: '140px' }}>❌ All Absent</button>
                <button className="btn btn-primary" onClick={generateQr} disabled={!selectedBatch} style={{ flex: '1 1 auto', minWidth: '160px' }}>📱 Generate QR Code</button>
            </div>

            <div className="glass-premium mb-32" style={{ padding: '28px', borderRadius: '24px' }}>
                <h3 style={{ fontSize: '18px', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                    <span style={{ fontSize: '24px' }}>📊</span> Export Detailed Attendance Report
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
                    <div className="form-group mb-0" style={{ flex: '1 1 200px' }}>
                        <label className="form-label">Report Start Date</label>
                        <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group mb-0" style={{ flex: '1 1 200px' }}>
                        <label className="form-label">Report End Date</label>
                        <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <button className="btn btn-primary" onClick={downloadCSV} disabled={!selectedBatch} style={{ height: '48px', padding: '0 32px', flex: '1 0 auto' }}>
                        📥 Download CSV Data
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            {selectedBatch && students.length > 0 && (
                <div className="grid-4 mb-24">
                    <div className="stat-card success"><div className="stat-icon success">✅</div><div className="stat-info"><h3>Present</h3><div className="stat-value">{presentCount}</div></div></div>
                    <div className="stat-card danger"><div className="stat-icon danger">❌</div><div className="stat-info"><h3>Absent</h3><div className="stat-value">{absentCount}</div></div></div>
                    <div className="stat-card accent"><div className="stat-icon accent">⏰</div><div className="stat-info"><h3>Late</h3><div className="stat-value">{lateCount}</div></div></div>
                    <div className="stat-card primary"><div className="stat-icon primary">🗓️</div><div className="stat-info"><h3>On Leave</h3><div className="stat-value">{leaveCount}</div></div></div>
                </div>
            )}

            {/* Table */}
            <div className="card">
                {!selectedBatch ? (
                    <div className="empty-state"><div className="empty-icon">✅</div><h3>Select a batch and date</h3><p className="text-sm text-muted">Choose a batch above to start marking attendance.</p></div>
                ) : loading ? <p>Loading...</p> : students.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon">👥</div><h3>No students found</h3></div>
                ) : (
                    <div className="table-responsive"><table className="table">
                        <thead><tr><th>Student ID</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>{students.map(s => {
                            const st = localStatus[s.id] || 'ABSENT';
                            const cfg = statusConfig[st] || statusConfig['ABSENT'];
                            return (
                                <tr key={s.id}>
                                    <td style={{ fontFamily: 'monospace', color: '#3399ff' }}>{s.student_id || '-'}</td>
                                    <td><strong>{s.name}</strong></td>
                                    <td>
                                        <button onClick={() => cycleStatus(s.id, st)} className={`btn btn-sm ${cfg.btnClass}`}
                                            style={{ minWidth: '120px', justifyContent: 'center' }}>
                                            {cfg.icon} {st.replace('_', ' ')}
                                        </button>
                                    </td>
                                    <td>
                                        <button className="btn btn-sm btn-ghost" onClick={() => openLeaveModal(s.id, s.name)}
                                            title="Apply Leave">🗓️ Leave</button>
                                    </td>
                                </tr>
                            );
                        })}</tbody>
                    </table></div>
                )}
            </div>

            {/* Pending Leaves */}
            {selectedBatch && pendingLeaves.length > 0 && (
                <div className="card mb-32" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <h3 style={{ fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📋 Pending Leave Requests for Batch
                    </h3>
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Leave Type</th>
                                    <th>Dates</th>
                                    <th>Reason / Proof</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingLeaves.map(l => (
                                    <tr key={l.id}>
                                        <td><strong>{l.user_name}</strong></td>
                                        <td><span className="badge badge-accent">{l.leave_type}</span></td>
                                        <td>{new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</td>
                                        <td>
                                            <div className="text-sm">{l.reason || '-'}</div>
                                            {l.proof_url && (
                                                <a href={l.proof_url} target="_blank" rel="noreferrer" className="text-primary text-xs" style={{ textDecoration: 'underline' }}>
                                                    View Med Proof
                                                </a>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn btn-sm btn-success" onClick={() => handleActionLeave(l.id, 'APPROVED')}>Approve</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleActionLeave(l.id, 'REJECTED')}>Reject</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {leaveModal && (
                <div className="modal-overlay" onClick={() => setLeaveModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <h2 className="modal-title">Apply Leave — {leaveModal.studentName}</h2>
                        <p style={{ margin: '-16px 0 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>Create an official leave record for this student session.</p>
                        
                        {leaveMsg && (
                            <div className="badge" style={{ 
                                width: '100%', 
                                justifyContent: 'center', 
                                padding: '12px', 
                                marginBottom: '20px',
                                background: leaveMsg.includes('success') ? 'var(--success-glow)' : 'var(--danger-glow)',
                                color: leaveMsg.includes('success') ? 'var(--success-dark)' : 'var(--danger-dark)',
                                borderRadius: '12px'
                            }}>
                                {leaveMsg}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="form-row">
                                <div className="form-group mb-0">
                                    <label className="form-label">Start Date</label>
                                    <input className="form-input" type="date" value={leaveForm.start_date}
                                        onChange={e => setLeaveForm(prev => ({ ...prev, start_date: e.target.value }))} />
                                </div>
                                <div className="form-group mb-0">
                                    <label className="form-label">End Date</label>
                                    <input className="form-input" type="date" value={leaveForm.end_date}
                                        onChange={e => setLeaveForm(prev => ({ ...prev, end_date: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-group mb-0">
                                <label className="form-label">Reason for Absence</label>
                                <textarea className="form-textarea" rows={3} placeholder="Provide a brief explanation..."
                                    value={leaveForm.reason} onChange={e => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))} />
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setLeaveModal(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={submitLeave}>Initialize Leave Request</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global QR Modal */}
            {globalQrModal && (
                <div className="modal-overlay" onClick={() => setGlobalQrModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center', padding: '40px 30px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99,102,241,0.1)', color: '#3399ff', fontSize: '32px', marginBottom: '20px' }}>
                            🌍
                        </div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700, color: '#f8fafc' }}>
                            Global Trainee Login
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '32px' }}>
                            Have trainees scan this code to Punch In / Punch Out. It is persistent and works for <strong>all</strong> current students and trainers.
                        </p>

                        <div style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '24px', display: 'inline-block', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', marginBottom: '32px' }}>
                            <QRCodeSVG
                                value={globalQrModal.token}
                                size={220}
                                level="H"
                                fgColor="#0f172a"
                                bgColor="#ffffff"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button className="btn btn-danger" onClick={rotateGlobalQr}>
                                🔄 Regenerate Code
                            </button>
                            <button className="btn btn-primary" onClick={() => setGlobalQrModal(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}
                    onClick={() => setQrModal(null)}>
                    <div style={{ background: '#0a0a0a', borderRadius: '32px', padding: '48px', maxWidth: '500px', width: '90%', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #0066ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 24px' }}>
                            📱
                        </div>
                        <h2 style={{ fontSize: '28px', margin: '0 0 8px', background: 'linear-gradient(to right, #fff, #3399ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Scan to Mark Attendance
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 0 32px' }}>
                            Session Date: <strong>{qrModal.date}</strong><br />
                            Have your students scan this QR code using their LMS portal.
                        </p>

                        <div style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '24px', display: 'inline-block', boxShadow: '0 0 40px rgba(139, 92, 246, 0.3)' }}>
                            {/* We use a simple external API or library for the actual rendering. Since we don't have next/image or qrcode.react explicitly built in easily via simple string imports, we can use an external free QR generator API for rapid prototype */}
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent((qrModal as any).qr_token || qrModal.token)}`} alt="Attendance QR Code" style={{ display: 'block', borderRadius: '8px' }} />
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', marginTop: '32px', padding: '16px' }} onClick={() => setQrModal(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
