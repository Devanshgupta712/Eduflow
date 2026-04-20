'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || '';

    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (!email) {
            router.push('/register');
        }
    }, [email, router]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length < 6) return;

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: otp }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail || 'Verification failed');
                return;
            }

            setSuccess('Email verified successfully! Redirecting to login...');
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err: any) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0) return;

        setError('');
        setSuccess('');
        setResendLoading(true);

        try {
            const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.detail || 'Failed to resend code');
                return;
            }

            setSuccess('Verification code resent to your email.');
            setCountdown(60);
        } catch (err: any) {
            setError('Network error. Failed to resend code.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)', position: 'relative', overflow: 'hidden' }}>
            <header style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src="/logo.png" alt="EduSuite.ai" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                        <span style={{ fontSize: '24px', background: 'linear-gradient(135deg, #0066ff, #3399ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>EduSuite.ai</span>
                    </div>
                </div>
            </header>

            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80vw', height: '80vh', background: 'radial-gradient(ellipse, rgba(0, 102, 255, 0.05) 0%, rgba(255,255,255,0) 50%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '-0.03em' }}>Verify Your Email</h1>
                    <p style={{ color: '#555770', fontSize: '15px' }}>
                        We've sent a 6-digit verification code to<br />
                        <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                    </p>
                </div>

                <div style={{ background: 'var(--bg-primary)', borderRadius: '32px', padding: '40px', border: '1px solid var(--border)', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08)' }}>
                    {error && (
                        <div style={{ background: '#fff1f2', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px', color: '#e11d48', fontSize: '14px', textAlign: 'center', marginBottom: '24px' }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{ background: '#f0fdf4', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px', color: '#15803d', fontSize: '14px', textAlign: 'center', marginBottom: '24px' }}>
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555770', marginBottom: '12px', textAlign: 'center' }}>Enter Verification Code</label>
                            <input
                                required
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="0 0 0 0 0 0"
                                style={{
                                    width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)',
                                    background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '32px', fontWeight: 700,
                                    textAlign: 'center', letterSpacing: '12px', outline: 'none', transition: 'all 0.2s',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => { e.target.style.borderColor = '#0066ff'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 4px rgba(0, 102, 255, 0.1)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || otp.length < 6}
                            style={{
                                width: '100%', padding: '16px', background: 'linear-gradient(135deg, #0044cc, #0066ff)',
                                color: '#ffffff', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700,
                                cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer', opacity: (loading || otp.length < 6) ? 0.7 : 1,
                                boxShadow: '0 4px 16px rgba(0, 102, 255, 0.25)', transition: 'all 0.3s'
                            }}
                        >
                            {loading ? 'Verifying...' : 'Verify Email →'}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '32px' }}>
                        <p style={{ fontSize: '14px', color: '#555770', marginBottom: '8px' }}>Didn't receive the code?</p>
                        <button
                            onClick={handleResend}
                            disabled={resendLoading || countdown > 0}
                            style={{
                                background: 'none', border: 'none', color: (resendLoading || countdown > 0) ? '#94a3b8' : '#0066ff',
                                fontSize: '14px', fontWeight: 600, cursor: (resendLoading || countdown > 0) ? 'default' : 'pointer',
                                transition: 'color 0.2s'
                            }}
                        >
                            {resendLoading ? 'Sending...' : (countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code')}
                        </button>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                    <a href="/login" style={{ color: '#555770', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>← Back to Login</a>
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}
