'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface Student { 
    id: string; 
    name: string; 
    email: string; 
    phone: string | null; 
    student_id: string | null; 
    role: string; 
    is_active: boolean; 
    created_at: string; 
    attendance_percentage: number | null;
    days_present: number;
    days_absent: number;
    leaves_taken: number;
}

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: 'welcome123' });
    
    // Report Modal State
    const [reportModal, setReportModal] = useState<{isOpen: boolean, data: any | null, loading: boolean}>({ isOpen: false, data: null, loading: false });

    useEffect(() => { loadStudents(); }, []);

    const loadStudents = async () => {
        try { setStudents(await apiGet('/api/admin/students')); } catch { } finally { setLoading(false); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await apiPost('/api/admin/students', form);
        if (res.ok) { setShowModal(false); setForm({ name: '', email: '', phone: '', password: 'welcome123' }); loadStudents(); }
    };

    const openReport = async (studentId: string) => {
        setReportModal({ isOpen: true, data: null, loading: true });
        try {
            const data = await apiGet(`/api/admin/students/${studentId}/report`);
            setReportModal({ isOpen: true, data, loading: false });
        } catch (e) {
            setReportModal({ isOpen: true, data: null, loading: false });
        }
    };

    // Dynamically calculate average attendance
    const avgAttendance = students.length > 0 
        ? Math.round(students.reduce((acc, s) => acc + (s.attendance_percentage || 0), 0) / students.length)
        : 0;

    return (
        <div className="reveal-on-scroll active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: '8px' }}>Student Directory</h1>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Manage enrollments, IDs, and academic performance track.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="hover-lift"
                    style={{
                        padding: '12px 24px',
                        background: 'var(--primary)',
                        color: 'white',
                        borderRadius: '12px',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '14px',
                        boxShadow: 'var(--shadow-premium)',
                        cursor: 'pointer'
                    }}
                >
                    + Add New Student
                </button>
            </div>

            <div className="grid-4" style={{ marginBottom: '40px' }}>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Enrolled Students</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{students.length}</div>
                </div>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Active Learners</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{students.filter(s => s.is_active).length}</div>
                </div>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Avg. Attendance</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{avgAttendance}%</div>
                </div>
                <div className="glass-premium" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Security Events</div>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>0</div>
                </div>
            </div>

            <div className="glass-premium" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {loading ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}>
                        <div className="animate-spin" style={{ fontSize: '32px' }}>🔄</div>
                    </div>
                ) : students.length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎓</div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700 }}>No Student Records</h3>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '12px auto' }}>Add your first student to begin tracking their academic progress.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Academic Identity</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attendance</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Leaves</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Control</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-lift">
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{s.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.student_id || 'ID PENDING'} • {s.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span className={`badge ${s.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                                {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '10px', width: '60px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${s.attendance_percentage ?? 0}%`, height: '100%', background: (s.attendance_percentage ?? 0) < 75 ? '#ef4444' : 'var(--primary)' }} />
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: 700 }}>{s.attendance_percentage ?? 0}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 24px', fontWeight: 700, fontSize: '14px' }}>{s.leaves_taken}</td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <button onClick={() => openReport(s.id)} className="btn btn-sm btn-ghost">
                                                View Performance
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Student Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', letterSpacing: '-0.04em' }}>New Student Enrollment</h2>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name</label>
                                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Address</label>
                                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone</label>
                                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Access Key</label>
                                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 600 }} />
                                </div>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, fontStyle: 'italic' }}>* Student ID will be generated upon confirmation.</p>
                            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancel Enrollment</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirm Enrollment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Comprehensive Report Modal */}
            {reportModal.isOpen && (
                <div className="modal-overlay" onClick={() => setReportModal({ isOpen: false, data: null, loading: false })}>
                    <div className="modal" style={{ maxWidth: '850px', padding: '24px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: '2px' }}>Performance Analytics</h2>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Comprehensive academic and participation report.</p>
                            </div>
                            <button onClick={() => setReportModal({ isOpen: false, data: null, loading: false })} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                        
                        {reportModal.loading ? (
                            <div style={{ padding: '100px', textAlign: 'center' }}>
                                <div className="animate-spin" style={{ fontSize: '48px' }}>🔄</div>
                                <p style={{ marginTop: '20px', fontWeight: 700, color: 'var(--text-muted)' }}>Aggregating data points...</p>
                            </div>
                        ) : reportModal.data ? (
                            <div className="animate-in">
                                {/* Student Profile Overview */}
                                <div className="glass-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '16px 24px', borderRadius: '20px', marginBottom: '24px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>
                                            {reportModal.data.student.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{reportModal.data.student.name}</h3>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                <span style={{ color: 'var(--primary)' }}>{reportModal.data.student.student_id}</span> • {reportModal.data.student.email}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '32px', fontWeight: 600, color: reportModal.data.stats.attendance_percentage < 75 ? '#ef4444' : 'var(--primary)', lineHeight: 1 }}>
                                            {reportModal.data.stats.attendance_percentage}%
                                        </div>
                                        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.05em' }}>Attendance Health</div>
                                    </div>
                                </div>

                                {/* Metrics Summary */}
                                <div className="grid-4" style={{ gap: '12px', marginBottom: '24px' }}>
                                    {[
                                        { label: 'Present', val: reportModal.data.stats.days_present, color: 'var(--primary)' },
                                        { label: 'Absent', val: reportModal.data.stats.days_absent, color: '#ef4444' },
                                        { label: 'Leaves', val: reportModal.data.stats.leaves_taken, color: '#f59e0b' },
                                        { label: 'Learning Hours', val: `${Math.floor((reportModal.data.stats.total_punch_minutes || 0) / 60)}h`, color: '#0ea5e9' }
                                    ].map((m, i) => (
                                        <div key={i} className="glass-premium" style={{ padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: m.color }}>{m.val}</div>
                                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{m.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Enrolled Programs */}
                                {reportModal.data.registrations && reportModal.data.registrations.length > 0 && (
                                    <div style={{ marginBottom: '32px' }}>
                                        <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>Academia Enrollment</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                                            {reportModal.data.registrations.map((reg: any) => (
                                                <div key={reg.id} className="glass-premium hover-lift" style={{ padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{reg.course_name}</div>
                                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{reg.batch_name}</div>
                                                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', background: reg.status === 'ACTIVE' ? 'var(--primary-glow)' : 'var(--bg-tertiary)', color: reg.status === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)', border: '1px solid currentColor' }}>{reg.status}</span>
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: reg.fee_paid >= reg.fee_amount ? '#10b981' : 'var(--primary)' }}>₹{reg.fee_paid} Paid</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Timelines Section */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                    {/* Class Attendance */}
                                    <div className="glass-premium" style={{ borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                        <div style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class Participation Log</span>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Academic Year 2024-25</span>
                                        </div>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 10, borderBottom: '1px solid var(--border)' }}>
                                                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>SESSION DATE</th>
                                                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>COURSE BATCH</th>
                                                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>ATTENDANCE STATUS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reportModal.data.attendance_logs.map((log: any) => (
                                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 700 }}>{new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                            <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>{log.batch_name}</td>
                                                            <td style={{ padding: '14px 24px' }}>
                                                                <span style={{ fontSize: '10px', fontWeight: 700, color: log.status === 'PRESENT' || log.status === 'LATE' ? '#10b981' : '#ef4444' }}>● {log.status}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '80px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>
                                High latency or network timeout. Please verify API stability and try again.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
