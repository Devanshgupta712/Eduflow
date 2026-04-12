'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiFetch } from '@/lib/api';

const CATEGORIES = ['All', 'General', 'Curriculum', 'Technical', 'Faculty', 'Infrastructure', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
    General: '#6366f1',
    Curriculum: '#0ea5e9',
    Technical: '#f59e0b',
    Faculty: '#10b981',
    Infrastructure: '#ec4899',
    Other: '#64748b',
};

export default function SuggestionsPage() {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replyTarget, setReplyTarget] = useState<string | null>(null);
    const [viewImage, setViewImage] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterRead === 'read') params.set('is_read', 'true');
            if (filterRead === 'unread') params.set('is_read', 'false');
            if (filterCategory !== 'All') params.set('category', filterCategory);
            const data = await apiGet(`/api/admin/suggestions?${params}`);
            setSuggestions(data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filterCategory, filterRead]);

    const markRead = async (id: string) => {
        const token = localStorage.getItem('token');
        await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + `/api/admin/suggestions/${id}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
        });
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, is_read: true } : s));
    };

    const submitReply = async (id: string) => {
        const token = localStorage.getItem('token');
        await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + `/api/admin/suggestions/${id}/reply`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: replyText })
        });
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, admin_reply: replyText, is_read: true } : s));
        setReplyTarget(null);
        setReplyText('');
    };

    const unreadCount = suggestions.filter(s => !s.is_read).length;

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        💡 Suggestion Box
                        {unreadCount > 0 && (
                            <span style={{
                                marginLeft: '12px', fontSize: '14px', fontWeight: 700,
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', padding: '2px 10px', borderRadius: '20px'
                            }}>
                                {unreadCount} new
                            </span>
                        )}
                    </h1>
                    <p className="page-subtitle">Student suggestions and feedback from the suggestion box</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(['all', 'unread', 'read'] as const).map(f => (
                        <button
                            key={f}
                            className={`btn btn-sm ${filterRead === f ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setFilterRead(f)}
                            style={filterRead === f ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' } : {}}
                        >
                            {f === 'all' ? '📋 All' : f === 'unread' ? '🔵 Unread' : '✅ Read'}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {CATEGORIES.map(c => (
                        <button
                            key={c}
                            className={`btn btn-sm ${filterCategory === c ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setFilterCategory(c)}
                            style={filterCategory === c ? {
                                background: c === 'All' ? 'var(--primary)' : CATEGORY_COLORS[c],
                                border: 'none', color: '#fff'
                            } : {}}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid-3 mb-24">
                <div className="stat-card primary">
                    <div className="stat-icon primary">💡</div>
                    <div className="stat-info"><h3>Total</h3><div className="stat-value">{suggestions.length}</div></div>
                </div>
                <div className="stat-card accent">
                    <div className="stat-icon accent">🔵</div>
                    <div className="stat-info"><h3>Unread</h3><div className="stat-value">{unreadCount}</div></div>
                </div>
                <div className="stat-card success">
                    <div className="stat-icon success">✅</div>
                    <div className="stat-info"><h3>Read</h3><div className="stat-value">{suggestions.filter(s => s.is_read).length}</div></div>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="empty-state"><p>Loading suggestions...</p></div>
            ) : suggestions.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">💡</div>
                    <h3>No Suggestions Yet</h3>
                    <p className="text-muted">Students haven&apos;t submitted any suggestions matching your filters.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {suggestions.map(s => (
                        <div
                            key={s.id}
                            className="card"
                            style={{
                                borderLeft: `4px solid ${CATEGORY_COLORS[s.category] || 'var(--primary)'}`,
                                opacity: s.is_read ? 0.85 : 1,
                                transition: 'all 0.2s'
                            }}
                        >
                            {/* Card Header */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '12px' }}>
                                {/* Avatar */}
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '18px', fontWeight: 700, color: '#fff'
                                }}>
                                    {(s.student_name?.[0] || 'U').toUpperCase()}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '15px' }}>
                                            {s.student_name || 'User'}
                                        </span>
                                        {s.user_role && (
                                            <span style={{
                                                fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                                                background: s.user_role === 'STUDENT' ? 'rgba(56,189,248,0.1)' : 'rgba(167,139,250,0.1)',
                                                color: s.user_role === 'STUDENT' ? 'var(--info)' : 'var(--primary)'
                                            }}>
                                                {s.user_role}
                                            </span>
                                        )}
                                        {s.student_sid && (
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                {s.student_sid}
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                                            background: (CATEGORY_COLORS[s.category] || '#6366f1') + '20',
                                            color: CATEGORY_COLORS[s.category] || '#6366f1'
                                        }}>
                                            {s.category}
                                        </span>
                                        {!s.is_read && (
                                            <span style={{
                                                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                                                background: 'rgba(99,102,241,0.15)', color: '#6366f1'
                                            }}>NEW</span>
                                        )}
                                        {(s.screenshot_base64 || s.has_screenshot) && (
                                            <span
                                                title="Has attached screenshot — click View to see it"
                                                onClick={() => {
                                                    if (s.screenshot_base64) setViewImage(s.screenshot_base64);
                                                    else {
                                                        setExpanded(s.id);
                                                        if (!s.is_read) markRead(s.id);
                                                    }
                                                }}
                                                style={{
                                                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                                                    background: 'rgba(16,185,129,0.1)', color: '#059669',
                                                    cursor: 'pointer', border: '1px solid rgba(16,185,129,0.3)',
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                📷 Screenshot
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {s.created_at ? new Date(s.created_at).toLocaleString('en-IN', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        }) : ''}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    {!s.is_read && (
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => markRead(s.id)}
                                            title="Mark as read"
                                        >✅ Mark Read</button>
                                    )}
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => {
                                            setExpanded(expanded === s.id ? null : s.id);
                                            if (!s.is_read) markRead(s.id);
                                        }}
                                    >
                                        {expanded === s.id ? '▲ Collapse' : '▼ View'}
                                    </button>
                                </div>
                            </div>

                            {/* Message preview */}
                            <div style={{
                                fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6,
                                display: expanded === s.id ? 'block' : '-webkit-box',
                                WebkitLineClamp: expanded === s.id ? undefined : 2,
                                WebkitBoxOrient: expanded === s.id ? undefined : 'vertical' as any,
                                overflow: expanded === s.id ? 'visible' : 'hidden',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {s.message}
                            </div>
                            
                            {/* Attachment indicator / Viewer */}
                            {expanded === s.id && s.screenshot_base64 && (
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>📎 Attached Screenshot</div>
                                    <img
                                        src={s.screenshot_base64}
                                        alt="Suggestion Screenshot"
                                        style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                        onClick={() => setViewImage(s.screenshot_base64)}
                                        title="Click to view full size"
                                    />
                                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>Click image to view full size</div>
                                </div>
                            )}

                            {/* Expanded: admin reply */}
                            {expanded === s.id && (
                                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                    {s.admin_reply && (
                                        <div style={{
                                            padding: '12px 16px', borderRadius: '12px',
                                            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', marginBottom: '6px' }}>
                                                👨‍💼 ADMIN REPLY
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                                {s.admin_reply}
                                            </div>
                                        </div>
                                    )}

                                    {replyTarget === s.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <textarea
                                                className="form-textarea"
                                                rows={3}
                                                placeholder="Write your reply..."
                                                value={replyText}
                                                onChange={e => setReplyText(e.target.value)}
                                                style={{ resize: 'vertical' }}
                                                autoFocus
                                            />
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-sm btn-ghost" onClick={() => { setReplyTarget(null); setReplyText(''); }}>Cancel</button>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => submitReply(s.id)}
                                                    disabled={!replyText.trim()}
                                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                                                >
                                                    Send Reply
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => { setReplyTarget(s.id); setReplyText(s.admin_reply || ''); }}
                                        >
                                            💬 {s.admin_reply ? 'Edit Reply' : 'Add Reply'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Image Preview Modal */}
            {viewImage && (
                <div 
                    className="modal-overlay" 
                    onClick={() => setViewImage(null)}
                    style={{ zIndex: 4000, background: 'rgba(0,0,0,0.85)', padding: '40px' }}
                >
                    <div style={{ position: 'absolute', top: '20px', right: '30px', color: '#fff', fontSize: '30px', cursor: 'pointer', fontWeight: 700 }}>✕</div>
                    <img 
                        src={viewImage} 
                        alt="Suggestion Attachment" 
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
