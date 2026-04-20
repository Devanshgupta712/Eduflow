'use client';

import { useEffect, useRef } from 'react';

const features = [
  { 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>, 
    title: 'Live Project Experience', 
    desc: 'Work on real-world industrial projects with actual source code and deployment structures.',
    items: ['3+ Live Projects', 'Deployment Guide', 'Source Code Access']
  },
  { 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>, 
    title: 'AI-Powered Support', 
    desc: 'Get instant doubt-clearing and career guidance from our customized AI assistant 24/7.',
    items: ['24/7 AI Tutor', 'Instant Feedback', 'Resume Builder']
  },
  { 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, 
    title: 'Flexible Batches', 
    desc: 'Multiple timing options available for students and working professionals to learn at their own pace.',
    items: ['Morning/Evening', 'Weekend Sessions', 'Recorded Lectures']
  },
  { 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>, 
    title: 'IT Company Certificate', 
    desc: 'Receive an industry-recognized certification upon completion to boost your resume valuation.',
    items: ['Globally Accepted', 'Digital Verification', 'LMS Authenticated']
  },
  { 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, 
    title: 'Pay after Placement', 
    desc: 'Secure your future with our unique 50% fees after placement model (Terms & Conditions apply).',
    items: ['Reduced Risk', 'Job Guarantee', 'Career Roadmap']
  },
  { 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>, 
    title: 'Industry Experts', 
    desc: 'Learn from mentors with 10+ years of experience in top MNCs like Google, Microsoft, and Amazon.',
    items: ['Live Mentoring', 'Code Reviews', 'Interview Prep']
  }
];

export default function Features() {
  return (
    <section style={{ padding: '80px 0', background: '#fff' }}>
      <div className="container-wide" style={{ maxWidth: '1280px', padding: '0 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ 
            fontSize: '32px', 
            fontWeight: 800, 
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '40px'
          }}>
            The Difference: How EduSuite.ai Prepares You for the Real World
          </h2>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '24px'
        }}>
          {features.map((feature, i) => (
            <div 
              key={i} 
              style={{ 
                padding: '32px',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                background: '#fff',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
              onMouseOver={(e) => { 
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; 
                e.currentTarget.style.borderColor = 'var(--primary-glow)';
              }}
              onMouseOut={(e) => { 
                e.currentTarget.style.boxShadow = 'none'; 
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div style={{ fontSize: '32px' }}>{feature.icon}</div>
              
              <div>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: 700, 
                  color: 'var(--text-primary)',
                  marginBottom: '10px'
                }}>
                  {feature.title}
                </h3>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: '14px',
                  lineHeight: 1.6,
                  marginBottom: '20px'
                }}>
                  {feature.desc}
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {feature.items.map((item, idx) => (
                    <li key={idx} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      fontWeight: 500
                    }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: '10px' }}>•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          div[style*="gridTemplateColumns: repeat(3, 1fr)"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: repeat(3, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
