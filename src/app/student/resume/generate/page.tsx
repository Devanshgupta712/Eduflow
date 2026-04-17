'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/marketing/Navbar';

export default function ResumeGenerateMode() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('id');
  const { getToken } = useAuth();
  
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    github: '',
    linkedin: '',
    skills: '', // Comma separated
    experience: '', // Free text blocks
    projects: '',
    education: '',
    jobDescription: ''
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.jobDescription.trim()) {
      alert("Please provide the target job description.");
      return;
    }
    
    setIsGenerating(true);
    try {
        const aiRes = await fetch('/api/resume/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                basic_details: {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    location: formData.location,
                    github: formData.github,
                    linkedin: formData.linkedin,
                    skills: formData.skills,
                    experience: formData.experience,
                    projects: formData.projects,
                    education: formData.education
                },
                job_description: formData.jobDescription
            })
        });
        
        let generatedData = null;
        if (aiRes.ok) {
            const result = await aiRes.json();
            generatedData = result.data;
        } else {
            const errorData = await aiRes.json();
            throw new Error(errorData.detail || "AI generation failed");
        }

        // Save generated JSON to Resume object
        if (generatedData && resumeId) {
            const updateRes = await fetch(`/api/resume/${resumeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    personal: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone,
                        location: formData.location,
                        github: formData.github,
                        linkedin: formData.linkedin
                    }),
                    summary: generatedData.summary || "",
                    skills: JSON.stringify(generatedData.skills || []),
                    experience: JSON.stringify(generatedData.experience || []),
                    education: JSON.stringify(generatedData.education || []),
                    projects: JSON.stringify(generatedData.projects || []),
                    job_description: formData.jobDescription
                })
            });
            
            if (updateRes.ok) {
                router.push(`/student/resume/visual?id=${resumeId}`);
            } else {
                throw new Error("Failed to save generated resume");
            }
        }
    } catch (err: any) {
        console.error(err);
        alert(err.message || "An error occurred during AI processing.");
        setIsGenerating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      
      <div className="container" style={{ padding: '120px var(--space-4) var(--space-8)', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
            <button onClick={() => router.push('/student/resume')} className="btn btn-outline" style={{ border: 'none', background: 'var(--bg-secondary)' }}>←</button>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>Full AI Resume Generator</h1>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
            {[1, 2, 3, 4].map(s => (
                <div key={s} style={{ 
                    flex: 1, padding: '12px', textAlign: 'center', fontWeight: 700, borderRadius: '8px',
                    background: step >= s ? 'var(--primary)' : 'var(--bg-secondary)', 
                    color: step >= s ? '#fff' : 'var(--text-secondary)'
                }}>
                    {s === 1 ? 'Personal' : s === 2 ? 'Background' : s === 3 ? 'Target JD' : 'Generate'}
                </div>
            ))}
        </div>

        {step === 1 && (
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-6)' }}>Basic Details</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    <div>
                        <label className="form-label text-xs">Full Name</label>
                        <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                        <label className="form-label text-xs">Email</label>
                        <input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                        <label className="form-label text-xs">Phone</label>
                        <input type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                        <label className="form-label text-xs">Location</label>
                        <input type="text" value={formData.location} onChange={e => handleChange('location', e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                        <label className="form-label text-xs">LinkedIn URL</label>
                        <input type="url" value={formData.linkedin} onChange={e => handleChange('linkedin', e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                        <label className="form-label text-xs">GitHub / Portfolio URL</label>
                        <input type="url" value={formData.github} onChange={e => handleChange('github', e.target.value)} className="form-input w-full" />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                    <button onClick={() => setStep(2)} className="btn btn-primary">Next Step →</button>
                </div>
            </div>
        )}

        {step === 2 && (
             <div className="card shadow-sm" style={{ padding: 'var(--space-6)', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Your Background</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                    Provide rough details about your past. Don't worry about formatting; the AI will structure it perfectly.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <div>
                        <label className="form-label text-xs">Top Skills (comma separated)</label>
                        <input type="text" value={formData.skills} onChange={e => handleChange('skills', e.target.value)} placeholder="React, Node.js, Python, AWS..." className="form-input w-full" />
                    </div>
                    <div>
                        <label className="form-label text-xs">Education Details</label>
                        <textarea value={formData.education} onChange={e => handleChange('education', e.target.value)} placeholder="B.Tech CS from XYZ Univ, 2024, 85%" rows={2} className="form-input w-full" style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                        <label className="form-label text-xs">Work / Internship Experience</label>
                        <textarea value={formData.experience} onChange={e => handleChange('experience', e.target.value)} placeholder="Summer intern at ABC Corp. Fixed bugs in frontend using React..." rows={4} className="form-input w-full" style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                        <label className="form-label text-xs">Projects</label>
                        <textarea value={formData.projects} onChange={e => handleChange('projects', e.target.value)} placeholder="Built a weather app using React and external APIs..." rows={4} className="form-input w-full" style={{ resize: 'vertical' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
                    <button onClick={() => setStep(1)} className="btn btn-outline">← Back</button>
                    <button onClick={() => setStep(3)} className="btn btn-primary">Next Step →</button>
                </div>
            </div>
        )}

        {step === 3 && (
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Target Job Description</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                    Paste the job description. The AI will weave its keywords into your generated resume.
                </p>

                <textarea 
                    value={formData.jobDescription}
                    onChange={(e) => handleChange('jobDescription', e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={12}
                    className="form-input w-full"
                    style={{ resize: 'vertical' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
                    <button onClick={() => setStep(2)} className="btn btn-outline">← Back</button>
                    <button 
                        onClick={handleGenerate} 
                        disabled={!formData.jobDescription.trim() || isGenerating}
                        className="btn btn-primary"
                        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isGenerating ? (
                          <>
                            <div className="spinner-small" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                            <span>Generating Resume... (this takes ~10s)</span>
                          </>
                        ) : '✨ Generate Resume'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
