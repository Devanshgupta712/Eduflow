import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../ThemeProvider';
import { getStoredUser } from '@/lib/api';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    if (getStoredUser()) setIsLoggedIn(true);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Features', href: '/features' },
    { name: 'Courses', href: '/courses' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <nav 
      style={{ 
        position: 'fixed', 
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 1000, 
        padding: isScrolled ? '16px 40px' : '24px 40px', 
        transition: 'all 0.4s ease',
        background: isScrolled ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(10px)' : 'none',
        borderBottom: isScrolled ? '1px solid var(--border)' : 'none',
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        margin: '0 auto',
        maxWidth: '1280px',
        width: '100%'
      }}>
        {/* Logo */}
        <Link href="/" style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          textDecoration: 'none'
        }}>
          <img src="/logo.png" alt="EduSuite.ai Logo" style={{ height: '32px', width: 'auto' }} />
          <span style={{ 
            fontSize: '20px', 
            fontWeight: 800, 
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-heading)'
          }}>EduSuite.ai</span>
        </Link>

        {/* Links (Centered) */}
        <div className="desktop-only" style={{ display: 'flex', gap: '32px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href} 
              style={{ 
                fontSize: '14px', 
                fontWeight: 500, 
                color: 'var(--text-secondary)',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="desktop-only" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn btn-primary" style={{ borderRadius: '8px', padding: '10px 24px', fontSize: '14px' }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Log in
              </Link>
              <Link href="/register" style={{ 
                border: '1px solid var(--text-primary)',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--text-primary)'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="mobile-only" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
          borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)'
        }}>
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href} onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>{link.name}</Link>
          ))}
          <div style={{ height: '1px', background: 'var(--border)' }} />
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" style={{ fontWeight: 600 }}>Log in</Link>
              <Link href="/register" className="btn btn-primary">Sign up</Link>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 900px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
        }
        @media (min-width: 901px) {
          .desktop-only { display: flex !important; }
          .mobile-only { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
