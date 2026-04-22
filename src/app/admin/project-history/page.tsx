'use client';

import { useState, useEffect } from 'react';
import { getStoredUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

const timelineData = [
  {
    week: 1,
    dateRange: 'Feb 15 – Feb 21',
    title: 'The Great Migration',
    icon: '🏗️',
    color: '#6366f1',
    items: [
      'Migrated backend from Next.js API to FastAPI (Python)',
      'Implemented custom JWT-based Authentication',
      'Developed Public Registration system',
      'Built Student Leave Management system'
    ]
  },
  {
    week: 2,
    dateRange: 'Feb 22 – Feb 28',
    title: 'Deployment & QR Foundations',
    icon: '🚀',
    color: '#ec4899',
    items: [
      'Configured PostgreSQL production infrastructure on Render',
      'Launched QR-based Student Time Tracking (V1)',
      'Integrated Cloudinary for media and document storage'
    ]
  },
  {
    week: 3,
    dateRange: 'Mar 01 – Mar 07',
    title: 'Security & Analytics',
    icon: '🛡️',
    color: '#10b981',
    items: [
      'Implemented SMTP/OTP Email Verification system',
      'Added resend logic and countdown timers for security',
      'Launched Admin Dashboard V1 with real-time stats'
    ]
  },
  {
    week: 4,
    dateRange: 'Mar 08 – Mar 14',
    title: 'Workspaces & Marketing',
    icon: '📈',
    color: '#f59e0b',
    items: [
      'Developed dedicated Student Workspaces for course tracking',
      'Launched Lead Management System (LMS) for marketing',
      'Automated registration conversion funnels'
    ]
  },
  {
    week: 5,
    dateRange: 'Mar 15 – Mar 21',
    title: 'Placement & Permissions',
    icon: '💼',
    color: '#3b82f6',
    items: [
      'Built the Placement Portal for job postings',
      'Enforced Role-Based Access Control (RBAC) across all modules',
      'Implemented student access restrictions for admin panels'
    ]
  },
  {
    week: 6,
    dateRange: 'Mar 22 – Mar 31',
    title: 'Assessment Engine',
    icon: '📝',
    color: '#8b5cf6',
    items: [
      'Developed Module-based Session Tracking',
      'Built Assessment Engine V1 (MCQ & Coding tasks)',
      'Implemented auto-saving heartbeats for test resilience'
    ]
  },
  {
    week: 7,
    dateRange: 'Apr 01 – Apr 07',
    title: 'AI Intelligence',
    icon: '🤖',
    color: '#ef4444',
    items: [
      'Switched grading engine to Groq (Llama-3.3-70B)',
      'Implemented background AI grading with thread pooling',
      'Enhanced student feedback with AI-driven suggestions'
    ]
  },
  {
    week: 8,
    dateRange: 'Apr 08 – Apr 14',
    title: 'Modern Auth & UX',
    icon: '✨',
    color: '#06b6d4',
    items: [
      'Integrated Google OAuth for one-click sign-in',
      'Implemented Optimistic UI patterns for instant actions',
      'Enhanced performance with server-side health pings'
    ]
  },
  {
    week: 9,
    dateRange: 'Apr 15 – Apr 21',
    title: 'Productivity & Mobile',
    icon: '📱',
    color: '#f43f5e',
    items: [
      'Launched AI Resume Builder (Anti-hallucination logic)',
      'Converted platform to PWA with Web Push Notifications',
      'Integrated AI Voice Assistant for student support'
    ]
  },
  {
    week: 10,
    dateRange: 'Apr 22 – Current',
    title: 'Enterprise Workflows',
    icon: '🏢',
    color: '#1e293b',
    items: [
      'Transitioned to Location-Verified "Punch" Attendance',
      'Built Excel Reporting Engine for monthly attendance',
      'Launched Multi-Problem Lab Environment for coding tests',
      'Completed production PostgreSQL schema migration'
    ]
  }
];

export default function ProjectHistoryPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      router.push('/unauthorized');
    } else {
      setIsSuperAdmin(true);
      setLoading(false);
    }
  }, [router]);

  if (loading) return <div className="p-24">Verifying access...</div>;

  return (
    <div className="animate-in" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>LMS Development History</h1>
        <p className="page-subtitle" style={{ fontSize: '1.1rem' }}>Chronological Report of System Evolution (Feb – Apr 2026)</p>
      </div>

      <div className="timeline-container" style={{ position: 'relative', paddingBottom: '100px' }}>
        {/* Timeline Center Line */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '0',
          bottom: '0',
          width: '2px',
          background: 'linear-gradient(to bottom, transparent, var(--border), var(--border), transparent)',
          transform: 'translateX(-50%)',
          zIndex: 0
        }} />

        {timelineData.map((item, index) => (
          <div key={item.week} style={{
            display: 'flex',
            justifyContent: index % 2 === 0 ? 'flex-start' : 'flex-end',
            width: '100%',
            marginBottom: '40px',
            position: 'relative',
            zIndex: 1
          }}>
            {/* Timeline Dot */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '24px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--bg-primary)',
              border: `3px solid ${item.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              transform: 'translateX(-50%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              {item.icon}
            </div>

            {/* Content Card */}
            <div className="card" style={{
              width: '45%',
              padding: '24px',
              borderRadius: '24px',
              position: 'relative',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
              border: '1px solid var(--border)',
              transition: 'transform 0.3s ease',
            }}>
              <div style={{
                position: 'absolute',
                top: '24px',
                [index % 2 === 0 ? 'right' : 'left']: '-10px',
                width: '20px',
                height: '20px',
                background: 'var(--bg-primary)',
                borderTop: '1px solid var(--border)',
                [index % 2 === 0 ? 'borderRight' : 'borderLeft']: '1px solid var(--border)',
                transform: 'rotate(45deg)',
                zIndex: -1
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ 
                  background: `${item.color}15`, 
                  color: item.color, 
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  fontSize: '0.8rem', 
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Week {item.week}
                </span>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>{item.dateRange}</span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>{item.title}</h3>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {item.items.map((li, i) => (
                  <li key={i} style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    marginBottom: '8px', 
                    fontSize: '0.95rem', 
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5'
                  }}>
                    <span style={{ color: item.color }}>•</span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .timeline-container {
          padding-top: 20px;
        }
        .card:hover {
          transform: translateY(-5px);
          border-color: var(--accent) !important;
        }
        @media (max-width: 768px) {
          .timeline-container::before {
            left: 20px;
          }
          .timeline-dot {
            left: 20px !important;
          }
          .card {
            width: calc(100% - 60px) !important;
            margin-left: 60px !important;
          }
        }
      `}</style>
    </div>
  );
}
