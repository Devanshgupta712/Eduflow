'use client';

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Company: [
      { name: 'About Us', href: '/about' },
      { name: 'Careers', href: '/careers' },
      { name: 'Blog', href: '/blog' },
    ],
    Learning: [
      { name: 'All Courses', href: '/courses' },
      { name: 'Certification', href: '/certifications' },
    ],
    Support: [
      { name: 'Contact', href: '/contact' },
      { name: 'FAQ', href: '/faq' },
      { name: 'Privacy', href: '/privacy' },
    ],
  };

  return (
    <footer style={{ background: '#fff', padding: '100px 40px 60px', borderTop: '1px solid var(--border)' }}>
      <div className="container-wide" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: '60px', marginBottom: '80px' }}>
          {/* Logo & Info */}
          <div>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', textDecoration: 'none' }}>
              <img src="/logo.png" alt="EduSuite.ai" style={{ height: '32px', width: 'auto' }} />
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-heading)' }}>EduSuite.ai</span>
            </Link>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '32px', maxWidth: '320px', fontSize: '15px' }}>
              Experience the future of IT training with real projects and MNC certificates.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              {['Facebook', 'Twitter', 'LinkedIn', 'Instagram'].map((social, i) => (
                <div key={i} style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  transition: 'color 0.2s' 
                }} 
                onMouseOver={(e) => (e.currentTarget.style.color = 'var(--primary)')} 
                onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                  {social}
                </div>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {links.map((link) => (
                  <li key={link.name} style={{ marginBottom: '16px' }}>
                    <Link href={link.href} style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s', fontSize: '14px', fontWeight: 500 }} onMouseOver={(e) => (e.currentTarget.style.color = 'var(--primary)')} onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
            © {currentYear} EduSuite.ai. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Terms', 'Privacy', 'Cookies'].map(item => (
              <Link key={item} href="#" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }} onMouseOver={(e) => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
