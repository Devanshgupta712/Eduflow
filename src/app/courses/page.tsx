'use client';

import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Courses from '@/components/marketing/Courses';
import CTA from '@/components/marketing/CTA';

import { useState } from 'react';

export default function CoursesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Courses');
  const allCategories = ['All Courses', 'Backend', 'Frontend', 'Data Science', 'Testing', 'Full Stack'];
  
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowX: 'hidden' }} className="bg-grid-subtle">
      <Navbar />
      
      <main>
        {/* Header Section */}
        <section className="section-padding" style={{ paddingTop: 'clamp(100px, 12vh, 140px)', paddingBottom: 'var(--space-8)' }}>
          <div className="container-wide" style={{ maxWidth: '1200px', textAlign: 'center', padding: '0 var(--space-8)' }}>
            <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, marginBottom: 'var(--space-4)', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>Pick Your Career Pathway.</h1>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '700px', margin: '0 auto var(--space-8)' }}>
              From Full Stack Web Development to Data Science, choose the program that aligns with your goals.
            </p>
            
            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap', padding: 'var(--space-4) 0' }}>
              {allCategories.map((cat, i) => (
                <button 
                  key={i} 
                  onClick={() => setSelectedCategory(cat)}
                  className="hover-lift" 
                  style={{ 
                    padding: '10px 24px', 
                    borderRadius: '100px', 
                    border: '1px solid', 
                    borderColor: selectedCategory === cat ? 'var(--primary)' : 'var(--border)', 
                    background: selectedCategory === cat ? 'var(--primary)' : '#fff', 
                    color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)', 
                    fontWeight: 700, 
                    fontSize: '13px', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s', 
                    boxShadow: selectedCategory === cat ? 'var(--shadow-md)' : 'var(--shadow-sm)' 
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        <Courses activeCategory={selectedCategory} />

        <div className="section-divider"></div>

        {/* Benefits for Students Section */}
        <section className="section-padding" style={{ background: 'var(--bg-secondary)', padding: 'var(--space-16) 0' }}>
          <div className="container-wide" style={{ maxWidth: '1200px', padding: '0 var(--space-8)' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: 'var(--space-12)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>What You Get With Each Course</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
              {[
                { 
                  title: 'Certification', 
                  desc: 'Industry-recognized certificate from EduSuite.ai.', 
                  icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> 
                },
                { 
                  title: 'Project Training', 
                  desc: 'Work on 3+ live projects with source code and deployment.', 
                  icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> 
                },
                { 
                  title: 'Job Placement', 
                  desc: 'Guaranteed 10+ interview calls from top IT companies.', 
                  icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M7 22v-8.11b"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> 
                },
                { 
                  title: 'Mentor Support', 
                  desc: '1-on-1 doubt clearing sessions with senior developers.', 
                  icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> 
                }
              ].map((benefit, i) => (
                <div key={i} className="hover-lift hover-glow shadow-sm" style={{ 
                  padding: 'var(--space-8)', 
                  borderRadius: 'var(--border-radius-lg)', 
                  textAlign: 'center',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-4)'
                }}>
                  <div style={{ color: 'var(--primary)', opacity: 0.9 }}>{benefit.icon}</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '2px', color: 'var(--text-primary)' }}>{benefit.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="section-divider"></div>
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
