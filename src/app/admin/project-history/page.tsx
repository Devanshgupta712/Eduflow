'use client';

import { useState, useEffect } from 'react';
import { getStoredUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

const projectData = [
  {
    week: 1,
    dateRange: 'Feb 02 – Feb 08',
    title: 'Project Foundation & UI Design',
    tech: 'HTML, CSS, JavaScript',
    items: [
      'Finalized project requirements and database schema',
      'Created responsive website layout using HTML5 and CSS3',
      'Designed user-friendly navigation and landing pages',
      'Implemented basic frontend validation using JavaScript'
    ]
  },
  {
    week: 2,
    dateRange: 'Feb 09 – Feb 15',
    title: 'Backend Setup & User Authentication',
    tech: 'Python, Django, SQL',
    items: [
      'Set up the core project structure using Python and Django',
      'Created the SQL database models for Users and Courses',
      'Developed Secure Login and Registration system',
      'Implemented user session management and password encryption'
    ]
  },
  {
    week: 3,
    dateRange: 'Feb 16 – Feb 22',
    title: 'Student Dashboard & Profiles',
    tech: 'Django, JavaScript, SQL',
    items: [
      'Built a personalized dashboard for students to track progress',
      'Added profile management where users can update details',
      'Developed Student Leave Management system',
      'Integrated dynamic data loading from the SQL database'
    ]
  },
  {
    week: 4,
    dateRange: 'Feb 23 – Mar 01',
    title: 'Attendance Tracking System',
    tech: 'JavaScript, Python, SQL',
    items: [
      'Launched the Student Attendance module',
      'Implemented QR code scanning for digital time tracking',
      'Added automated "Late Entry" calculations',
      'Developed attendance logs for trainers and admins'
    ]
  },
  {
    week: 5,
    dateRange: 'Mar 02 – Mar 08',
    title: 'Verification & Security',
    tech: 'Python, Django',
    items: [
      'Implemented Email Verification system using OTP',
      'Added security layers to prevent unauthorized access',
      'Built automated welcome email system for new students',
      'Refined the login flow for better user experience'
    ]
  },
  {
    week: 6,
    dateRange: 'Mar 09 – Mar 15',
    title: 'Lead & Course Management',
    tech: 'Django, SQL',
    items: [
      'Developed a system to track potential student inquiries (Leads)',
      'Built an admin panel to manage courses and batches',
      'Added search and filter functionality for large datasets',
      'Implemented registration status tracking'
    ]
  },
  {
    week: 7,
    dateRange: 'Mar 16 – Mar 22',
    title: 'Placement & Job Portal',
    tech: 'HTML, CSS, Django',
    items: [
      'Created a dedicated module for Job Postings',
      'Allowed students to view and apply for available jobs',
      'Implemented role-based permissions for placement managers',
      'Added job category filtering and application tracking'
    ]
  },
  {
    week: 8,
    dateRange: 'Mar 23 – Mar 31',
    title: 'Online Assessment System',
    tech: 'JavaScript, Python, SQL',
    items: [
      'Built an online quiz and test engine for students',
      'Implemented auto-saving features during exams',
      'Added support for Multiple Choice Questions (MCQs)',
      'Developed a session tracking system for live classes'
    ]
  },
  {
    week: 9,
    dateRange: 'Apr 01 – Apr 07',
    title: 'AI-Based Automatic Grading',
    tech: 'Python, AI Integration',
    items: [
      'Developed an automated system to grade student submissions',
      'Implemented AI-driven feedback for coding assignments',
      'Reduced manual effort for trainers using auto-grading',
      'Added performance analytics for students'
    ]
  },
  {
    week: 10,
    dateRange: 'Apr 08 – Apr 14',
    title: 'Google Integration & UX Polish',
    tech: 'JavaScript, Google APIs',
    items: [
      'Implemented "Sign in with Google" for easier access',
      'Improved website speed and responsiveness',
      'Added instant feedback notifications for user actions',
      'Refined the overall design for a more professional look'
    ]
  },
  {
    week: 11,
    dateRange: 'Apr 15 – Apr 21',
    title: 'AI Assistant & Mobile App Features',
    tech: 'Python, JavaScript',
    items: [
      'Launched an AI-powered Resume Builder for students',
      'Integrated a Voice Assistant for system navigation',
      'Enabled Mobile-Friendly features (PWA)',
      'Added real-time push notifications for mobile users'
    ]
  },
  {
    week: 12,
    dateRange: 'Apr 22 – Current',
    title: 'Advanced Reports & Final Deployment',
    tech: 'Python, SQL',
    items: [
      'Built a custom Excel Reporting engine for attendance data',
      'Launched a Multi-Problem coding lab for advanced tests',
      'Finalized the migration to a production-ready SQL database',
      'Conducted final testing and system optimization'
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
    <div className="animate-in" style={{ padding: '40px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '48px', borderBottom: '2px solid var(--border)', paddingBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Project Development Log</h1>
        <p className="page-subtitle" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>A detailed week-wise report of the LMS implementation (February – April 2026)</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {projectData.map((item) => (
          <div key={item.week} className="card" style={{ 
            padding: '0', 
            overflow: 'hidden', 
            borderRadius: '16px', 
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            {/* Week Header */}
            <div style={{ 
              background: 'var(--bg-secondary)', 
              padding: '16px 24px', 
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ 
                  background: 'var(--primary)', 
                  color: '#fff', 
                  padding: '4px 12px', 
                  borderRadius: '99px', 
                  fontSize: '0.85rem', 
                  fontWeight: 700 
                }}>
                  Week {item.week}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.dateRange}</span>
              </div>
              <div style={{ 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                color: 'var(--primary)',
                background: 'var(--primary-glow)',
                padding: '4px 12px',
                borderRadius: '8px'
              }}>
                Technologies: {item.tech}
              </div>
            </div>

            {/* Content Body */}
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>{item.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Core implementation focusing on the backend logic and frontend integration for the {item.title.toLowerCase()} module.
                </p>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {item.items.map((li, i) => (
                  <li key={i} style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    fontSize: '0.95rem', 
                    color: 'var(--text-secondary)',
                    alignItems: 'flex-start'
                  }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 900 }}>✓</span>
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '60px', padding: '32px', background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '16px' }}>Project Technology Stack</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {['HTML5', 'CSS3', 'JavaScript (ES6+)', 'Python 3.x', 'Django Framework', 'SQL Database'].map(tech => (
            <span key={tech} style={{ 
              background: '#fff', 
              border: '1px solid var(--border)', 
              padding: '8px 20px', 
              borderRadius: '12px', 
              fontSize: '0.9rem', 
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              {tech}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          border-color: var(--primary);
        }
      `}</style>
    </div>
  );
}
