'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet('/api/auth/notifications')
            .then(setNotifications)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const markAllRead = async () => {
        // Optimistic update
        setNotifications(notifications.map(n => ({ ...n, read: true })));
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com'}/api/auth/notifications/read-all`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
        } catch (e) { console.error(e); }
    };

    const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

    return (
        <div className="animate-in" style={{ position: 'relative' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notifications</h1>
                    <p className="page-subtitle">Your latest updates</p>
                </div>
                {notifications.some(n => !n.read) && (
                    <button className="btn btn-ghost btn-sm" onClick={markAllRead}>
                        Mark all as read
                    </button>
                )}
            </div>

            <div className="glass-premium reveal-on-scroll active">
                {loading ? (
                    <p>Loading notifications...</p>
                ) : notifications.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔕</div>
                        <h3>No Notifications</h3>
                        <p className="text-sm text-muted">You are all caught up!</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Title</th>
                                    <th>Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notifications.map(n => (
                                    <tr
                                        key={n.id}
                                        onClick={() => {
                                            setSelectedNotification(n);
                                            if (!n.read) {
                                                const newNotifs = [...notifications];
                                                const idx = newNotifs.findIndex(x => x.id === n.id);
                                                newNotifs[idx].read = true;
                                                setNotifications(newNotifs);
                                                
                                                fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com'}/api/auth/notifications/${n.id}/read`, {
                                                    method: 'PUT',
                                                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                                }).catch(() => {});
                                            }
                                        }}
                                        style={{
                                            opacity: n.read ? 0.7 : 1,
                                            background: n.read ? 'transparent' : 'rgba(0, 102, 255, 0.05)',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = n.read ? 'rgba(255,255,255,0.02)' : 'rgba(0, 102, 255, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(0, 102, 255, 0.05)'}
                                    >
                                        <td>
                                            {n.read ? (
                                                <span className="text-muted" style={{ fontSize: '18px' }}>✓</span>
                                            ) : (
                                                <span style={{ color: '#4ade80', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                                                    New
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                                            {new Date(n.created_at).toLocaleDateString()}
                                            <br />
                                            <span style={{ fontSize: '11px' }}>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</td>
                                        <td className="text-muted" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedNotification && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }} onClick={() => setSelectedNotification(null)}>
                    <div
                        style={{
                            background: '#1e293b', width: '90%', maxWidth: '500px',
                            borderRadius: '16px', padding: '24px', position: 'relative',
                            border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedNotification(null)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
                        >×</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0, 102, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🔔</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{selectedNotification.title}</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {new Date(selectedNotification.created_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {selectedNotification.message}
                        </div>
                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={() => setSelectedNotification(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
