'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, getToken, API_BASE } from '@/lib/api';

export default function ResumeBuilderLanding() {
  const router = useRouter();
  const user = getStoredUser();
  const [loadingMode, setLoadingMode] = useState<string | null>(null);

  const hasAccess = user && (user.can_build_resume || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');

  if (user && !hasAccess) {
    return (
      <div className="container-fluid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="glass-premium" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Resume Builder Locked</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            You do not currently have access to the AI Resume Builder. Please contact your trainer or an administrator to request access.
          </p>
          <button onClick={() => router.push('/student')} className="btn btn-primary">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  const startResume = async (mode: string, route: string) => {
    setLoadingMode(mode);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `My ${mode.charAt(0).toUpperCase() + mode.slice(1)} Resume`,
          mode: mode,
          template: 'modern'
        })
      });
      
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/student/resume/${route}?id=${data.id}`);
      } else {
        alert(data.detail || 'Failed to start resume builder');
        setLoadingMode(null);
      }
    } catch (err) {
      console.error(err);
      alert('Network error occurred.');
      setLoadingMode(null);
    }
  };

  return (
    <div className="container-fluid" style={{ padding: '0 0 var(--space-12) 0' }}>
      {/* Hero Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(37, 99, 235, 0.05) 100%)',
        padding: 'var(--space-12) var(--space-8)',
        borderBottom: '1px solid var(--border)',
        marginBottom: 'var(--space-8)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '40px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--space-3)', letterSpacing: '-1px' }}>
          AI Resume Builder
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
          Create an ATS-optimized resume in minutes. Choose a builder mode below to start crafting your professional story.
        </p>
      </div>

      <div style={{ padding: '0 var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        
        {/* Mode 1 */}
        <div className="card shadow-sm" style={{ display: 'flex', flexDirection: 'column', height: '100%', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
          <div style={{ 
            height: '140px', 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px',
            borderBottom: '1px solid var(--border)'
          }}>
            📝
          </div>
          <div style={{ padding: 'var(--space-6)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Visual Editor</h2>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ATS Optimized</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, flex: 1 }}>
              Build manually using our step-by-step visual editor. Complete control over every bullet point with live preview and 4 ATS-friendly templates.
            </p>
            <button 
              onClick={() => startResume('visual', 'visual')}
              disabled={loadingMode !== null}
              className="btn btn-outline" 
              style={{ width: '100%', marginTop: 'var(--space-5)', padding: '12px' }}
            >
              {loadingMode === 'visual' ? 'Starting...' : 'Start Building →'}
            </button>
          </div>
        </div>

        {/* Mode 2 */}
        <div className="card shadow-md" style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '2px solid var(--primary)', transition: 'transform 0.2s', cursor: 'pointer', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
          <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommended</div>
          <div style={{ 
            height: '140px', 
            background: 'linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: '#fff'
          }}>
            🤖
          </div>
          <div style={{ padding: 'var(--space-6)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>AI Enhance</h2>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Llama 3 Powered</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, flex: 1 }}>
              Upload your existing resume and a target Job Description. Our AI will automatically rewrite your summary and bullets to align perfectly with the role.
            </p>
            <button 
                onClick={() => startResume('enhanced', 'enhance')}
                disabled={loadingMode !== null}
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 'var(--space-5)', padding: '12px' }}
            >
              {loadingMode === 'enhanced' ? 'Starting...' : 'Enhance My Resume →'}
            </button>
          </div>
        </div>

        {/* Mode 3 */}
        <div className="card shadow-sm" style={{ display: 'flex', flexDirection: 'column', height: '100%', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
          <div style={{ 
            height: '140px', 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(109, 40, 217, 0.05) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px',
            borderBottom: '1px solid var(--border)'
          }}>
            ✨
          </div>
          <div style={{ padding: 'var(--space-6)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Full AI Generate</h2>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', background: 'rgba(139, 92, 246, 0.1)', color: 'rgb(109, 40, 217)', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Auto-Pilot</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, flex: 1 }}>
              Just give us your basic info, past experience points, and a target Job Description. Our AI builds a complete, highly optimized resume from scratch.
            </p>
            <button 
              onClick={() => startResume('ai_generated', 'generate')}
              disabled={loadingMode !== null}
              className="btn btn-outline" 
              style={{ width: '100%', marginTop: 'var(--space-5)', padding: '12px' }}
            >
              {loadingMode === 'ai_generated' ? 'Starting...' : 'Generate New Resume →'}
            </button>
          </div>
        </div>

      </div>
    </div>

      <div style={{ marginTop: 'var(--space-12)', padding: '0 var(--space-6)' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Saved Resumes</h3>
        <SavedResumesList />
      </div>
    </div>
  );
}

// Subcomponent to list previously created resumes
function SavedResumesList() {
  const router = useRouter();
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resume`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResumes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Basic inline confirmation
    if (!window.confirm("Are you sure you want to delete this resume?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/resume/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        setResumes(prev => prev.filter(r => r.id !== id));
      } else {
        alert("Failed to delete resume");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/resume/${id}/set-primary`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        setResumes(prev => prev.map(r => ({ ...r, is_primary: r.id === id })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-8)', borderRadius: 'var(--border-radius)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your saved resumes...</p>
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-8)', borderRadius: 'var(--border-radius)', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No resumes yet</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Create your first resume using one of the options above.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
      {resumes.map(r => (
        <div key={r.id} className="card shadow-sm" style={{ padding: '20px', border: r.is_primary ? '2px solid var(--primary)' : '1px solid var(--border)', position: 'relative' }}>
          {r.is_primary && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--primary)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>★ Primary</div>}
          
          <h4 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{r.title}</h4>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '4px', textTransform: 'capitalize' }}>Mode: {r.mode}</span>
            <span style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '4px', textTransform: 'capitalize' }}>Theme: {r.template}</span>
          </div>
          
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Updated: {new Date(r.updated_at).toLocaleDateString()}
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button onClick={() => router.push(`/student/resume/visual?id=${r.id}`)} className="btn btn-primary btn-sm" style={{ padding: '8px', fontSize: '12px' }}>✏️ Edit</button>
            <button onClick={() => window.open(`${API_BASE}/api/resume/${r.id}/export?template=${r.template}&token=${getToken()}`, '_blank')} className="btn btn-outline btn-sm" style={{ padding: '8px', fontSize: '12px' }}>📥 PDF</button>
            <button onClick={() => handleSetPrimary(r.id)} className="btn btn-outline btn-sm" style={{ padding: '8px', fontSize: '12px', gridColumn: 'span 1' }} disabled={r.is_primary}>⭐ Star</button>
            <button onClick={() => handleDelete(r.id)} className="btn btn-outline btn-sm" style={{ padding: '8px', fontSize: '12px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>🗑️ Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
