'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

export default function StudentCoursesPage() {
    const [courses, setCourses] = useState<any[]>([]);
    const [timeLog, setTimeLog] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        apiGet('/api/auth/my-courses').then(setCourses).catch(() => { });
        apiGet('/api/training/time-tracking?date=' + new Date().toISOString().split('T')[0])
            .then(data => {
                if (data.logs && data.logs.length > 0) {
                    setTimeLog(data.logs[0]);
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // Live Ticker Effect
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const activeCourses = courses.filter((c: any) => c.status === 'ACTIVE');
    const totalFee = courses.reduce((sum: number, c: any) => sum + (c.fee_total || 0), 0);
    const totalPaid = courses.reduce((sum: number, c: any) => sum + (c.fee_paid || 0), 0);
    const primaryCourse = activeCourses[0] || courses[0];

    const getTodayHours = (includeSeconds = false) => {
        if (!timeLog) return includeSeconds ? '0h 0m 00s' : '0h 0m';
        if (timeLog.logout_time) {
            const totalSecs = (timeLog.total_minutes || 0) * 60;
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            return includeSeconds ? `${h}h ${m}m ${s.toString().padStart(2, '0')}s` : `${h}h ${m}m`;
        }
        
        // Active Session Calculation
        const loginTime = new Date(timeLog.login_time).getTime();
        const diffMs = currentTime.getTime() - loginTime;
        const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
        
        const h = Math.floor(diffSecs / 3600);
        const m = Math.floor((diffSecs % 3600) / 60);
        const s = diffSecs % 60;
        
        if (includeSeconds) {
            return `${h}h ${m}m ${s.toString().padStart(2, '0')}s`;
        }
        return `${h}h ${m}m`;
    };

    const isActiveSession = timeLog && !timeLog.logout_time;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* === WELCOME BANNER === */}
            <div className="animate-stripe reveal-on-scroll active" style={{
                borderRadius: '28px',
                padding: '48px 40px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-premium)',
                minHeight: '180px',
            }}>
                {/* Background blobs */}
                <div style={{ position: 'absolute', top: '-40px', right: '-60px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-60px', left: '30%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: '100px', fontSize: '12px', fontWeight: 600, marginBottom: '16px', letterSpacing: '0.06em' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActiveSession ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'inline-block' }} />
                            {isActiveSession ? 'SESSION ACTIVE' : 'LEARNING PORTAL'}
                        </div>
                        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: '12px' }}>
                            Your Academy<br />Dashboard
                        </h1>
                        <p style={{ fontSize: '16px', opacity: 0.85, fontWeight: 500, maxWidth: '500px' }}>
                            {activeCourses.length > 0 ? `${activeCourses.length} active program${activeCourses.length > 1 ? 's' : ''} in progress.` : 'Welcome to your learning portal.'} Keep up the momentum.
                        </p>
                    </div>

                    {/* Live Session Card */}
                    <div className="glass-premium" style={{ padding: '20px 28px', borderRadius: '20px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(16px)', textAlign: 'right', minWidth: '220px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Today's Hours</div>
                        <div style={{ fontSize: '36px', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.04em', fontFamily: 'monospace' }}>{getTodayHours(true)}</div>
                        {isActiveSession && (
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <span className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                                Live since {new Date(timeLog.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* === METRICS GRID === */}
            <div className="grid-4 reveal-on-scroll" style={{ gap: '16px' }}>
                {[
                    { icon: '📚', label: 'Total Enrollments', value: courses.length, sub: `${activeCourses.length} active` },
                    { icon: '💳', label: 'Total Fee', value: `₹${totalFee.toLocaleString()}`, sub: `₹${totalPaid.toLocaleString()} paid` },
                    { icon: '📊', label: 'Balance Due', value: `₹${(totalFee - totalPaid).toLocaleString()}`, sub: totalFee > 0 ? `${Math.round((totalPaid / totalFee) * 100)}% cleared` : 'Up to date' },
                    { icon: '⚡', label: 'Today\'s Session', value: getTodayHours(), sub: isActiveSession ? 'Currently active' : 'No active session' },
                ].map((metric, i) => (
                    <div key={i} className="glass-premium hover-lift" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{metric.icon}</div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{metric.label}</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{metric.value}</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>{metric.sub}</div>
                    </div>
                ))}
            </div>

            {/* === TWO-COLUMN LAYOUT === */}
            <div className="courses-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

                {/* LEFT: Main Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Continue Learning Hero */}
                    {primaryCourse && (
                        <div className="reveal-on-scroll">
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Resume Learning</div>
                            <div className="glass-premium hover-lift" style={{ padding: '28px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🎯</div>
                                            <div>
                                                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{primaryCourse.name}</div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{primaryCourse.duration || 'Flexible Duration'}</div>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>{primaryCourse.description?.slice(0, 120)}...</p>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '8px', background: primaryCourse.status === 'ACTIVE' ? 'var(--primary-glow)' : 'var(--bg-tertiary)', color: primaryCourse.status === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)', border: '1px solid currentColor' }}>
                                                {primaryCourse.status}
                                            </span>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                {primaryCourse.registration_date ? `Enrolled ${new Date(primaryCourse.registration_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>Fee Cleared</div>
                                        <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.03em' }}>
                                            {primaryCourse.fee_total > 0 ? `${Math.round((primaryCourse.fee_paid / primaryCourse.fee_total) * 100)}%` : '—'}
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{ width: '120px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '10px', marginTop: '12px', overflow: 'hidden' }}>
                                            <div style={{ width: `${primaryCourse.fee_total > 0 ? (primaryCourse.fee_paid / primaryCourse.fee_total) * 100 : 0}%`, height: '100%', background: 'var(--primary)', borderRadius: '10px', transition: 'width 1s ease' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Course Cards Grid */}
                    <div className="reveal-on-scroll">
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>All Enrolled Programs</div>
                        {loading ? (
                            <div className="glass-premium" style={{ padding: '80px', textAlign: 'center', borderRadius: '24px' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                                <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Loading your programs...</p>
                            </div>
                        ) : courses.length === 0 ? (
                            <div className="glass-premium" style={{ padding: '80px', textAlign: 'center', borderRadius: '24px', border: '1px dashed var(--border)' }}>
                                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📚</div>
                                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No programs found</h3>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Contact your administrator to get enrolled in a course.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                {courses.map((c: any, i: number) => {
                                    const payPct = c.fee_total > 0 ? Math.round((c.fee_paid / c.fee_total) * 100) : 100;
                                    const balance = c.fee_total - c.fee_paid;
                                    return (
                                        <div key={c.id} className="glass-premium hover-lift" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                            {/* Color Bar */}
                                            <div style={{ height: '4px', background: `hsl(${(i * 37) % 360}, 70%, 60%)` }} />
                                            <div style={{ padding: '24px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', flex: 1, marginRight: '12px', lineHeight: 1.3 }}>{c.name}</h3>
                                                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', background: c.status === 'ACTIVE' ? 'var(--primary-glow)' : 'var(--bg-tertiary)', color: c.status === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)', border: '1px solid currentColor', whiteSpace: 'nowrap' }}>
                                                        {c.status}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px', fontWeight: 500 }}>{c.description?.slice(0, 80) || 'No description available.'}</p>

                                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '16px' }}>
                                                    <span>⏱️ {c.duration || 'Flexible'}</span>
                                                    <span>📅 {c.registration_date ? new Date(c.registration_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</span>
                                                </div>

                                                {/* Fee Block */}
                                                <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Total Fee</span>
                                                        <span style={{ fontSize: '13px', fontWeight: 600 }}>₹{c.fee_total?.toLocaleString()}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Paid</span>
                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>₹{c.fee_paid?.toLocaleString()}</span>
                                                    </div>
                                                    {/* Payment bar */}
                                                    <div style={{ height: '5px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                                                        <div style={{ width: `${payPct}%`, height: '100%', background: balance > 0 ? '#f59e0b' : '#10b981', borderRadius: '10px' }} />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Balance</span>
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: balance > 0 ? '#ef4444' : '#10b981' }}>
                                                            {balance > 0 ? `₹${balance.toLocaleString()} due` : '✓ Cleared'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Sidebar */}
                <div className="courses-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '100px' }}>

                    {/* Quick Actions */}
                    <div className="glass-premium reveal-on-scroll" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Quick Actions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                                { icon: '🕒', label: 'Time Tracking', href: '/student/time-tracking' },
                                { icon: '📋', label: 'My Attendance', href: '/student/attendance' },
                                { icon: '🏖️', label: 'Leave Requests', href: '/student/leaves' },
                                { icon: '📄', label: 'My Certificates', href: '/student/certificates' },
                            ].map((action, i) => (
                                <Link key={i} href={action.href} className="hover-lift" style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 14px', borderRadius: '12px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px',
                                    textDecoration: 'none', transition: 'all 0.2s'
                                }}>
                                    <span style={{ fontSize: '18px' }}>{action.icon}</span>
                                    {action.label}
                                    <span style={{ marginLeft: 'auto', opacity: 0.4 }}>→</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Today's Activity */}
                    <div className="glass-premium reveal-on-scroll" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Today's Log</div>
                        {timeLog ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Punch In</div>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>
                                            {new Date(timeLog.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Punch Out</div>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: timeLog.logout_time ? '#ef4444' : 'var(--text-muted)' }}>
                                            {timeLog.logout_time ? new Date(timeLog.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '12px', background: 'var(--primary-glow)', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Duration</div>
                                    <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>{getTodayHours(true)}</div>
                                </div>
                                <Link href="/student/time-tracking" style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none' }}>
                                    View Full History →
                                </Link>
                            </div>
                        ) : (
                            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>🕐</div>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>No sessions recorded today</p>
                            </div>
                        )}
                    </div>

                    {/* Fee Summary */}
                    <div className="glass-premium reveal-on-scroll" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Payment Summary</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Total Program Fee</span>
                                <span style={{ fontSize: '14px', fontWeight: 700 }}>₹{totalFee.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Amount Paid</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>₹{totalPaid.toLocaleString()}</span>
                            </div>
                            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>Balance</span>
                                <span style={{ fontSize: '15px', fontWeight: 600, color: (totalFee - totalPaid) > 0 ? '#ef4444' : '#10b981' }}>
                                    {(totalFee - totalPaid) > 0 ? `₹${(totalFee - totalPaid).toLocaleString()}` : '✓ Cleared'}
                                </span>
                            </div>
                            {totalFee > 0 && (
                                <div>
                                    <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' }}>
                                        <div style={{ width: `${Math.round((totalPaid / totalFee) * 100)}%`, height: '100%', background: (totalFee - totalPaid) > 0 ? '#f59e0b' : '#10b981', borderRadius: '10px' }} />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', marginTop: '6px' }}>
                                        {Math.round((totalPaid / totalFee) * 100)}% of total cleared
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
