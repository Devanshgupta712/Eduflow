'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';

export default function AdminEnglishReportsPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet('/api/english/admin/reports')
            .then(data => setReports(data.reports || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

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
                                    <tr key={idx}>
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
        </div>
    );
}
