'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const fallbackCourses = [
  { id: 1, title: 'Full Stack Java', category: 'Backend', icon: '💻', price: '₹49,999', rating: '4.9/5' },
  { id: 2, title: 'Python Django React', category: 'Full Stack', icon: '🔥', price: '₹54,999', rating: '5.0/5' },
  { id: 3, title: 'Data Analytics', category: 'Data Science', icon: '📊', price: '₹59,999', rating: '4.8/5' },
  { id: 4, title: 'MERN Stack', category: 'Web Dev', icon: '🚀', price: '₹52,999', rating: '4.9/5' },
];

export default function Courses({ activeCategory = 'All Courses' }: { activeCategory?: string }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/public/courses')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCourses(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const allCourses = courses.length > 0 ? courses : fallbackCourses;
  const displayCourses = activeCategory === 'All Courses' 
    ? allCourses 
    : allCourses.filter(c => c.category === activeCategory);

  return (
    <section style={{ padding: '40px 0 100px', background: '#fff' }}>
      <div className="container-wide" style={{ maxWidth: '1280px', padding: '0 40px' }}>
        <div style={{ marginBottom: '60px' }}>
          <h2 style={{ 
            fontSize: '32px', 
            fontWeight: 800, 
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '20px'
          }}>
            Master the Stack.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '600px' }}>
            Choose from our specialized career tracks. Each one is a 6-month intensive journey.
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '24px'
        }}>
          {displayCourses.map((course) => (
            <div 
              key={course.id}
              style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseOver={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.borderColor = 'var(--primary-glow)'; }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <div style={{ 
                background: 'var(--bg-secondary)', 
                height: '200px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '64px'
              }}>
                {course.icon}
              </div>
              <div style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: 700, 
                  color: 'var(--primary)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em',
                  marginBottom: '12px'
                }}>
                  {course.category}
                </div>
                <h3 style={{ 
                  fontSize: '24px', 
                  fontWeight: 800, 
                  color: 'var(--text-primary)',
                  marginBottom: '16px',
                  lineHeight: 1.2
                }}>
                  {course.title}
                </h3>
                
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Program Fee</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{course.price}</div>
                  </div>
                  <Link href="/register" className="btn btn-primary" style={{ 
                    width: '100%', 
                    borderRadius: '10px', 
                    padding: '14px', 
                    textAlign: 'center',
                    fontWeight: 700,
                    display: 'block',
                    background: 'var(--primary)',
                    color: '#fff',
                    textDecoration: 'none'
                  }}>
                    Explore Course
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          div[style*="gridTemplateColumns: repeat(4, 1fr)"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: repeat(4, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
