'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getStoredUser } from '@/lib/api';
import React from 'react';

interface SidebarProps {
    userRole: string;
    userName: string;
    userEmail: string;
    isOpen?: boolean;
    onClose?: () => void;
}

interface NavItem {
    label: string;
    href: string;
    icon: string;
    roles?: string[];
    requiresResumeAccess?: boolean;
    permission?: string;
}

interface NavSection {
    title: string;
    items: NavItem[];
    roles: string[];
}

const navSections: NavSection[] = [
    {
        title: 'Main',
        roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER', 'MARKETER'],
        items: [
            { label: 'Dashboard', href: '/dashboard', icon: '📊' },
        ],
    },
    {
        title: 'Marketing',
        roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETER'],
        items: [
            { label: 'Leads', href: '/marketing/leads', icon: '🎯' },
            { label: 'Campaigns', href: '/marketing/campaigns', icon: '📧' },
            { label: 'Reports', href: '/marketing/reports', icon: '📈' },
        ],
    },
    {
        title: 'Academy',
        roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'],
        items: [
            { label: 'Courses', href: '/admin/courses', icon: '📚', roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'manage_courses' },
            { label: 'Batches', href: '/admin/batches', icon: '👥', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'], permission: 'manage_batches' },
            { label: 'Registrations', href: '/admin/registrations', icon: '📝', roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'manage_courses' },
            { label: 'Students', href: '/admin/students', icon: '🎓' },
            { label: 'English Reports', href: '/admin/english', icon: '📊' },
            { label: 'Leaves', href: '/admin/leaves', icon: '🗓️', permission: 'manage_leaves' },
            { label: 'Time Tracking', href: '/admin/time-tracking', icon: '⏱️', roles: ['SUPER_ADMIN', 'ADMIN'] },
            { label: 'Reports', href: '/admin/reports', icon: '📈', roles: ['SUPER_ADMIN', 'ADMIN'] },
            { label: 'Suggestions', href: '/admin/suggestions', icon: '💡', roles: ['SUPER_ADMIN', 'ADMIN'] },
            { label: 'Sessions', href: '/admin/sessions', icon: '💻', roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'manage_batches' },
            { label: 'Feedback', href: '/admin/feedback', icon: '💬', roles: ['SUPER_ADMIN', 'ADMIN'] },
        ],
    },
    {
        title: 'Training Hub',
        roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER', 'MARKETER'],
        items: [
            { label: 'My Profile', href: '/student/profile', icon: '👤' },
            { label: 'Attendance', href: '/training/attendance', icon: '✅', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Work Hour', href: '/student/time-tracking', icon: '⏱️' },
            { label: 'Projects', href: '/training/projects', icon: '🏗️', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Tasks', href: '/training/tasks', icon: '📋', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Assignments', href: '/training/assignments', icon: '📝', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Videos', href: '/training/videos', icon: '🎬', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Sessions', href: '/training/sessions', icon: '💻', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Feedback', href: '/training/feedback', icon: '💬', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Violations', href: '/training/violations', icon: '⚠️', roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER'] },
            { label: 'Apply Leave', href: '/training/leaves', icon: '🗓️', roles: ['TRAINER'] },
        ],
    },
    {
        title: 'Career',
        roles: ['SUPER_ADMIN', 'ADMIN', 'STUDENT'],
        items: [
            { label: 'Jobs', href: '/placement/jobs', icon: '💼', roles: ['SUPER_ADMIN', 'ADMIN'] },
            { label: 'Assessments', href: '/placement/assessments', icon: '📝' },
            { label: 'Mock Interviews', href: '/placement/mock-interviews', icon: '🎤' },
            { label: 'Practice', href: '/placement/practice', icon: '🗣️' },
            { label: 'Resume Builder', href: '/student/resume', icon: '📄' },
            { label: 'Reports', href: '/placement/reports', icon: '📈', roles: ['SUPER_ADMIN', 'ADMIN'] },
        ],
    },
    {
        title: 'Student Portal',
        roles: ['STUDENT'],
        items: [
            { label: 'My Courses', href: '/student/courses', icon: '📚' },
            { label: 'My Profile', href: '/student/profile', icon: '👤' },
            { label: 'Schedule', href: '/student/schedule', icon: '📅' },
            { label: 'Attendance', href: '/student/attendance', icon: '✅' },
            { label: 'Work Hour', href: '/student/time-tracking', icon: '⏱️' },
            { label: 'Tasks', href: '/student/tasks', icon: '📋' },
            { label: 'Assignments', href: '/student/assessments', icon: '📝' },
            { label: 'Resume Builder', href: '/student/resume', icon: '📄', requiresResumeAccess: true },
            { label: 'Apply Leave', href: '/student/leaves', icon: '🗓️' },
            { label: 'Job Board', href: '/student/jobs', icon: '💼' },
            { label: 'Warnings', href: '/student/violations', icon: '⚠️' },
            { label: 'Notifications', href: '/student/notifications', icon: '🔔' },
            { label: 'Feedback', href: '/student/feedback', icon: '💬' },
        ],
    },
    {
        title: 'English Fluency',
        roles: ['SUPER_ADMIN', 'ADMIN', 'TRAINER', 'STUDENT'],
        items: [
            { label: 'Dashboard', href: '/english', icon: '🗣️' },
            { label: 'Live Call', href: '/english/live-call', icon: '📞' },
            { label: 'Speaking Practice', href: '/english/practice', icon: '🎙️' },
            { label: 'AI Conversation', href: '/english/conversation', icon: '🤖' },
            { label: 'Roleplay', href: '/english/roleplay', icon: '🎭' },
            { label: 'Think Drills', href: '/english/drills', icon: '🧠' },
            { label: 'Leaderboard', href: '/english/leaderboard', icon: '🏆' },
        ],
    },
    {
        title: 'System',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        items: [
            { label: 'Users', href: '/admin/users', icon: '👤', roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'manage_users' },
            { label: 'Project History', href: '/admin/project-history', icon: '📜', roles: ['SUPER_ADMIN'] },
            { label: 'Security', href: '/reports', icon: '⚠️' },
            { label: 'Notifications', href: '/notifications', icon: '🔔' },
            { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
        ],
    },
];

export default function Sidebar({ userRole, userName, userEmail, isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const user = getStoredUser();
    const canBuildResume = user?.can_build_resume === true || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [notifications, setNotifications] = React.useState<any[]>([]);
    const [traineeRating, setTraineeRating] = React.useState<number | null>(null);

    React.useEffect(() => {
        const fetchSidebarData = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                // Fetch Notifications
                const notifResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com'}/api/auth/notifications`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (notifResp.ok) {
                    const data = await notifResp.json();
                    setNotifications(Array.isArray(data) ? data.slice(0, 5) : []);
                }

                // Fetch Trainee Rating (only for students)
                if (userRole === 'STUDENT') {
                    const ratingResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com'}/api/sessions/feedback/trainee-rating`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (ratingResp.ok) {
                        const data = await ratingResp.json();
                        setTraineeRating(data.rating);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch sidebar data", err);
            }
        };

        fetchSidebarData();
        const interval = setInterval(fetchSidebarData, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, [userRole]);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const formatRole = (role: string) => {
        return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const handleLogout = () => {
        clearToken();
        router.push('/');
    };

    const markAsRead = async (id: string) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com'}/api/auth/notifications/${id}/read`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (e) { }
    };


    return (
        <>
            {/* Desktop Clean Sidebar */}
            <aside className={`desktop-sidebar ${isOpen ? 'open' : ''}`} style={{
                position: 'fixed',
                top: '0',
                left: '0',
                bottom: '0',
                width: 'var(--sidebar-width)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                background: '#fff',
                padding: '32px 0 24px',
                transition: 'all 0.4s ease',
                borderRight: '1px solid var(--border)',
                overflow: 'hidden'
            }}>
                {/* Branding */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px 32px', marginBottom: '8px' }}>
                    <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-heading)' }}>EduSuite.ai</h2>
                    </div>
                </div>

                {/* Navigation Scroll Area */}
                <nav style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }} className="sidebar-nav">
                    {navSections
                        .filter((section) => section.roles.includes(userRole))
                        .map((section) => (
                            <div key={section.title} style={{ marginBottom: '28px' }}>
                                <div style={{ 
                                    padding: '0 12px', 
                                    fontSize: '11px', 
                                    fontWeight: 700, 
                                    color: 'var(--text-muted)', 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.05em',
                                    marginBottom: '12px'
                                }}>
                                    {section.title}
                                </div>
                                {section.items
                                    .filter((item) => {
                                        if (userRole === 'SUPER_ADMIN') return true;
                                        
                                        // Explicit permission check for ADMIN and TRAINER
                                        if (item.permission && (userRole === 'ADMIN' || userRole === 'TRAINER')) {
                                            const perms = user?.permissions || {};
                                            if (perms[item.permission] === true) return true;
                                            
                                            // If they don't have the explicit permission, admins are blocked from permission-gated items
                                            if (userRole === 'ADMIN') return false; 
                                        }
                                        
                                        // Fallback to basic role check if no specific permission required or if TRAINER without the specific permission (e.g. Batches)
                                        return !item.roles || item.roles.includes(userRole);
                                    })
                                    .filter((item) => !item.requiresResumeAccess || canBuildResume)
                                    .map((item) => {
                                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={isActive ? 'active' : ''}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '10px',
                                                    color: isActive ? '#fff' : 'var(--text-secondary)',
                                                    background: isActive ? 'var(--primary)' : 'transparent',
                                                    fontWeight: isActive ? 700 : 500,
                                                    fontSize: '14px',
                                                    marginBottom: '4px',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: isActive ? 'var(--shadow-md)' : 'none',
                                                    textDecoration: 'none'
                                                }}
                                                onClick={onClose}
                                            >
                                                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                                                <span>{item.label}</span>
                                            </Link>
                                        );
                                    })}
                            </div>
                        ))}

                    {/* Live Notifications Section */}
                    {notifications.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={{ 
                                padding: '0 12px', 
                                fontSize: '11px', 
                                fontWeight: 700, 
                                color: 'var(--text-muted)', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                                marginBottom: '12px',
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}>
                                Live Updates
                                <Link href="/student/notifications" style={{ textTransform: 'none', color: 'var(--primary)', fontSize: '10px' }}>View All</Link>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {notifications.map((n: any) => (
                                    <div 
                                        key={n.id}
                                        onClick={() => {
                                            markAsRead(n.id);
                                            if (n.link) router.push(n.link);
                                            else router.push('/student/notifications');
                                            if (onClose) onClose();
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            background: n.read ? 'transparent' : 'var(--primary-glow)',
                                            border: `1px solid ${n.read ? 'var(--border)' : 'var(--primary-glow)'}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{n.title}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{n.message}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                {/* User Section */}
                <div style={{ marginTop: 'auto', padding: '24px 16px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px 20px' }}>
                        <div style={{ 
                            width: '36px', 
                            height: '36px', 
                            borderRadius: '8px', 
                            background: 'var(--bg-tertiary)', 
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px'
                        }}>
                            {getInitials(userName)}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {userName}
                                {traineeRating !== null && (
                                    <span style={{ fontSize: '11px', padding: '1px 6px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '99px', fontWeight: 700 }}>
                                        ⭐ {traineeRating.toFixed(1)}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{userRole.toLowerCase()}</div>
                        </div>
                    </div>
                    <button onClick={handleLogout} style={{
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        color: 'var(--text-secondary)', 
                        fontSize: '13px', 
                        fontWeight: 600,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        cursor: 'pointer', 
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseOver={(e) => { 
                        e.currentTarget.style.borderColor = 'var(--danger-light)'; 
                        e.currentTarget.style.color = 'var(--danger-dark)';
                        e.currentTarget.style.background = 'var(--danger-glow)';
                    }}
                    onMouseOut={(e) => { 
                        e.currentTarget.style.borderColor = 'var(--border)'; 
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                    >
                        <span>🚪</span> Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Navigation Bar - Enhanced */}
            <div className="mobile-bottom-nav" style={{ display: 'none' }}>
                {navSections
                    .filter((section) => section.roles.includes(userRole))
                    .flatMap(s => s.items)
                    .filter(item => !item.roles || item.roles.includes(userRole))
                    .filter(item => !item.requiresResumeAccess || canBuildResume)
                    .slice(0, 4)
                    .map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`bottom-nav-item${isActive ? ' active' : ''}`}
                                style={{
                                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                    textDecoration: 'none'
                                }}
                            >
                                <span className="bottom-nav-icon">{item.icon}</span>
                                <span className="bottom-nav-label">{item.label}</span>
                            </Link>
                        );
                    })}
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="bottom-nav-item"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <span className="bottom-nav-icon">☰</span>
                    <span className="bottom-nav-label">Menu</span>
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            <div className={`mobile-full-menu ${isMobileMenuOpen ? 'visible' : ''}`} style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--bg-primary)',
                zIndex: 2000,
                transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <div style={{ 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '12px', 
                            background: 'var(--primary-glow)', 
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600
                        }}>
                            {getInitials(userName)}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '16px' }}>{userName}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatRole(userRole)}</div>
                        </div>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'var(--bg-tertiary)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', color: 'var(--text-primary)', fontSize: '20px' }}>✕</button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {navSections
                        .filter((section) => section.roles.includes(userRole))
                        .map((section) => (
                            <div key={section.title} style={{ marginBottom: '32px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>{section.title}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    {section.items
                                        .filter((item) => !item.roles || item.roles.includes(userRole))
                                        .filter((item) => !item.requiresResumeAccess || canBuildResume)
                                        .map((item) => {
                                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        background: isActive ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
                                                        padding: '16px',
                                                        borderRadius: '16px',
                                                        border: isActive ? '1px solid var(--primary-glow)' : '1px solid var(--border)',
                                                        color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                                                        fontSize: '13px',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    <span style={{ fontSize: '24px' }}>{item.icon}</span>
                                                    <span style={{ textAlign: 'center' }}>{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                </div>
                            </div>
                        ))}
                </div>

                <div style={{ padding: '24px', borderTop: '1px solid var(--border)' }}>
                    <button onClick={handleLogout} style={{
                        width: '100%', 
                        padding: '14px', 
                        borderRadius: '16px',
                        background: '#ef4444', 
                        color: 'white', 
                        fontSize: '15px', 
                        fontWeight: 700,
                        border: 'none'
                    }}>
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    );
}
