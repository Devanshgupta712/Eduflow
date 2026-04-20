'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, setToken, setStoredUser } from '@/lib/api';

export default function PortalSelector() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | React.ReactNode>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      switch (user.role) {
        case 'SUPER_ADMIN':
        case 'ADMIN':
          router.push('/dashboard');
          break;
        case 'TRAINER':
          router.push('/training/attendance');
          break;
        case 'MARKETER':
          router.push('/marketing/leads');
          break;
        case 'STUDENT':
          router.push('/student/courses');
          break;
        default:
          break;
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Invalid credentials');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setToken(data.access_token);
      setStoredUser(data.user);

      // Route based on role
      switch (data.user.role) {
        case 'SUPER_ADMIN':
        case 'ADMIN':
          router.push('/dashboard');
          break;
        case 'TRAINER':
          router.push('/training/attendance');
          break;
        case 'MARKETER':
          router.push('/marketing/leads');
          break;
        case 'STUDENT':
          router.push('/student/courses');
          break;
        default:
          router.push('/dashboard');
      }
    } catch {
      setError('Connection error. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#fff', 
      color: 'var(--text-primary)', 
      position: 'relative', 
      fontFamily: 'var(--font-family)' 
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
          <img src="/logo.png" alt="EduSuite.ai" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
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

      <div style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative', zIndex: 10 }}>
        {/* Main Login Card */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '56px 48px',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '32px', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.04em' }}>
              Welcome back
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, fontWeight: 500 }}>
              Access your learning dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {error && (
              <div style={{
                background: 'var(--danger-glow)', border: '1px solid var(--danger)',
                borderRadius: '12px', padding: '14px', color: 'var(--danger)', fontSize: '14px',
                textAlign: 'center', fontWeight: 700
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{
                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, display: 'block',
                marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
                placeholder="name@company.com"
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                  boxSizing: 'border-box', transition: 'all 0.2s'
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              />
            </div>

            <div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{
                  color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block'
                }}>Password</label>
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
                    boxSizing: 'border-box', transition: 'all 0.2s'
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', fontSize: '18px' }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '16px', borderRadius: '10px', border: 'none',
              background: 'var(--primary)', color: '#ffffff',
              fontSize: '16px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              marginTop: '12px', opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow-md)'
            }}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Don&apos;t have an account?{' '}
            <a href="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>
              Create Account
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
