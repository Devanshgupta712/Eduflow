'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/marketing/Navbar';

export default function ResumeEnhanceMode() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('id');
  const { getToken } = useAuth();
  
  const [step, setStep] = useState(1);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  
  const [fileError, setFileError] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (file.type !== 'application/pdf' && !file.name.endsWith('.docx')) {
      setFileError('Please upload a PDF or DOCX file.');
      return;
    }
    setFileError('');
    setIsExtracting(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/resume/extract-text', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (res.ok) {
        setResumeText(data.text);
      } else {
        setFileError(data.detail || 'Failed to extract text from file.');
      }
    } catch (err) {
      console.error(err);
      setFileError('Network error during file extraction.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Mock an event object for handleFileUpload
      await handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
    }
  };

  const handleEnhance = async () => {
    if (!resumeText.trim() || !jobDescription.trim()) {
      alert("Please provide both your resume and the job description.");
      return;
    }
    
    setIsEnhancing(true);
    try {
        // 1. Call AI to generate enhanced JSON
        const aiRes = await fetch('/api/resume/enhance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                resume_text: resumeText,
                job_description: jobDescription
            })
        });
        
        let enhancedData = null;
        if (aiRes.ok) {
            const result = await aiRes.json();
            enhancedData = result.data;
        } else {
            const errorData = await aiRes.json();
            throw new Error(errorData.detail || "AI enhancement failed");
        }

        // 2. Save the enhanced JSON back to the Resume object
        if (enhancedData && resumeId) {
            const updateRes = await fetch(`/api/resume/${resumeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    summary: enhancedData.summary || "",
                    skills: JSON.stringify(enhancedData.skills || []),
                    experience: JSON.stringify(enhancedData.experience || []),
                    education: JSON.stringify(enhancedData.education || []),
                    projects: JSON.stringify(enhancedData.projects || []),
                    original_resume_text: resumeText,
                    job_description: jobDescription
                })
            });
            
            if (updateRes.ok) {
                // Navigate to visual editor to review/edit
                router.push(`/student/resume/visual?id=${resumeId}`);
            } else {
                throw new Error("Failed to save enhanced resume");
            }
        }
    } catch (err: any) {
        console.error(err);
        alert(err.message || "An error occurred during AI processing.");
        setIsEnhancing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      
      <div className="container" style={{ padding: '120px var(--space-4) var(--space-8)', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
            <button onClick={() => router.push('/student/resume')} className="btn btn-outline" style={{ border: 'none', background: 'var(--bg-secondary)' }}>←</button>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>AI Resume Enhancement</h1>
        </div>
        
        {/* Progress Tracker */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
            <div style={{ flex: 1, padding: '12px', background: step >= 1 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 1 ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', fontWeight: 700, textAlign: 'center' }}>1. Your Resume</div>
            <div style={{ flex: 1, padding: '12px', background: step >= 2 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 2 ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', fontWeight: 700, textAlign: 'center' }}>2. Job Description</div>
        </div>

        {step === 1 && (
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Provide Your Current Resume</h2>
                
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '14px' }}>Option A: Upload File (PDF or DOCX)</label>
                    <div 
                      onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                      style={{ 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        width: '100%', padding: '32px 16px', border: dragActive ? '2px dashed var(--primary)' : '2px dashed var(--border)', 
                        borderRadius: '12px', background: dragActive ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                        transition: 'all 0.2s', cursor: 'pointer', textAlign: 'center'
                      }}
                      onClick={() => document.getElementById('resume-upload')?.click()}
                    >
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                      <p style={{ fontWeight: 700, marginBottom: '4px' }}>Drag and drop your resume here</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Supports PDF and DOCX</p>
                      <span className="btn btn-outline btn-sm">Browse Files</span>
                      <input 
                          id="resume-upload"
                          type="file" 
                          accept=".pdf,.docx" 
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                      />
                    </div>
                    {isExtracting && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginTop: '12px', fontWeight: 600 }}><div className="spinner-small" style={{ border: '2px solid rgba(37,99,235,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> Extracting text...</div>}
                    {fileError && <p style={{ fontSize: '14px', color: 'var(--danger)', marginTop: '8px', fontWeight: 500 }}>{fileError}</p>}
                </div>
                
                <div style={{ textAlign: 'center', margin: '20px 0', color: 'var(--text-secondary)', fontWeight: 700 }}>OR</div>
                
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '14px' }}>Option B: Paste Resume Text</label>
                    <textarea 
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        placeholder="Paste your full resume text here..."
                        rows={12}
                        style={{ width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'vertical', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '13px' }}
                    />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                    <button 
                        onClick={() => setStep(2)} 
                        disabled={!resumeText.trim()}
                        className="btn btn-primary"
                    >
                        Next Step →
                    </button>
                </div>
            </div>
        )}

        {step === 2 && (
             <div className="card shadow-sm" style={{ padding: 'var(--space-6)', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Target Job Description</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                    Paste the full job description you are applying for. The AI will analyze the keywords, required skills, and formatting to tailor your resume specifically for this role.
                </p>
                
                <textarea 
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={12}
                    style={{ width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'vertical', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px' }}
                />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
                    <button 
                        onClick={() => setStep(1)} 
                        className="btn btn-outline"
                    >
                        ← Back
                    </button>
                    <button 
                        onClick={handleEnhance} 
                        disabled={!jobDescription.trim() || isEnhancing}
                        className="btn btn-primary"
                        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isEnhancing ? (
                          <>
                            <div className="spinner-small" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                            <span>AI is restructuring your resume... (this takes ~10s)</span>
                          </>
                        ) : '✨ Enhance Resume'}
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
