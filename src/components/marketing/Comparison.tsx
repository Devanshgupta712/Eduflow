'use client';

const ComparisonRow = ({ feature, traditional, edusuite }: { feature: string, traditional: string, edusuite: string }) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr 1fr', 
      padding: '24px 0', 
      borderBottom: '1px solid var(--border)',
      alignItems: 'center'
    }}>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>{feature}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{traditional}</div>
      <div style={{ 
        fontSize: '15px', 
        fontWeight: 600, 
        color: 'var(--primary)', 
        textAlign: 'center',
        background: 'rgba(var(--primary-h), 84%, 54%, 0.05)',
        padding: '12px',
        borderRadius: '12px'
      }}>{edusuite}</div>
    </div>
  );
};

export default function Comparison() {
  const comparisons = [
    { feature: 'Certification', traditional: 'Only Certificate', edusuite: '6-Month IT Experience' },
    { feature: 'Learning Method', traditional: 'Theory & Labs', edusuite: 'Job Immersion Program' },
    { feature: 'Placement Policy', traditional: 'Assistance', edusuite: 'Placement Guarantee' },
    { feature: 'Soft Skills', traditional: 'No Focus', edusuite: 'Soft Skill Mentorship' },
    { feature: 'MNC Standards', traditional: 'Not Covered', edusuite: 'Full MNC Exposure' }
  ];

  return (
    <section style={{ padding: '100px 0', background: '#fff' }}>
      <div className="container-wide" style={{ maxWidth: '1000px', padding: '0 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ 
            fontSize: '32px', 
            fontWeight: 800, 
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '20px'
          }}>
            Why EduSuite.ai?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>The difference between learning and being industry-ready.</p>
        </div>

        <div style={{ 
          background: '#fff', 
          borderRadius: '20px', 
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'minmax(200px, 1.5fr) 1fr 1fr', 
            padding: '24px 32px', 
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            fontSize: '14px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)'
          }}>
            <div>Features</div>
            <div style={{ textAlign: 'center' }}>Traditional</div>
            <div style={{ textAlign: 'center', color: 'var(--primary)' }}>EduSuite.ai</div>
          </div>

          {/* Rows */}
          {comparisons.map((c, i) => (
            <div key={i} style={{ 
              display: 'grid', 
              gridTemplateColumns: 'minmax(200px, 1.5fr) 1fr 1fr', 
              padding: '24px 32px', 
              borderBottom: i === comparisons.length - 1 ? 'none' : '1px solid var(--border)',
              alignItems: 'center',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.feature}</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center' }}>{c.traditional}</div>
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 700, 
                color: 'var(--primary)', 
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span style={{ color: 'var(--success)' }}>✓</span> {c.edusuite}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
