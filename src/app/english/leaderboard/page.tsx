'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet('/api/english/leaderboard')
            .then(data => setLeaderboard(data.leaderboard || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🏆 Fluency Leaderboard</h1>
                    <p className="page-subtitle">See who's practicing the most in your batch</p>
                </div>
                <Link href="/english" className="btn btn-secondary">← Back</Link>
            </div>

            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Loading leaderboard...</div>
                ) : leaderboard.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏆</div>
                        <p>No practice data yet. Be the first!</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                                    <th>Trainee</th>
                                    <th>Level</th>
                                    <th style={{ textAlign: 'center' }}>Streak</th>
                                    <th style={{ textAlign: 'right' }}>Total XP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((user, idx) => (
                                    <tr key={idx} style={idx < 3 ? { background: 'var(--primary-glow)' } : {}}>
                                        <td style={{ textAlign: 'center' }}>
                                            {idx === 0 ? <span style={{ fontSize: '24px' }}>🥇</span> :
                                             idx === 1 ? <span style={{ fontSize: '24px' }}>🥈</span> :
                                             idx === 2 ? <span style={{ fontSize: '24px' }}>🥉</span> :
                                             <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.sessions} sessions completed</div>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                                                background: user.level === 'FLUENT' ? '#dcfce7' : user.level === 'CONFIDENT' ? '#f3e8ff' : user.level === 'CONVERSATIONAL' ? '#dbeafe' : 'var(--bg-tertiary)',
                                                color: user.level === 'FLUENT' ? '#166534' : user.level === 'CONFIDENT' ? '#6b21a8' : user.level === 'CONVERSATIONAL' ? '#1e40af' : 'var(--text-secondary)'
                                            }}>
                                                {user.level}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {user.streak > 0 ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#d97706' }}>
                                                    🔥 {user.streak}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                                            {user.xp} XP
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
