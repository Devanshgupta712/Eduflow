'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', phone: '', course: 'NASSCOM', is_online_student: false, password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otp, setOtp] = useState('');
    const [phoneSent, setPhoneSent] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [phoneError, setPhoneError] = useState('');
    const [phoneSuccess, setPhoneSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!/^\d{10}$/.test(form.phone)) {
            setError('Phone number must be exactly 10 digits');
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (form.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    phone: form.phone || null,
                    course: form.course,
                    is_online_student: form.is_online_student,
                    password: form.password,
                    role: 'STUDENT',
                }),
            });
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch { data = { detail: text }; }
            if (!res.ok) {
                const errorMsg = typeof data.detail === 'string' ? data.detail : (Array.isArray(data.detail) ? data.detail[0]?.msg : text);
                setError(errorMsg || 'Registration failed');
                return;
            }
            setSuccess(true);
        } catch (err: any) {
            setError(err?.message || 'Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async () => {
        if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            setPhoneError('Please enter a valid email address');
            return;
        }
        setPhoneError('');
        setPhoneSuccess('');
        setPhoneLoading(true);

        try {
            const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email }),
            });
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch { data = { detail: text }; }
            if (!res.ok) {
                const errorMsg = typeof data.detail === 'string' ? data.detail : (Array.isArray(data.detail) ? data.detail[0]?.msg : text);
                setPhoneError(errorMsg || 'Failed to send OTP.');
                return;
            }
            setPhoneSent(true);
            setPhoneSuccess('Email sent! Please check your inbox.');
        } catch (err: any) {
            console.error("Email Error:", err);
            setPhoneError(err?.message || 'Network error. Failed to send Email.');
        } finally {
            setPhoneLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 6) return;
        setPhoneError('');
        setPhoneSuccess('');
        setPhoneLoading(true);
        try {
            const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email, otp: otp }),
            });
            const data = await res.json();
            if (!res.ok) {
                const errorMsg = typeof data.detail === 'string' ? data.detail : (Array.isArray(data.detail) ? data.detail[0]?.msg : 'Invalid verification code.');
                setPhoneError(errorMsg || 'Invalid verification code.');
                return;
            }

            setPhoneVerified(true);
            setPhoneSuccess('Email verified successfully!');
            setPhoneSent(false); // Hide the OTP input box
            setError('');
        } catch (err: any) {
            setPhoneError(err?.message || 'Network error. Failed to verify Email.');
        } finally {
            setPhoneLoading(false);
        }
    };

    const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (success) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: '#fff', 
                color: 'var(--text-primary)', 
                fontFamily: 'var(--font-family)', 
                position: 'relative' 
            }}>
                <header style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    padding: '32px 48px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    zIndex: 50 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="/logo.png" alt="EduSuite.ai" style={{ width: '32px', height: '32px' }} />
                        <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>EduSuite.ai</span>
                    </div>
                </header>

                <div style={{
                    textAlign: 'center', 
                    maxWidth: '480px', 
                    padding: '64px 48px', 
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: '24px', 
                    boxShadow: 'var(--shadow-lg)', 
                    position: 'relative', 
                    zIndex: 10
                }}>
                    <div style={{ fontSize: '64px', marginBottom: '32px' }}>🎉</div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Application Sent!</h1>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '40px', fontSize: '15px', fontWeight: 500 }}>
                        We've received your application. You can now log in to the dashboard to monitor your status and complete onboarding.
                    </p>
                    <button onClick={() => router.push('/login')} style={{
                        width: '100%',
                        padding: '16px', 
                        background: 'var(--primary)', 
                        color: '#ffffff',
                        border: 'none', 
                        borderRadius: '10px', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-md)',
                        transition: 'all 0.2s'
                    }}>
                        Proceed to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: '#fff', 
            color: 'var(--text-primary)', 
            fontFamily: 'var(--font-family)', 
            position: 'relative', 
            padding: '80px 0'
        }}>
            <header style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                padding: '32px 48px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                zIndex: 50 
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/logo.png" alt="EduSuite.ai" style={{ width: '32px', height: '32px' }} />
                    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>EduSuite.ai</span>
                </div>
                <a href="/" style={{
                    display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: 700,
                    padding: '10px 20px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    transition: 'all 0.2s'
                }}>
                    ← Back to Site
                </a>
            </header>

            <div style={{ width: '100%', maxWidth: '560px', padding: '24px', position: 'relative', zIndex: 10 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', letterSpacing: '-0.03em' }}>
                        Start Your Journey
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, fontWeight: 500 }}>Join the ecosystem of industry-ready developers</p>
                </div>

                {/* Form Card */}
                <div style={{
                    background: '#fff', 
                    borderRadius: '24px', 
                    padding: '48px',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                }}>
                    {error && (
                        <div style={{
                            background: 'var(--danger-glow)', 
                            border: '1px solid var(--danger)',
                            borderRadius: '12px', 
                            padding: '14px', 
                            color: 'var(--danger)', 
                            fontSize: '14px',
                            textAlign: 'center', 
                            fontWeight: 700, 
                            marginBottom: '24px'
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name *</label>
                            <input 
                                required 
                                value={form.name} 
                                onChange={e => set('name', e.target.value)} 
                                placeholder="John Doe" 
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address *</label>
                            <input 
                                required 
                                type="email" 
                                value={form.email} 
                                onChange={e => set('email', e.target.value)} 
                                placeholder="name@email.com" 
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Number *</label>
                            <input 
                                required 
                                type="tel" 
                                maxLength={10} 
                                value={form.phone} 
                                onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} 
                                placeholder="10-digit mobile number" 
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Course *</label>
                            <select 
                                required 
                                value={form.course} 
                                onChange={e => set('course', e.target.value)} 
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                                    transition: 'all 0.2s', cursor: 'pointer'
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            >
                                <option value="NASSCOM">NASSCOM</option>
                                <option value="Data Analyst">Data Analyst</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mode of Training *</label>
                            <select 
                                required 
                                value={form.is_online_student ? 'ONLINE' : 'OFFLINE'} 
                                onChange={e => set('is_online_student', e.target.value === 'ONLINE')} 
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                                    transition: 'all 0.2s', cursor: 'pointer'
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            >
                                <option value="OFFLINE">🏢 Offline Mode (Classroom - Physical QR Scanner)</option>
                                <option value="ONLINE">🌐 Online Mode (Remote - Direct Mobile Punch In/Out)</option>
                            </select>
                        </div>



                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password *</label>
                                <input 
                                    required 
                                    type="password" 
                                    value={form.password} 
                                    onChange={e => set('password', e.target.value)} 
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm *</label>
                                <input 
                                    required 
                                    type="password" 
                                    value={form.confirmPassword} 
                                    onChange={e => set('confirmPassword', e.target.value)} 
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} style={{
                            width: '100%', padding: '16px', marginTop: '16px',
                            background: 'var(--primary)',
                            color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700,
                            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
                            boxShadow: 'var(--shadow-md)',
                            transition: 'all 0.2s'
                        }}>
                            {loading ? 'Creating Account...' : 'Apply Now →'}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Already have an account?{' '}
                        <a href="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>
                            Sign in here
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
