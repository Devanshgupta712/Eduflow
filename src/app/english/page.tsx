'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiGet, getStoredUser } from '@/lib/api';

const LEVEL_CONFIG: Record<string, { color: string; label: string; minXP: number; maxXP: number }> = {
    BEGINNER: { color: '#9ca3af', label: 'Beginner', minXP: 0, maxXP: 100 },
    CONVERSATIONAL: { color: '#3b82f6', label: 'Conversational', minXP: 100, maxXP: 500 },
    CONFIDENT: { color: '#8b5cf6', label: 'Confident', minXP: 500, maxXP: 1500 },
    FLUENT: { color: '#10b981', label: 'Fluent', minXP: 1500, maxXP: 3000 },
};

export default function EnglishDashboardPage() {
    const [progress, setProgress] = useState<any>(null);
    const [recentSessions, setRecentSessions] = useState<any[]>([]);
    const [badges, setBadges] = useState<any[]>([]);
    const [weeklyData, setWeeklyData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiGet('/api/english/progress'),
            apiGet('/api/english/progress/weekly')
        ]).then(([progData, weekData]) => {
            setProgress(progData.progress);
            setRecentSessions(progData.recent_sessions || []);
            setBadges(progData.badges || []);
            setWeeklyData(weekData.weekly_data || []);
        }).catch(() => {
            setProgress({
                total_practice_minutes: 0, current_streak: 0, longest_streak: 0,
                xp_total: 0, level: 'BEGINNER', avg_wpm: 0, avg_filler_count: 0,
                avg_grammar_accuracy: 0, avg_vocabulary_score: 0, confidence_score: 0,
                total_sessions: 0, avg_hesitation_time: 0,
            });
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="animate-in" style={{ padding: '60px', textAlign: 'center' }}><div className="spinner" /><p>Loading your fluency data...</p></div>;

    const p = progress || {};
    const level = LEVEL_CONFIG[p.level] || LEVEL_CONFIG.BEGINNER;
    const xpInLevel = p.xp_total - level.minXP;
    const xpRange = level.maxXP - level.minXP;
    const xpPercent = Math.min(100, Math.max(0, (xpInLevel / xpRange) * 100));

    const modules = [
        { title: 'Live AI Call', desc: 'Real-time voice conversation', icon: '📞', href: '/english/live-call', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
        { title: 'Speaking Practice', desc: 'Read Aloud, 1-Min Talk', icon: '🎙️', href: '/english/practice', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
        { title: 'AI Conversation', desc: 'Chat with AI in 5 modes', icon: '🤖', href: '/english/conversation', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
        { title: 'Roleplay', desc: 'Practice real-world scenarios', icon: '🎭', href: '/english/roleplay', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
        { title: 'Think-in-English', desc: 'Drills to stop mental translation', icon: '🧠', href: '/english/drills', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #be185d)' },
        { title: 'Leaderboard', desc: 'See how you rank in your batch', icon: '🏆', href: '/english/leaderboard', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
    ];

    const exerciseLabels: Record<string, string> = {
        READ_ALOUD: '📖 Read Aloud', ONE_MINUTE_TALK: '🎤 1-Min Talk', TONGUE_TWISTER: '👅 Tongue Twister',
        PICTURE_DESCRIPTION: '🖼️ Picture', STORY_CONTINUATION: '📝 Story', OPINION_BUILDER: '💬 Opinion',
        WORD_ASSOCIATION: '🔗 Word Assoc', RAPID_FIRE: '⚡ Rapid Fire', SHADOWING: '🗣️ Shadowing',
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        🗣️ English Fluency Trainer
                    </h1>
                    <p className="page-subtitle">Practice speaking every day. Become fluent, not just correct.</p>
                </div>
            </div>

            {/* ── Streak + Level Hero ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                {/* Streak Card */}
                <div className="card" style={{ textAlign: 'center', padding: '28px', background: p.current_streak > 0 ? 'linear-gradient(135deg, #fff7ed, #ffedd5)' : undefined, border: p.current_streak >= 7 ? '2px solid #f59e0b' : undefined }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔥</div>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.current_streak}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Day Streak</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Best: {p.longest_streak} days</div>
                </div>

                {/* XP + Level Card */}
                <div className="card" style={{ textAlign: 'center', padding: '28px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>⭐</div>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.xp_total}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total XP</div>
                    <div style={{ marginTop: '12px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '99px', background: level.color, color: '#fff', fontSize: '12px', fontWeight: 700 }}>{level.label}</span>
                    </div>
                    <div style={{ marginTop: '8px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${xpPercent}%`, background: level.color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{xpInLevel}/{xpRange} XP to next level</div>
                </div>

                {/* Sessions Card */}
                <div className="card" style={{ textAlign: 'center', padding: '28px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📊</div>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.total_sessions}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sessions Done</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{p.total_practice_minutes} min total practice</div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid-4" style={{ marginBottom: '32px' }}>
                <div className="stat-card primary"><div className="stat-icon primary">⚡</div><div className="stat-info"><h3>Speed (WPM)</h3><div className="stat-value">{progress.avg_wpm || 0}</div></div></div>
                <div className="stat-card success"><div className="stat-icon success">🛡️</div><div className="stat-info"><h3>Confidence</h3><div className="stat-value">{progress.confidence_score || 0}/10</div></div></div>
                <div className="stat-card accent"><div className="stat-icon accent">⏱️</div><div className="stat-info"><h3>Avg Hesitation</h3><div className="stat-value">{progress.avg_hesitation_time || 0}s</div></div></div>
                <div className="stat-card danger"><div className="stat-icon danger">⏱️</div><div className="stat-info"><h3>Total Time</h3><div className="stat-value">{progress.total_practice_minutes || 0} min</div></div></div>
            </div>

            {/* Weekly Activity */}
            {weeklyData.length > 0 && (
                <div className="card" style={{ marginBottom: '32px', padding: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>📈 Weekly Activity</h2>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '160px', marginTop: '20px' }}>
                        {weeklyData.map((day, idx) => {
                            const maxMins = Math.max(...weeklyData.map(d => d.minutes), 10);
                            const heightPercent = Math.max((day.minutes / maxMins) * 100, 5);
                            return (
                                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{day.minutes}m</div>
                                    <div style={{ 
                                        width: '100%', height: `${heightPercent}%`, 
                                        background: day.minutes > 0 ? 'var(--primary)' : 'var(--bg-tertiary)', 
                                        borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease' 
                                    }} />
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Fluency Scorecard ── */}
            <div className="card" style={{ marginBottom: '28px', padding: '28px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📈 Fluency Scorecard</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                    {[
                        { label: 'Speaking Speed', value: `${p.avg_wpm} WPM`, pct: Math.min(100, (p.avg_wpm / 160) * 100), color: '#3b82f6' },
                        { label: 'Filler Words', value: `${p.avg_filler_count}/min`, pct: Math.max(0, 100 - p.avg_filler_count * 20), color: '#f59e0b' },
                        { label: 'Grammar', value: `${p.avg_grammar_accuracy}%`, pct: p.avg_grammar_accuracy, color: '#10b981' },
                        { label: 'Vocabulary', value: `${p.avg_vocabulary_score}/10`, pct: p.avg_vocabulary_score * 10, color: '#8b5cf6' },
                        { label: 'Confidence', value: `${p.confidence_score}/10`, pct: p.confidence_score * 10, color: '#ef4444' },
                    ].map((m) => (
                        <div key={m.label} style={{ textAlign: 'center' }}>
                            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 8px' }}>
                                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-tertiary)" strokeWidth="3" />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={m.color} strokeWidth="3" strokeDasharray={`${m.pct}, 100`} strokeLinecap="round" />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</div>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Quick Start Modules ── */}
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>🚀 Start Practicing</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {modules.map((mod) => (
                    <Link key={mod.href} href={mod.href} style={{ textDecoration: 'none' }}>
                        <div className="card" style={{ cursor: 'pointer', padding: '24px', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '80px', opacity: 0.06 }}>{mod.icon}</div>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: mod.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '14px' }}>{mod.icon}</div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{mod.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{mod.desc}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* ── Badges ── */}
            {badges.length > 0 && (
                <div className="card" style={{ marginBottom: '28px', padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>🏅 Your Badges</h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {badges.map((b: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '99px', background: 'var(--bg-tertiary)', fontSize: '13px', fontWeight: 600 }}>
                                <span>{b.icon}</span>{b.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Recent Sessions ── */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>📋 Recent Practice</h3>
                {recentSessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
                        <p style={{ fontWeight: 600 }}>No practice sessions yet</p>
                        <p style={{ fontSize: '13px' }}>Start your first exercise to begin tracking progress!</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead><tr><th>Exercise</th><th>Fluency</th><th>WPM</th><th>XP</th><th>Date</th></tr></thead>
                            <tbody>
                                {recentSessions.map((s: any) => (
                                    <tr key={s.id}>
                                        <td><strong>{exerciseLabels[s.exercise_type] || s.exercise_type}</strong></td>
                                        <td><span className={`badge ${s.fluency_score >= 7 ? 'badge-success' : s.fluency_score >= 5 ? 'badge-warning' : 'badge-danger'}`}>{s.fluency_score}/10</span></td>
                                        <td>{s.wpm}</td>
                                        <td style={{ color: '#10b981', fontWeight: 700 }}>+{s.xp_earned} XP</td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}</td>
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
