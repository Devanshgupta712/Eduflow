'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, getStoredUser } from '@/lib/api';

interface TimeLog {
    id: string;
    date: string;
    login_time: string;
    logout_time: string | null;
    total_minutes: number | null;
}

export default function StudentTimeTrackingPage() {
    const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
    const [stats, setStats] = useState({ avgHours: '0h', activeToday: 0, totalDays: 0 });
    const [loading, setLoading] = useState(true);
    const [showScanner, setShowScanner] = useState(false);
    const [scanMsg, setScanMsg] = useState('');
    const qrCodeRef = useRef<any>(null);
    const userLocationRef = useRef<{ lat: number, lng: number } | null>(null);
    const isProcessingRef = useRef<boolean>(false);
    const lastScannedTokenRef = useRef<string>('');
    const user = getStoredUser();

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await apiGet('/api/training/time-tracking');
            setTimeLogs(data.logs || []);
            setStats(data.stats || { avgHours: '0h', activeToday: 0, totalDays: data.logs?.length || 0 });
        } catch (err) {
            console.error('Failed to load time tracking data:', err);
        } finally {
            setLoading(false);
        }
    };

    const startScanner = async () => {
        const { Html5Qrcode } = await import('html5-qrcode');
        setShowScanner(true);
        setScanMsg('');

        // Request geolocation for radius check
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
                () => { userLocationRef.current = null; },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        setTimeout(async () => {
            try {
                const html5QrCode = new Html5Qrcode("reader");
                qrCodeRef.current = html5QrCode;

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    onScanSuccess,
                    undefined
                );
            } catch (err: any) {
                console.error("Scanner startup error:", err);
                setScanMsg(`Camera Error: ${err?.message || 'Access denied'}`);
            }
        }, 300);
    };

    const stopScanner = async () => {
        if (qrCodeRef.current && qrCodeRef.current.isScanning) {
            try {
                await qrCodeRef.current.stop();
            } catch (err) {
                console.error("Failed to stop scanner:", err);
            }
        }
        qrCodeRef.current = null;
        isProcessingRef.current = false;
        lastScannedTokenRef.current = '';
        setShowScanner(false);
    };

    const [scanResult, setScanResult] = useState<{
        success: boolean;
        message: string;
        session?: any;
        status?: string;
    } | null>(null);

    const onScanSuccess = async (decodedText: string) => {
        // GUARD: Prevent duplicate calls from rapid QR frame callbacks
        if (isProcessingRef.current) return;
        if (decodedText === lastScannedTokenRef.current) return;
        isProcessingRef.current = true;
        lastScannedTokenRef.current = decodedText;

        try {
            setScanMsg('Processing pulse...');
            const scanBody: any = { qr_token: decodedText };
            const loc = userLocationRef.current;
            if (loc) {
                scanBody.latitude = loc.lat;
                scanBody.longitude = loc.lng;
            }
            const res = await apiPost('/api/auth/attendance/scan', scanBody);

            if (qrCodeRef.current) {
                await stopScanner();
            }
            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error(text || `Server error: ${res.status}`);
            }

            if (res.ok || (data && data.status === 'DONE')) {
                setScanResult({
                    success: true,
                    message: data.message,
                    session: data.session_info,
                    status: data.status
                });
                loadData();
            } else {
                setScanResult({
                    success: false,
                    message: data.detail || 'Invalid QR Code'
                });
            }
        } catch (err: any) {
            console.error('Scan error:', err);
            setScanResult({
                success: false,
                message: `Connection Error: ${err.message || 'Unknown error'}. Please check your internet or contact admin.`
            });
        } finally {
            isProcessingRef.current = false;
        }
    };

    const [onlinePunching, setOnlinePunching] = useState(false);
    const isOnlineStudent = user?.is_online_student === true || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'TRAINER';

    const handleOnlinePunch = async () => {
        setOnlinePunching(true);
        setScanResult(null);
        try {
            const res = await apiPost('/api/auth/online-punch', {});
            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error(text || `Server error: ${res.status}`);
            }

            if (res.ok || (data && data.status === 'success')) {
                setScanResult({
                    success: true,
                    message: data.message || 'Punch recorded successfully!'
                });
                loadData();
            } else {
                setScanResult({
                    success: false,
                    message: data.detail || 'Punch failed'
                });
            }
        } catch (err: any) {
            setScanResult({
                success: false,
                message: err.message || 'Failed to record online punch'
            });
        } finally {
            setOnlinePunching(false);
        }
    };

    const todayLogs = timeLogs.filter(log => new Date(log.date).toDateString() === new Date().toDateString());
    const isActive = todayLogs.length > 0 && !todayLogs[0].logout_time;
    const todayTotalMinutes = todayLogs.reduce((sum, log) => sum + (log.total_minutes || 0), 0);

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Work Hours</h1>
                    <p className="page-subtitle">Track your daily punch-in and punch-out activities</p>
                </div>
            </div>

            {/* Online Student Direct Punch Card */}
            {isOnlineStudent ? (
                <div className="glass-premium mb-24 reveal-on-scroll active" style={{
                    border: '1px solid var(--border)',
                    padding: '32px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    boxShadow: 'var(--shadow-premium)'
                }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '100px', background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', fontSize: '12px', fontWeight: 700, marginBottom: '16px' }}>
                        <span>🌐</span> ONLINE MODE AUTHORIZED
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Direct Mobile Punch</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '400px', marginInline: 'auto' }}>
                        You are registered as an Online Student. Tap below to punch in or out directly from your phone.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleOnlinePunch}
                            disabled={onlinePunching}
                            style={{
                                padding: '18px 40px',
                                fontSize: '1.15rem',
                                fontWeight: 700,
                                background: isActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
                                boxShadow: isActive ? '0 4px 20px rgba(239, 68, 68, 0.4)' : '0 4px 20px rgba(16, 185, 129, 0.4)',
                                borderRadius: '16px',
                                border: 'none'
                            }}
                        >
                            {onlinePunching ? '⏳ Recording Punch...' : (isActive ? '🔴 Click to Punch Out' : '🟢 Click to Punch In')}
                        </button>
                    </div>
                </div>
            ) : (
                /* Offline Student QR Scanner Card */
                <div className="glass-premium mb-24 reveal-on-scroll active" style={{
                    border: '1px solid var(--border)',
                    padding: '32px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    boxShadow: 'var(--shadow-premium)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🕒</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Punch Machine</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '400px', marginInline: 'auto' }}>
                        Scan the institute's official QR code to record your arrival. Scan the same code again when leaving to record your departure. You can punch in and out multiple times a day.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            onClick={startScanner}
                            style={{
                                padding: '16px 32px',
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #0ea5e9, #0066ff)',
                                boxShadow: '0 4px 20px rgba(0, 102, 255, 0.4)',
                                borderRadius: '16px'
                            }}
                        >
                            ⚡ Punch In / Out
                        </button>
                    </div>
                </div>
            )}

            <div className="grid-3 mb-24 reveal-on-scroll active">
                <div className="stat-card primary">
                    <div className="stat-icon primary">⏳</div>
                    <div className="stat-info">
                        <h3>Avg. Work Hours</h3>
                        <div className="stat-value">{stats.avgHours}</div>
                    </div>
                </div>
                <div className="stat-card success">
                    <div className="stat-icon success">🗓️</div>
                    <div className="stat-info">
                        <h3>Days Logged</h3>
                        <div className="stat-value">{timeLogs.length}</div>
                    </div>
                </div>
                <div className="stat-card accent">
                    <div className="stat-icon accent">✨</div>
                    <div className="stat-info">
                        <h3>Today's Total</h3>
                        <div className="stat-value" style={{ color: isActive ? 'var(--success)' : (todayTotalMinutes ? 'var(--accent)' : 'var(--text-muted)'), fontSize: '1.2rem', fontWeight: 600 }}>
                            {isActive ? (
                                <span className="animate-pulse">Active...</span>
                            ) : (
                                todayTotalMinutes > 0
                                    ? `${Math.floor(todayTotalMinutes / 60)}h ${todayTotalMinutes % 60}m`
                                    : '0h 0m'
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-premium reveal-on-scroll active">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 className="font-semibold">Punch History</h3>
                    <div className="badge badge-outline">Latest first</div>
                </div>

                {loading ? <p>Loading punch data...</p> : timeLogs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📂</div>
                        <h3>No punch records</h3>
                        <p>Use the Punch Machine above to record your work hours.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Punch In</th>
                                    <th>Punch Out</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {timeLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td>{new Date(log.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                                        <td className="text-success" style={{ fontWeight: 600 }}>{new Date(log.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                                        <td className="text-danger" style={{ fontWeight: 600 }}>{log.logout_time ? new Date(log.logout_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                                            {log.total_minutes ? `${Math.floor(log.total_minutes / 60)}h ${log.total_minutes % 60}m` : (log.logout_time ? '0m' : <span className="animate-pulse">Tracking...</span>)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showScanner && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '16px' }}
                    onClick={stopScanner}>
                    <div style={{ background: '#0f172a', borderRadius: '24px', padding: '24px', maxWidth: '420px', width: '100%', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏱️</div>
                        <h2 style={{ fontSize: '20px', margin: '0 0 8px', color: '#fff', fontWeight: 700 }}>Work Hours Scanner</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px' }}>Scan the general attendance QR code to log your time</p>

                        <div id="reader" style={{ overflow: 'hidden', borderRadius: '16px', border: '2px solid #0ea5e9', background: '#000', minHeight: '300px' }}></div>

                        {scanMsg && (
                            <div style={{ marginTop: '20px', color: '#38bdf8', fontWeight: 600 }}>{scanMsg}</div>
                        )}

                        <button className="btn btn-danger" style={{ width: '100%', marginTop: '24px', borderRadius: '12px' }} onClick={stopScanner}>✕ Close Scanner</button>
                    </div>
                </div>
            )}

            {scanResult && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, padding: '16px', backdropFilter: 'blur(10px)' }}
                    onClick={() => setScanResult(null)}>
                    <div className="animate-in" style={{ background: '#0f172a', borderRadius: '32px', padding: '40px 32px', maxWidth: '400px', width: '100%', border: '1px solid rgba(255,255,255,0.12)', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                        onClick={e => e.stopPropagation()}>

                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            background: scanResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: scanResult.success ? '#22c55e' : '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '40px', margin: '0 auto 24px',
                            border: `2px solid ${scanResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                            {scanResult.success ? '✓' : '✕'}
                        </div>

                        <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
                            {scanResult.success ? (
                                scanResult.status === 'DONE' ? 'Day Completed!' :
                                    (scanResult.session?.punch_type === 'IN' ? 'Punched In!' : 'Punched Out!')
                            ) : 'Scan Failed'}
                        </h2>

                        {scanResult.success && scanResult.session && (
                            <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{scanResult.session.user_name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{scanResult.session.role} • {scanResult.session.student_id}</div>
                            </div>
                        )}

                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px', lineHeight: 1.6 }}>
                            {scanResult.message}
                        </p>

                        {scanResult.success && scanResult.session && (
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '20px', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Arrival</span>
                                    <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>{new Date(scanResult.session.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                </div>
                                {scanResult.session.logout_time && (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Departure</span>
                                            <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>{new Date(scanResult.session.logout_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                        </div>
                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '12px 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Total Duration</span>
                                            <span style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: 600 }}>
                                                {scanResult.session.duration || (scanResult.session.total_minutes ? `${Math.floor(scanResult.session.total_minutes / 60)}h ${scanResult.session.total_minutes % 60}m` : '0m')}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <button className="btn btn-primary" style={{ width: '100%', borderRadius: '14px', padding: '14px' }} onClick={() => setScanResult(null)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
