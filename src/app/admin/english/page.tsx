'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';

export default function AdminEnglishReportsPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Batch Filtering
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>('');

    // Detailed Student Modal
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentDetails, setStudentDetails] = useState<any>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        // Fetch Batches for dropdown
        apiGet('/api/admin/batches').then(res => setBatches(res || [])).catch(() => {});
        fetchReports('');
    }, []);

    const fetchReports = (batch_id: string) => {
        setLoading(true);
        const url = batch_id ? `/api/english/admin/reports?batch_id=${batch_id}` : `/api/english/admin/reports`;
        apiGet(url)
            .then(data => setReports(data.reports || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    const handleBatchChange = (e: any) => {
        const val = e.target.value;
        setSelectedBatch(val);
        fetchReports(val);
    };

    const openStudentDetails = (student_id: string) => {
        setSelectedStudentId(student_id);
        setDetailsLoading(true);
        apiGet(`/api/english/admin/reports/${student_id}`)
            .then(data => setStudentDetails(data))
            .catch(() => {})
            .finally(() => setDetailsLoading(false));
    };

    const closeDetails = () => {
        setSelectedStudentId(null);
        setStudentDetails(null);
    };

    const formatTime = (minutes: number) => {
        if (minutes < 60) return `${minutes}m`;
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📊 English Fluency Reports</h1>
                    <p className="page-subtitle">Monitor trainee progress, confidence, and practice time</p>
                </div>
                <div>
                    <select className="input" value={selectedBatch} onChange={handleBatchChange} style={{ minWidth: '200px' }}>
                        <option value="">All Batches</option>
                        {batches.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Loading reports...</div>
                ) : reports.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>No practice data available yet.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Trainee</th>
                                    <th>Fluency Level</th>
                                    <th style={{ textAlign: 'center' }}>Total Time</th>
                                    <th style={{ textAlign: 'center' }}>Sessions</th>
                                    <th style={{ textAlign: 'center' }}>Avg Confidence</th>
                                    <th style={{ textAlign: 'center' }}>Avg Hesitation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((r, idx) => (
                                    <tr key={idx} onClick={() => openStudentDetails(r.user_id)} style={{ cursor: 'pointer' }} className="hover-row">
                                        <td>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.email}</div>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                                                background: r.level === 'FLUENT' ? '#dcfce7' : r.level === 'CONFIDENT' ? '#f3e8ff' : r.level === 'CONVERSATIONAL' ? '#dbeafe' : 'var(--bg-tertiary)',
                                                color: r.level === 'FLUENT' ? '#166534' : r.level === 'CONFIDENT' ? '#6b21a8' : r.level === 'CONVERSATIONAL' ? '#1e40af' : 'var(--text-secondary)'
                                            }}>
                                                {r.level} ({r.xp_total} XP)
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatTime(r.total_practice_minutes)}</td>
                                        <td style={{ textAlign: 'center' }}>{r.total_sessions}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ 
                                                fontWeight: 700,
                                                color: r.confidence_score >= 8 ? '#10b981' : r.confidence_score >= 6 ? '#f59e0b' : '#ef4444'
                                            }}>
                                                {r.confidence_score}/10
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ 
                                                fontWeight: 700,
                                                color: r.avg_hesitation_time <= 2 ? '#10b981' : r.avg_hesitation_time <= 5 ? '#f59e0b' : '#ef4444'
                                            }}>
                                                {r.avg_hesitation_time}s
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detailed Student Modal */}
            {selectedStudentId && (
                <div className="modal-overlay" onClick={closeDetails}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                        <div className="modal-header">
                            <h2>{studentDetails?.student?.name || 'Loading...'} — Progress Report</h2>
                            <button className="btn btn-secondary" onClick={closeDetails}>Close</button>
                        </div>
                        
                        {detailsLoading ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>Loading details...</div>
                        ) : studentDetails ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Highlights */}
                                <div className="grid-3">
                                    <div className="stat-card primary"><div className="stat-icon primary">⏱️</div><div className="stat-info"><h3>Total Time</h3><div className="stat-value">{formatTime(studentDetails.progress.total_practice_minutes)}</div></div></div>
                                    <div className="stat-card success"><div className="stat-icon success">🛡️</div><div className="stat-info"><h3>Avg Confidence</h3><div className="stat-value">{studentDetails.progress.confidence_score}/10</div></div></div>
                                    <div className="stat-card accent"><div className="stat-icon accent">🔥</div><div className="stat-info"><h3>Current Streak</h3><div className="stat-value">{studentDetails.progress.streak} Days</div></div></div>
                                </div>

                                {/* Breakdown */}
                                <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Time Spent per Module</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                                        {Object.entries(studentDetails.module_breakdown || {}).map(([mod, mins]) => (
                                            <div key={mod} style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{mod.replace('_', ' ')}</div>
                                                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{mins as number} min</div>
                                            </div>
                                        ))}
                                        {Object.keys(studentDetails.module_breakdown || {}).length === 0 && (
                                            <div style={{ color: 'var(--text-muted)' }}>No module data available.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Recent Sessions</h3>
                                    {studentDetails.recent_sessions?.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)' }}>No recent sessions.</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Module</th>
                                                        <th>Duration</th>
                                                        <th>Fluency Score</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {studentDetails.recent_sessions.map((s: any, i: number) => (
                                                        <tr key={i}>
                                                            <td>{new Date(s.date).toLocaleString()}</td>
                                                            <td style={{ fontWeight: 600 }}>{s.type}</td>
                                                            <td>{s.duration_min} min</td>
                                                            <td>{s.score}/10</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>Error loading data.</div>
                        )}
                    </div>
                </div>
            )}
            
            <style>{`
                .hover-row:hover {
                    background: var(--bg-secondary) !important;
                }
            `}</style>
        </div>
    );
}
