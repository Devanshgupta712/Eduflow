'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { getStoredUser, clearToken, setStoredUser, apiGet, apiPost } from '@/lib/api';
import ChatbotFAQ from './ChatbotFAQ';
import { useTheme } from '@/components/ThemeProvider';
import Student360Report from './Student360Report';
import SuggestionBox from './SuggestionBox';
import { useSocket } from '@/hooks/useSocket';
import AstraAvatar from './AstraAvatar';


const PUBLIC_PATHS = [
    '/', '/login', '/register', '/unauthorized',
    '/login/admin', '/login/trainer', '/login/marketing', '/login/student',
    '/about', '/features', '/courses', '/contact'
];

// Added comment to ensure git detects change for re-push


export default function AppLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const [user, setUser] = useState<any>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [saturdayStatus, setSaturdayStatus] = useState<any>({ is_saturday: false, has_submitted: false, should_block: false, submitted_count: 0, total_required: 0, is_blocked: false });


    // WebSocket Integration
    // For simplicity, we'll try to join a batch room if the user is a trainer or student
    const batchId = user?.batch_id || (user?.role === 'STUDENT' ? 'GLOBAL_STUDENT' : 'GLOBAL_TRAINER');

    const handleViolation = (data: any) => {
        setNotifications(prev => [{
            id: `ws-${Date.now()}`,
            title: `🚨 Violation: ${data.student_name}`,
            message: `${data.type} detected during assessment.`,
            read: false,
            created_at: data.timestamp,
            link: `/training/reports?student_id=${data.student_id}`
        }, ...prev]);
        
        // Browser Notification fallback
        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
            new window.Notification(`Violation: ${data.student_name}`, { body: `${data.type} detected.` });
        }
    };

    const handleUnlock = (data: any) => {
        setNotifications(prev => [{
            id: `ws-${Date.now()}`,
            title: `✨ New ${data.type} Live!`,
            message: `'${data.title}' is now available to start.`,
            read: false,
            created_at: new Date().toISOString(),
            link: data.type === 'TASK' ? '/student/tasks' : '/student/assessments'
        }, ...prev]);
    };

    const handleDirectNotification = (data: any) => {
        setNotifications(prev => [{
            id: data.id || `ws-notif-${Date.now()}`,
            title: data.title,
            message: data.message,
            read: false,
            created_at: data.created_at || new Date().toISOString(),
            type: data.type
        }, ...prev]);

        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
            new window.Notification(data.title, { body: data.message });
        }
    };

    // Initialize Socket at top level
    useSocket(
        user?.id ? batchId : null, 
        user?.id ? user.id : null,
        handleViolation, 
        handleUnlock,
        handleDirectNotification
    );


    // Scroll reveal observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => entries.forEach(e => { if (e.isIntersecting) (e.target as HTMLElement).classList.add('active'); }),
            { threshold: 0.08 }
        );
        const els = document.querySelectorAll('.reveal-on-scroll');
        els.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [pathname]);

    // Convert VAPID base64url key to Uint8Array (REQUIRED for mobile push)
    const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const registerPushWorker = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('[Push] Service Worker or PushManager not supported');
            return;
        }

        try {
            // Register the service worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('[Push] Service Worker registered', registration.scope);

            // Wait for the service worker to be ready (CRITICAL for mobile)
            await navigator.serviceWorker.ready;
            console.log('[Push] Service Worker is ready');

            // Request notification permission
            const permission = await Notification.requestPermission();
            console.log('[Push] Permission:', permission);

            if (permission !== 'granted') {
                console.warn('[Push] Notification permission denied');
                return;
            }

            // Check for existing subscription first
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // Convert VAPID key to Uint8Array (mobile browsers REQUIRE this format)
                const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!vapidKey) {
                    console.error('[Push] VAPID public key not configured');
                    return;
                }
                const applicationServerKey = urlBase64ToUint8Array(vapidKey);

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey.buffer as ArrayBuffer
                });
                console.log('[Push] New subscription created');
            } else {
                console.log('[Push] Using existing subscription');
            }

            // Send subscription to backend with device info
            const subJSON = subscription.toJSON();
            await apiPost('/api/auth/subscribe', {
                ...subJSON,
                device_type: /Android/i.test(navigator.userAgent) ? 'Android' :
                             /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' :
                             /Windows/i.test(navigator.userAgent) ? 'Windows' : 'Unknown'
            });
            console.log('[Push] Subscription sent to backend');
        } catch (err) {
            console.error('[Push] Registration failed:', err);
        }
    };

    useEffect(() => {
        const stored = getStoredUser();
        if (stored) {
            setUser(stored);
            
            // Ask for notifications if not on public paths
            if (!PUBLIC_PATHS.includes(pathname)) {
                registerPushWorker();
            }

            // Sync user data from server to catch permission changes (e.g. Resume Builder)
            apiGet('/api/auth/me')
                .then(latestUser => {
                    setUser(latestUser);
                    setStoredUser(latestUser);
                })
                .catch(() => { });

            apiGet('/api/auth/notifications')
                .then(data => {
                    if (Array.isArray(data)) setNotifications(data);
                })
                .catch(() => { });

            // Check Saturday Feedback Status
            apiGet('/api/sessions/feedback/saturday-status')
                .then(setSaturdayStatus)
                .catch(() => {});
        } else if (!PUBLIC_PATHS.includes(pathname)) {
            router.push('/');
        }
    }, [pathname, router]);

    // Keep-alive ping to prevent Render free-tier cold starts (every 4 minutes)
    useEffect(() => {
        const ping = () => fetch('/api/health', { method: 'GET' }).catch(() => {});
        ping(); // ping immediately on load
        const interval = setInterval(ping, 4 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Global Search Logic
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await apiGet(`/api/admin/search/global?q=${encodeURIComponent(searchQuery)}`);
                setSearchResults(results);
                setShowSearchResults(true);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleResultClick = (result: any) => {
        setShowSearchResults(false);
        setSearchQuery('');
        
        if (result.type === 'STUDENT') {
            setSelectedStudentId(result.id);
        } else if (result.type === 'COURSE') {
            router.push(`/courses/${result.id}`);
        } else if (result.type === 'BATCH') {
            router.push(`/admin/batches?id=${result.id}`);
        } else if (result.type === 'ASSIGNMENT') {
            if (user?.role === 'STUDENT') {
                router.push(`/student/assessments?start=${result.id}`);
            } else {
                router.push(`/training/assignments?id=${result.id}`);
            }
        } else if (result.type === 'LEAD') {
            router.push(`/marketing/leads?id=${result.id}`);
        }
    };

    if (PUBLIC_PATHS.includes(pathname)) {
        return (
            <>
                {children}
                <ChatbotFAQ />
            </>
        );
    }

    if (!user) {
        return null;
    }


    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="app-layout" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar userRole={user.role} userName={user.name} userEmail={user.email} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <main className="main-content">
                <header className="app-header" style={{ 
                    padding: '12px 16px', 
                    background: '#fff',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    position: 'sticky',
                    top: '0',
                    zIndex: 900,
                    borderBottom: '1px solid var(--border)',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                        <button 
                            className="hover-lift" 
                            onClick={() => setSidebarOpen(true)} 
                            style={{ 
                                display: 'none', 
                                background: 'var(--bg-tertiary)', 
                                border: 'none', 
                                padding: '8px', 
                                borderRadius: '10px', 
                                cursor: 'pointer',
                                color: 'var(--text-primary)'
                            }}
                        >
                            ☰
                        </button>
                        
                        <div style={{ 
                            position: 'relative', 
                            maxWidth: '400px', 
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <span style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)', zIndex: 10 }}>{isSearching ? '⏳' : '🔍'}</span>
                            <input 
                                type="text" 
                                placeholder={user?.role === 'STUDENT' ? "Search courses or tasks..." : "Search students, batches, assignments..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                                style={{ 
                                    width: '100%', 
                                    padding: '10px 14px 10px 42px', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--border)', 
                                    background: 'var(--bg-secondary)', 
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s ease'
                                }} 
                                onFocusCapture={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onBlurCapture={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    // Delay hiding results so clicks can register
                                    setTimeout(() => setShowSearchResults(false), 200);
                                }}
                            />
<ChatbotFAQ />
                            {/* Dropdown Results */}
                            {showSearchResults && searchResults.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    marginTop: '8px', background: '#fff', borderRadius: '12px',
                                    border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                                    zIndex: 1000, overflow: 'hidden'
                                }}>
                                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        {searchResults.map((res: any, idx: number) => (
                                            <div 
                                                key={idx}
                                                onClick={() => handleResultClick(res)}
                                                className="search-result-item"
                                                style={{
                                                    padding: '12px 16px', borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontSize: '20px' }}>{res.icon}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{res.title}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{res.subtitle}</div>
                                                </div>
                                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', opacity: 0.6, textTransform: 'uppercase' }}>{res.type}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    marginTop: '8px', background: '#fff', borderRadius: '12px',
                                    border: '1px solid var(--border)', padding: '20px', textAlign: 'center',
                                    fontSize: '13px', color: 'var(--text-muted)', zIndex: 1000
                                }}>
                                    No results found for "{searchQuery}"
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {/* Notifications */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => {
                                    setShowNotifs(!showNotifs);
                                }}
                                style={{ 
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    background: 'none', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    position: 'relative', 
                                    fontSize: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                🔔
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: '8px', right: '8px',
                                        width: '8px', height: '8px',
                                        background: 'var(--danger)', borderRadius: '50%', border: '2px solid #fff'
                                    }} />
                                )}
                            </button>

                            {showNotifs && (
                                <div
                                    onMouseLeave={() => setShowNotifs(false)}
                                    style={{
                                        position: 'fixed',
                                        top: 'auto',
                                        right: '8px',
                                        maxWidth: 'calc(100vw - 16px)',
                                        width: '320px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)',
                                        background: '#fff',
                                        boxShadow: 'var(--shadow-lg)',
                                        zIndex: 1000,
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Notifications</h3>
                                    </div>
                                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No notifications</p>
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => {
                                                        if (!n.read) {
                                                            setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif));
                                                            apiPost(`/api/auth/notifications/${n.id}/read`, { _method: 'PUT' })
                                                                .catch(err => {
                                                                    // Fallback if PUT doesn't work via _method workaround, try standard fetch
                                                                    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com'}/api/auth/notifications/${n.id}/read`, {
                                                                        method: 'PUT',
                                                                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                                                    });
                                                                });
                                                        }
                                                        if (n.link) {
                                                            router.push(n.link);
                                                        } else {
                                                            router.push('/student/notifications');
                                                        }
                                                        setShowNotifs(false);
                                                    }}
                                                    style={{
                                                        padding: '16px', 
                                                        borderBottom: '1px solid var(--border)',
                                                        background: n.read ? 'transparent' : 'var(--primary-glow)', 
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{n.message}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border)' }}>
                                        <button 
                                            style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}
                                            onClick={() => { router.push('/student/notifications'); setShowNotifs(false); }}
                                        >
                                            View All Notifications
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--border)' }}>
                            <div style={{ textAlign: 'right' }} className="desktop-only">
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{user.role}</div>
                            </div>
                            <div style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '8px', 
                                background: 'var(--primary)', 
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                fontWeight: 700
                            }}>
                                {user.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="animate-in">
                    {children}
                </div>
            </main>
            <ChatbotFAQ />
            {/* Global Suggestion Box for Students and Trainers */}
            {['STUDENT', 'TRAINER'].includes(user?.role || '') && <SuggestionBox />}
            {selectedStudentId && (
                <Student360Report
                    studentId={selectedStudentId}
                    onClose={() => setSelectedStudentId(null)}
                />
            )}

            {/* Saturday Feedback Block Overlay */}
        </div>
    );
}
