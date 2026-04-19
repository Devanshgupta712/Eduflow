'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';

interface TaskItem {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    is_overdue: boolean;
    assigned_by: string | null;
    due_date: string | null;
    pdf_url: string | null;
    created_at: string;
    has_assessment: boolean;
    time_limit: number;
    // Student-specific fields
    attempt_count?: number;
    is_completed?: boolean;
    score?: number | null;
}

const priorityColors: Record<string, string> = {
    HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981'
};
const priorityBg: Record<string, string> = {
    HIGH: 'hsla(0,85%,60%,0.1)', MEDIUM: 'hsla(38,95%,55%,0.1)', LOW: 'hsla(155,75%,45%,0.1)'
};
const statusColors: Record<string, string> = {
    PENDING: '#6366f1', IN_PROGRESS: '#f59e0b', COMPLETED: '#10b981', CANCELLED: '#6b7280'
};
const statusBg: Record<string, string> = {
    PENDING: 'hsla(239,80%,65%,0.1)', IN_PROGRESS: 'hsla(38,95%,55%,0.1)',
    COMPLETED: 'hsla(155,75%,45%,0.1)', CANCELLED: 'hsla(220,15%,50%,0.1)'
};

export default function StudentTasksPage() {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
    const router = useRouter();

    useEffect(() => { loadTasks(); }, []);

    const loadTasks = async () => {
        try {
            setTasks(await apiGet('/api/training/tasks'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const filtered = filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter);

    const formatDate = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const countByStatus = (s: string) => tasks.filter(t => t.status === s).length;
    const overdue = tasks.filter(t => t.is_overdue).length;

    return (
        <div style={{ padding: '0', maxWidth: '950px', margin: '0 auto' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>My Tasks</h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                        View and track all tasks assigned to you
                    </p>
                </div>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '28px' }} className="tasks-stats-grid">
                {[
                    { label: 'Total', value: tasks.length, color: '#6366f1', bg: 'hsla(239,80%,65%,0.1)' },
                    { label: 'Completed', value: tasks.filter(t => t.is_completed).length, color: '#10b981', bg: 'hsla(155,75%,45%,0.1)' },
                    { label: 'Pending', value: tasks.filter(t => !t.is_completed).length, color: '#f59e0b', bg: 'hsla(38,95%,55%,0.1)' },
                    { label: 'Overdue', value: overdue, color: '#ef4444', bg: 'hsla(0,85%,60%,0.1)' },
                ].map(stat => (
                    <div key={stat.label} className="card" style={{ padding: '16px 20px', background: stat.bg, border: `1px solid ${stat.color}22`, borderRadius: '14px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Filter tabs ── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map(s => (
                    <button key={s}
                        onClick={() => setFilter(s)}
                        style={{
                            padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                            border: `1.5px solid ${filter === s ? 'var(--primary)' : 'var(--border)'}`,
                            background: filter === s ? 'var(--primary-glow)' : 'transparent',
                            color: filter === s ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                        {s === 'ALL' ? 'All' : s.replace('_', ' ')}
                        {s !== 'ALL' && <span style={{ marginLeft: '6px', fontSize: '11px' }}>({countByStatus(s)})</span>}
                    </button>
                ))}
            </div>

            {/* ── Task List ── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading tasks…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                    <h3 style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No tasks found</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Your trainer hasn't assigned any tasks yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filtered.map(task => (
                        <div key={task.id} className="card hover-lift" style={{
                            padding: '20px 24px',
                            borderRadius: '16px',
                            border: `1px solid ${task.is_overdue ? '#ef444433' : 'var(--border)'}`,
                            background: task.is_overdue ? 'hsla(0,85%,60%,0.04)' : 'var(--bg-secondary)',
                            transition: 'all 0.2s', cursor: 'pointer'
                        }} onClick={() => router.push(`/student/tasks/${task.id}`)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{task.title}</h3>
                                        {task.has_assessment && (
                                            <span style={{ fontSize: '11px', background: 'hsla(239,80%,65%,0.15)', color: '#6366f1', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>📝 MCQ Assessment</span>
                                        )}
                                        {task.time_limit > 0 && (
                                            <span style={{ fontSize: '11px', background: 'hsla(38,95%,55%,0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>⏱️ {task.time_limit} min</span>
                                        )}
                                        {task.is_overdue && (
                                            <span style={{ fontSize: '11px', background: 'hsla(0,85%,60%,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>⚠️ Overdue</span>
                                        )}
                                        {task.attempt_count !== undefined && task.attempt_count > 1 && (
                                            <span style={{ fontSize: '11px', background: 'hsla(270,70%,60%,0.15)', color: '#7c3aed', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                                🔄 {task.attempt_count} Attempts
                                            </span>
                                        )}
                                    </div>
                                    {task.description && (
                                        <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {task.description}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {/* Priority */}
                                        <span style={{ fontSize: '12px', background: priorityBg[task.priority] || '#eee', color: priorityColors[task.priority] || '#666', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>
                                            {task.priority}
                                        </span>
                                        {/* Status */}
                                        <span style={{ fontSize: '12px', background: task.is_completed ? 'hsla(155,75%,45%,0.1)' : statusBg[task.status] || '#eee', color: task.is_completed ? '#10b981' : statusColors[task.status] || '#666', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>
                                            {task.is_completed ? '✅ COMPLETED' : task.status.replace('_', ' ')}
                                        </span>
                                        {/* Score */}
                                        {task.is_completed && task.score !== null && task.score !== undefined && (
                                            <span style={{ fontSize: '12px', background: 'hsla(239,80%,65%,0.1)', color: '#6366f1', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>
                                                🎯 Score: {task.score}%
                                            </span>
                                        )}
                                        {/* Due date */}
                                        {task.due_date && (
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                📅 Due: <strong style={{ color: task.is_overdue ? '#ef4444' : 'var(--text-primary)' }}>{formatDate(task.due_date)}</strong>
                                            </span>
                                        )}
                                        {task.assigned_by && (
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                👤 By: <strong>{task.assigned_by}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                                    {task.pdf_url && (
                                        <a href={task.pdf_url} target="_blank" rel="noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            style={{ fontSize: '12px', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '5px 12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 }}>
                                            📄 View PDF
                                        </a>
                                    )}
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {new Date(task.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
