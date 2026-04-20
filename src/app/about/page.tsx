'use client';

import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import CTA from '@/components/marketing/CTA';

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowX: 'hidden' }} className="bg-grid-subtle">
      <Navbar />
      
      <main>
        {/* Header Section */}
        <section className="section-padding" style={{ paddingTop: 'clamp(120px, 15vh, 180px)', background: 'var(--bg-secondary)', paddingBottom: 'var(--space-16)' }}>
          <div className="container-wide" style={{ maxWidth: '1000px', textAlign: 'center', padding: '0 var(--space-8)' }}>
            <h1 style={{ fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 700, marginBottom: 'var(--space-6)', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>Our Mission & Vision.</h1>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '800px', margin: '0 auto' }}>
              Redefining IT training since 2000. We don't just teach technology; we build careers by bridging the gap between education and industry.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section className="section-padding" style={{ padding: 'var(--space-20) 0' }}>
          <div className="container-wide" style={{ maxWidth: '1000px', padding: '0 var(--space-8)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '60px', marginBottom: 'var(--space-16)' }}>
              <div>
                <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: 'var(--space-6)', letterSpacing: '-0.02em' }}>The EduSuite.ai Story</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '17px', marginBottom: 'var(--space-6)' }}>
                  EduSuite.ai was founded with a single goal: to provide high-quality IT training that actually gets students hired. 
                  Our founders, who are veterans of the software industry, realized that traditional education often fails to prepare students 
                  for the fast-paced world of technology.
                </p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '17px' }}>
                  Today, we are proud to have trained over 70,000+ students across various domains, from Web Development to AI/ML. 
                  Our partnership with leading IT firms ensures that our curriculum is always up-to-date.
                </p>
              </div>
              <div className="hover-lift" style={{ position: 'relative' }}>
                <img 
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" 
                  alt="Team collaboration" 
                  style={{ width: '100%', borderRadius: '32px', boxShadow: 'var(--shadow-lg)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-8)', marginTop: 'var(--space-20)' }}>
              {[
                { title: 'Transparency', desc: 'No hidden fees. Pay 50% only after you get placed.' },
                { title: 'Practicality', desc: 'Live project training from day one. No outdated theories.' },
                { title: 'Community', desc: 'Join an alumni network of 70k+ professionals worldwide.' },
                { title: 'Innovation', desc: 'AI-integrated learning for the future-proof career.' }
              ].map((value, i) => (
                <div key={i} className="glass-effect" style={{ padding: '32px', borderRadius: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>{value.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{value.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTA />
      </main>

      <Footer />
    </div>
  );
}
