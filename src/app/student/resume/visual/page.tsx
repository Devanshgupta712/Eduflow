'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken, API_BASE } from '@/lib/api';
import Navbar from '@/components/marketing/Navbar';

export default function VisualResumeEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resume, setResume] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('personal');

  // For AI rewrite
  const [rewritingIndex, setRewritingIndex] = useState<number | null>(null);

  // Auto-save ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (!resumeId) {
      router.push('/student/resume');
      return;
    }
    fetchResume();
  }, [resumeId]);

  const fetchResume = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resume/${resumeId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Ensure arrays and objects exist
        if (!data.personal) data.personal = {};
        if (!data.experience) data.experience = [];
        if (!data.education) data.education = [];
        if (!data.projects) data.projects = [];
        if (!data.certifications) data.certifications = [];
        // Normalize skills to string array (AI sometimes returns categorized objects)
        let flatSkills: string[] = [];
        if (data.skills && Array.isArray(data.skills)) {
          for (let s of data.skills) {
            if (typeof s === 'string') {
              flatSkills.push(s);
            } else if (typeof s === 'object' && s !== null) {
              if (s.category && s.items && Array.isArray(s.items)) {
                flatSkills.push(`${s.category}: ${s.items.join(', ')}`);
              } else if (s.items && Array.isArray(s.items)) {
                flatSkills.push(...s.items);
              } else if (s.name) {
                flatSkills.push(s.name);
              } else {
                Object.values(s).forEach((val: any) => {
                  if (typeof val === 'string') flatSkills.push(val);
                  else if (Array.isArray(val)) flatSkills.push(...val);
                });
              }
            }
          }
        }
        data.skills = [...new Set(flatSkills)].filter(Boolean);
        setResume(data);
      } else {
        alert("Failed to load resume");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (showToast = true) => {
    if (!resume) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/resume/${resumeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          title: resume.title,
          template: resume.template,
          personal: JSON.stringify(resume.personal),
          summary: resume.summary,
          skills: JSON.stringify(resume.skills),
          experience: JSON.stringify(resume.experience),
          education: JSON.stringify(resume.education),
          projects: JSON.stringify(resume.projects),
          certifications: JSON.stringify(resume.certifications),
        })
      });
      if (!res.ok) throw new Error("Failed to save");
      if (showToast) {
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Debounced auto-save
  const handleChange = (updater: (prev: any) => any) => {
    setResume((prev: any) => {
      const updated = updater(prev);
      return updated;
    });
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(true);
    }, 2000);
  };

  const updatePersonal = (field: string, value: string) => {
    handleChange(prev => ({
      ...prev,
      personal: { ...prev.personal, [field]: value }
    }));
  };

  const handleAiRewrite = async (section: string, content: string, index: number | null = null) => {
    if (!content.trim()) return;
    setRewritingIndex(index !== null ? index : -1);
    try {
      const res = await fetch(`${API_BASE}/api/resume/${resumeId}/ai-rewrite-section`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          section_name: section,
          section_content: content,
          job_description: resume.job_description || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        
        if (section === 'Summary') {
          handleChange(prev => ({ ...prev, summary: data.content }));
        } else if (section === 'Skills') {
          // AI returns a comma separated list or similar
          const newSkills = data.content.split(',').map((s: string) => s.trim()).filter(Boolean);
          handleChange(prev => ({ ...prev, skills: newSkills }));
        } else if (section === 'Project Description' && index !== null) {
          handleChange(prev => {
            const newProjects = [...prev.projects];
            newProjects[index].description = data.content;
            return { ...prev, projects: newProjects };
          });
        } else if (section === 'Experience Bullet' && index !== null) {
          // data.content contains the new bullet
          const bulletParts = index.toString().split('-');
          const expIdx = parseInt(bulletParts[0]);
          const bulletIdx = parseInt(bulletParts[1]);
          
          handleChange(prev => {
            const newExp = [...prev.experience];
            if (!newExp[expIdx].bullets) newExp[expIdx].bullets = [];
            newExp[expIdx].bullets[bulletIdx] = data.content;
            return { ...prev, experience: newExp };
          });
        }
      }
    } catch (err) {
      console.error(err);
      alert("AI rewrite failed");
    } finally {
      setRewritingIndex(null);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Editor...</div>;
  if (!resume) return <div style={{ padding: '40px', textAlign: 'center' }}>Resume not found.</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      
      {/* Toast Notification */}
      {showSavedToast && (
        <div style={{ position: 'fixed', top: '100px', right: '20px', background: 'var(--success)', color: 'white', padding: '8px 16px', borderRadius: '4px', zIndex: 1000, fontWeight: 700 }}>
          ✓ Saved Draft
        </div>
      )}

      {/* Top action bar */}
      <div style={{ padding: 'var(--space-4) var(--space-8)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button onClick={() => router.push('/student/resume')} className="btn btn-outline" style={{ border: 'none', background: 'transparent' }}>← Back</button>
          <input 
            type="text" 
            value={resume.title} 
            onChange={(e) => handleChange(prev => ({ ...prev, title: e.target.value }))}
            style={{ fontSize: '18px', fontWeight: 700, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <select 
            value={resume.template}
            onChange={(e) => handleChange(prev => ({ ...prev, template: e.target.value }))}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', fontWeight: 600 }}
          >
            <option value="modern">Modern (Standard)</option>
            <option value="classic">Classic (Serif)</option>
            <option value="minimal">Minimal (Clean)</option>
            <option value="tech">Tech (Monospace)</option>
            <option value="executive">Executive (Premium)</option>
            <option value="creative">Creative (Bold)</option>
            <option value="harvard">Harvard (Traditional)</option>
          </select>
          <button onClick={() => handleSave(true)} className="btn btn-outline" disabled={saving}>
            {saving ? 'Saving...' : '💾 Save'}
          </button>
          <button onClick={() => window.open(`${API_BASE}/api/resume/${resumeId}/export?template=${resume.template}&token=${getToken()}`, '_blank')} className="btn btn-primary">
            📥 Export PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Editor Panel */}
        <div style={{ width: '500px', background: 'var(--bg-primary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 var(--space-2)' }}>
            {['personal', 'summary', 'skills', 'experience', 'education', 'projects', 'certifications'].map(tab => (
              <button 
                key={tab} onClick={() => setActiveTab(tab)}
                style={{ 
                  padding: '16px 12px', background: 'transparent', border: 'none', 
                  borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab ? 700 : 500, textTransform: 'capitalize', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ padding: 'var(--space-6)', overflowY: 'auto', flex: 1 }}>
            
            {activeTab === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {['name', 'email', 'phone', 'location', 'linkedin', 'github'].map(field => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{field}</label>
                    <input type={field === 'email' ? 'email' : 'text'} value={resume.personal[field] || ''} onChange={e => updatePersonal(field, e.target.value)} className="form-input w-full" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'summary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Professional Summary</label>
                  <button 
                    onClick={() => handleAiRewrite('Summary', resume.summary, -1)}
                    disabled={rewritingIndex === -1}
                    className="btn" style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--primary-glow)', color: 'var(--primary)', border: 'none', borderRadius: '4px' }}
                  >
                    {rewritingIndex === -1 ? '✨ Rewriting...' : '✨ AI Rewrite'}
                  </button>
                </div>
                <textarea 
                  value={resume.summary || ''} onChange={e => handleChange(prev => ({...prev, summary: e.target.value}))}
                  rows={8} className="form-input w-full" style={{ resize: 'vertical' }}
                />
              </div>
            )}

            {activeTab === 'skills' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>Skills (Press Enter to add)</p>
                  <button 
                    onClick={() => handleAiRewrite('Skills', resume.skills.join(', '), -2)}
                    disabled={rewritingIndex === -2}
                    className="btn" style={{ fontSize: '11px', padding: '2px 6px', background: 'var(--primary-glow)', color: 'var(--primary)', border: 'none', borderRadius: '4px' }}
                  >
                    {rewritingIndex === -2 ? '✨ Improving...' : '✨ Smart Grouping'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  {resume.skills.map((skill: any, idx: number) => {
                    const skillStr = typeof skill === 'object' ? skill.name || JSON.stringify(skill) : skill;
                    return (
                      <div key={idx} style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {skillStr}
                        <button onClick={() => handleChange(prev => ({ ...prev, skills: prev.skills.filter((_:any, i:number) => i !== idx) }))} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>×</button>
                      </div>
                    );
                  })}
                </div>
                <input 
                  type="text" className="form-input w-full" placeholder="e.g. React, Python, Data Analysis"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const val = e.currentTarget.value.trim();
                      handleChange(prev => ({ ...prev, skills: [...prev.skills, val] }));
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            )}

            {activeTab === 'experience' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {resume.experience.map((exp: any, expIdx: number) => (
                  <div key={expIdx} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', position: 'relative' }}>
                    <button 
                      onClick={() => handleChange(prev => ({ ...prev, experience: prev.experience.filter((_:any, i:number) => i !== expIdx) }))}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                    >🗑️</button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <input type="text" placeholder="Company" value={exp.company || ''} onChange={e => handleChange(prev => { const n = [...prev.experience]; n[expIdx].company = e.target.value; return {...prev, experience: n}; })} className="form-input" />
                      <input type="text" placeholder="Role" value={exp.role || ''} onChange={e => handleChange(prev => { const n = [...prev.experience]; n[expIdx].role = e.target.value; return {...prev, experience: n}; })} className="form-input" />
                      <input type="text" placeholder="From (e.g. Jan 2020)" value={exp.from || ''} onChange={e => handleChange(prev => { const n = [...prev.experience]; n[expIdx].from = e.target.value; return {...prev, experience: n}; })} className="form-input" />
                      <input type="text" placeholder="To (e.g. Present)" value={exp.to || ''} onChange={e => handleChange(prev => { const n = [...prev.experience]; n[expIdx].to = e.target.value; return {...prev, experience: n}; })} className="form-input" />
                    </div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Bullets</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      {exp.bullets?.map((bullet: string, bIdx: number) => {
                        const indexKey = parseInt(`${expIdx}${bIdx}`);
                        return (
                        <div key={bIdx} style={{ display: 'flex', gap: '8px' }}>
                          <textarea 
                            value={typeof bullet === 'object' ? JSON.stringify(bullet) : bullet} rows={2} className="form-input w-full"
                            onChange={e => handleChange(prev => { const n = [...prev.experience]; n[expIdx].bullets[bIdx] = e.target.value; return {...prev, experience: n}; })}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button onClick={() => handleChange(prev => { const n = [...prev.experience]; n[expIdx].bullets.splice(bIdx, 1); return {...prev, experience: n}; })} className="btn btn-outline" style={{ padding: '4px', fontSize: '12px', color: 'var(--danger)', border: 'none' }}>✕</button>
                            <button 
                              onClick={() => handleAiRewrite('Experience Bullet', bullet, indexKey)}
                              disabled={rewritingIndex === indexKey}
                              className="btn btn-outline" style={{ padding: '4px', fontSize: '12px', color: 'var(--primary)', border: 'none' }} title="AI Rewrite"
                            >✨</button>
                          </div>
                        </div>
                      )})}
                      <button onClick={() => handleChange(prev => { const n = [...prev.experience]; if (!n[expIdx].bullets) n[expIdx].bullets = []; n[expIdx].bullets.push(''); return {...prev, experience: n}; })} className="btn btn-outline" style={{ fontSize: '12px', padding: '6px' }}>+ Add Bullet</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => handleChange(prev => ({ ...prev, experience: [...prev.experience, { company: '', role: '', from: '', to: '', bullets: [''] }] }))} className="btn btn-primary">+ Add Experience</button>
              </div>
            )}

            {activeTab === 'education' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {resume.education.map((edu: any, idx: number) => (
                  <div key={idx} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', position: 'relative' }}>
                    <button onClick={() => handleChange(prev => ({ ...prev, education: prev.education.filter((_:any, i:number) => i !== idx) }))} style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                      <input type="text" placeholder="Degree / Certificate" value={edu.degree || ''} onChange={e => handleChange(prev => { const n = [...prev.education]; n[idx].degree = e.target.value; return {...prev, education: n}; })} className="form-input" />
                      <input type="text" placeholder="School / University" value={edu.school || ''} onChange={e => handleChange(prev => { const n = [...prev.education]; n[idx].school = e.target.value; return {...prev, education: n}; })} className="form-input" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <input type="text" placeholder="Year" value={edu.year || ''} onChange={e => handleChange(prev => { const n = [...prev.education]; n[idx].year = e.target.value; return {...prev, education: n}; })} className="form-input" />
                        <input type="text" placeholder="Grade / CGPA (Optional)" value={edu.grade || ''} onChange={e => handleChange(prev => { const n = [...prev.education]; n[idx].grade = e.target.value; return {...prev, education: n}; })} className="form-input" />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => handleChange(prev => ({ ...prev, education: [...prev.education, { degree: '', school: '', year: '', grade: '' }] }))} className="btn btn-primary">+ Add Education</button>
              </div>
            )}

            {activeTab === 'projects' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {resume.projects.map((proj: any, idx: number) => (
                  <div key={idx} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', position: 'relative' }}>
                    <button onClick={() => handleChange(prev => ({ ...prev, projects: prev.projects.filter((_:any, i:number) => i !== idx) }))} style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" placeholder="Project Name" value={proj.name || ''} onChange={e => handleChange(prev => { const n = [...prev.projects]; n[idx].name = e.target.value; return {...prev, projects: n}; })} className="form-input" />
                      <input type="text" placeholder="Tech Stack (e.g. React, Node)" value={proj.tech || ''} onChange={e => handleChange(prev => { const n = [...prev.projects]; n[idx].tech = e.target.value; return {...prev, projects: n}; })} className="form-input" />
                      <input type="url" placeholder="Link (Optional)" value={proj.link || ''} onChange={e => handleChange(prev => { const n = [...prev.projects]; n[idx].link = e.target.value; return {...prev, projects: n}; })} className="form-input" />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Description</label>
                        <button 
                          onClick={() => handleAiRewrite('Project Description', proj.description, idx)}
                          disabled={rewritingIndex === idx}
                          style={{ fontSize: '10px', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                        >✨ AI Improve</button>
                      </div>
                      <textarea placeholder="Description" rows={3} value={proj.description || ''} onChange={e => handleChange(prev => { const n = [...prev.projects]; n[idx].description = e.target.value; return {...prev, projects: n}; })} className="form-input" />
                    </div>
                  </div>
                ))}
                <button onClick={() => handleChange(prev => ({ ...prev, projects: [...prev.projects, { name: '', tech: '', link: '', description: '' }] }))} className="btn btn-primary">+ Add Project</button>
              </div>
            )}

            {activeTab === 'certifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {resume.certifications.map((cert: any, idx: number) => (
                  <div key={idx} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', position: 'relative' }}>
                    <button onClick={() => handleChange(prev => ({ ...prev, certifications: prev.certifications.filter((_:any, i:number) => i !== idx) }))} style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" placeholder="Certification Name" value={cert.name || ''} onChange={e => handleChange(prev => { const n = [...prev.certifications]; n[idx].name = e.target.value; return {...prev, certifications: n}; })} className="form-input" />
                      <input type="text" placeholder="Issuer (e.g. Coursera, AWS)" value={cert.issuer || ''} onChange={e => handleChange(prev => { const n = [...prev.certifications]; n[idx].issuer = e.target.value; return {...prev, certifications: n}; })} className="form-input" />
                      <input type="text" placeholder="Date" value={cert.date || ''} onChange={e => handleChange(prev => { const n = [...prev.certifications]; n[idx].date = e.target.value; return {...prev, certifications: n}; })} className="form-input" />
                    </div>
                  </div>
                ))}
                <button onClick={() => handleChange(prev => ({ ...prev, certifications: [...prev.certifications, { name: '', issuer: '', date: '' }] }))} className="btn btn-primary">+ Add Certification</button>
              </div>
            )}

          </div>
        </div>

        {/* Live Preview Panel */}
        <div style={{ flex: 1, background: '#e5e7eb', padding: 'var(--space-8)', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          
          <div style={{ 
            width: '210mm', minHeight: '297mm', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '20mm',
            color: '#000', 
            fontFamily: resume.template === 'classic' || resume.template === 'executive' || resume.template === 'harvard' ? 'serif' : resume.template === 'tech' ? 'monospace' : 'sans-serif',
            position: 'relative',
            display: resume.template === 'creative' ? 'flex' : 'block'
          }}>
            {/* Creative Sidebar */}
            {resume.template === 'creative' && (
               <div style={{ width: '30%', background: '#111827', color: '#fff', margin: '-20mm 0 -20mm -20mm', padding: '20mm 15px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ width: '80px', height: '80px', background: '#2563eb', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800 }}>
                    {resume.personal.name ? resume.personal.name[0] : 'Y'}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '10px', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px' }}>Contact</h4>
                    <div style={{ fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                       <div>{resume.personal.email}</div>
                       <div>{resume.personal.phone}</div>
                       <div>{resume.personal.location}</div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '10px', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px' }}>Skills</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                       {resume.skills.map((s:any, i:number) => (
                         <span key={i} style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                           {typeof s === 'object' ? s.name || JSON.stringify(s) : s}
                         </span>
                       ))}
                    </div>
                  </div>
               </div>
            )}

            <div style={{ flex: 1, paddingLeft: resume.template === 'creative' ? '24px' : '0' }}>
            <h1 style={{ 
              fontSize: resume.template === 'executive' ? '28pt' : '24pt', 
              fontWeight: 800, 
              textAlign: (resume.template === 'modern' || resume.template === 'executive' || resume.template === 'harvard') ? 'center' : 'left', 
              marginBottom: '8px', 
              color: (resume.template === 'modern' || resume.template === 'creative') ? '#2563eb' : (resume.template === 'executive' ? '#1a365d' : '#000'), 
              textTransform: 'uppercase',
              letterSpacing: resume.template === 'executive' ? '2px' : 'normal'
            }}>
              {resume.personal.name || 'Your Name'}
            </h1>
            <p style={{ textAlign: (resume.template === 'modern' || resume.template === 'executive' || resume.template === 'harvard') ? 'center' : 'left', fontSize: '10pt', marginBottom: '24px', color: '#666' }}>
              {[resume.personal.email, resume.personal.phone, resume.personal.location, resume.personal.linkedin].filter(Boolean).join(' | ')}
            </p>
            
            {resume.summary && (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ 
                  fontSize: '12pt', fontWeight: 700, 
                  borderBottom: resume.template === 'minimal' ? '1px solid #eee' : (resume.template === 'executive' ? '1px solid #cbd5e0' : '2px solid #000'), 
                  paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', 
                  color: resume.template === 'modern' ? '#2563eb' : (resume.template === 'executive' ? '#1a365d' : '#000'),
                  display: 'flex', alignItems: 'center'
                }}>
                  {resume.template === 'executive' ? 'Executive Profile' : 'Summary'}
                  {resume.template === 'executive' && <span style={{ flex: 1, height: '1px', background: '#cbd5e0', marginLeft: '15px' }}></span>}
                </h2>
                <p style={{ fontSize: '10.5pt', lineHeight: 1.5, fontStyle: resume.template === 'executive' ? 'italic' : 'normal' }}>{resume.summary}</p>
              </div>
            )}
            
            {resume.experience && resume.experience.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ 
                    fontSize: '12pt', fontWeight: 700, 
                    borderBottom: resume.template === 'minimal' ? '1px solid #eee' : (resume.template === 'executive' ? 'none' : '2px solid #000'), 
                    paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', 
                    color: resume.template === 'modern' ? '#2563eb' : (resume.template === 'executive' ? '#1a365d' : '#000'),
                    display: 'flex', alignItems: 'center'
                  }}>
                    Experience
                    {resume.template === 'executive' && <span style={{ flex: 1, height: '1px', background: '#cbd5e0', marginLeft: '15px' }}></span>}
                  </h2>
                  {resume.experience.map((exp: any, i: number) => (
                    <div key={i} style={{ marginBottom: '16px', borderLeft: resume.template === 'creative' ? '2px solid #3b82f6' : 'none', paddingLeft: resume.template === 'creative' ? '12px' : '0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '11pt' }}>{exp.role}</span>
                        <span style={{ fontWeight: 700, fontSize: '10pt', color: '#555' }}>{exp.from} - {exp.to}</span>
                      </div>
                      <div style={{ fontStyle: 'italic', fontSize: '10pt', color: resume.template === 'creative' ? '#3b82f6' : '#555', marginBottom: '4px', fontWeight: resume.template === 'creative' ? 600 : 400 }}>{exp.company}</div>
                      {exp.bullets && exp.bullets.length > 0 && (
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '10.5pt' }}>
                          {exp.bullets.map((b: any, j: number) => {
                             const bulletStr = typeof b === 'object' ? JSON.stringify(b) : b;
                             if (typeof bulletStr === 'string' && bulletStr.trim()) {
                               return <li key={j} style={{ marginBottom: '4px' }}>{bulletStr}</li>;
                             }
                             return null;
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            )}
            {resume.skills && resume.skills.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ 
                  fontSize: '12pt', fontWeight: 700, 
                  borderBottom: resume.template === 'minimal' ? '1px solid #eee' : (resume.template === 'executive' ? 'none' : '2px solid #000'), 
                  paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', 
                  color: resume.template === 'modern' ? '#2563eb' : (resume.template === 'executive' ? '#1a365d' : '#000'),
                  display: 'flex', alignItems: 'center'
                }}>
                  Skills
                  {resume.template === 'executive' && <span style={{ flex: 1, height: '1px', background: '#cbd5e0', marginLeft: '15px' }}></span>}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {resume.skills.map((skill: any, i: number) => {
                    const skillStr = typeof skill === 'object' ? skill.name || JSON.stringify(skill) : skill;
                    return (
                      <span key={i} style={{ padding: '4px 8px', fontSize: '10pt', color: '#333', background: resume.template === 'tech' ? '#fff' : '#f3f4f6', border: resume.template === 'tech' ? 'none' : '1px solid #e5e7eb', borderRadius: '4px' }}>{skillStr}{resume.template === 'tech' ? (i < resume.skills.length - 1 ? ', ' : '') : ''}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {resume.projects && resume.projects.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ 
                    fontSize: '12pt', fontWeight: 700, 
                    borderBottom: resume.template === 'minimal' ? '1px solid #eee' : (resume.template === 'executive' ? 'none' : '2px solid #000'), 
                    paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', 
                    color: resume.template === 'modern' ? '#2563eb' : (resume.template === 'executive' ? '#1a365d' : '#000'),
                    display: 'flex', alignItems: 'center'
                  }}>
                    Projects
                    {resume.template === 'executive' && <span style={{ flex: 1, height: '1px', background: '#cbd5e0', marginLeft: '15px' }}></span>}
                  </h2>
                  {resume.projects.map((proj: any, i: number) => (
                    <div key={i} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: '11pt' }}>{proj.name}</span>
                        <span style={{ fontSize: '10pt', color: '#555' }}>{proj.link}</span>
                      </div>
                      <div style={{ fontStyle: 'italic', fontSize: '10pt', color: resume.template === 'creative' ? '#3b82f6' : '#555', marginBottom: '4px', fontWeight: resume.template === 'creative' ? 600 : 400 }}>{proj.tech}</div>
                      <p style={{ margin: 0, fontSize: '10.5pt' }}>{proj.description}</p>
                    </div>
                  ))}
              </div>
            )}

            {resume.education && resume.education.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ 
                    fontSize: '12pt', fontWeight: 700, 
                    borderBottom: resume.template === 'minimal' ? '1px solid #eee' : (resume.template === 'executive' ? 'none' : '2px solid #000'), 
                    paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', 
                    color: resume.template === 'modern' ? '#2563eb' : (resume.template === 'executive' ? '#1a365d' : '#000'),
                    display: 'flex', alignItems: 'center'
                  }}>
                    Education
                    {resume.template === 'executive' && <span style={{ flex: 1, height: '1px', background: '#cbd5e0', marginLeft: '15px' }}></span>}
                  </h2>
                  {resume.education.map((edu: any, i: number) => (
                    <div key={i} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '10.5pt' }}>{edu.degree}</div>
                        <div style={{ fontSize: '9.5pt', color: '#555' }}>{edu.school}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '10pt', color: '#555' }}>{edu.year}</div>
                        <div style={{ fontSize: '9.5pt', color: '#555' }}>{edu.grade}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {resume.certifications && resume.certifications.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '12pt', fontWeight: 700, borderBottom: resume.template === 'minimal' ? '1px solid #eee' : '2px solid #000', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', color: resume.template === 'modern' ? '#2563eb' : '#000' }}>Certifications</h2>
                  {resume.certifications.map((cert: any, i: number) => (
                    <div key={i} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '10.5pt' }}>{cert.name}</div>
                        <div style={{ fontSize: '9.5pt', color: '#555' }}>{cert.issuer}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '10pt', color: '#555' }}>{cert.date}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

          </div>
        </div>
      </div>

      </div>
    </div>
  );
}
