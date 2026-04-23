'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken, API_BASE } from '@/lib/api';
import Navbar from '@/components/marketing/Navbar';

export default function ResumeEnhanceMode() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('id');
  
  const [step, setStep] = useState(1);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  
  const [fileError, setFileError] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [results, setResults] = useState<{ score: number, insights: any, original: any, enhanced: any, keywords?: any, layout?: any } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [acceptedSkills, setAcceptedSkills] = useState<string[]>([]);
  const [ignoredSkills, setIgnoredSkills] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
      const res = await fetch(`${API_BASE}/api/resume/extract-text`, {
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
        setAiStatus('Analyzing Job Description...');
        
        // Progress simulation for better UX
        const statusSteps = [
            { text: 'Parsing Resume Structure...', delay: 2000 },
            { text: 'Finding Experience Gaps...', delay: 4000 },
            { text: 'Optimizing Skills & Keywords...', delay: 7000 },
            { text: 'Finalizing ATS Alignment...', delay: 9000 }
        ];
        
        statusSteps.forEach(step => {
            setTimeout(() => {
                if (isEnhancing) setAiStatus(step.text);
            }, step.delay);
        });

        try {
            const aiRes = await fetch(`${API_BASE}/api/resume/enhance`, {
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
            
            if (!aiRes.ok) {
                const errorData = await aiRes.json();
                throw new Error(errorData.detail || "AI enhancement failed");
            }
            
            const result = await aiRes.json();
            const { resume: enhancedData, match_score, insights, original_parsed } = result.data;

            setResults({ 
                score: match_score, 
                insights, 
                original: original_parsed,
                enhanced: enhancedData,
                keywords: result.data.keywords,
                layout: result.data.layout_metadata
            });
            
            // Initialize accepted skills with what AI already put in 'enhanced', 
            // but we'll let users add more from the 'missing_skills' list.
            setAcceptedSkills([]); 
            setStep(3); // Move to results/suggestions step
        } catch (err: any) {
            console.error(err);
            alert(err.message || "An error occurred during AI processing.");
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleFinalSave = async () => {
        if (!results || !resumeId) return;
        
        setIsSaving(true);
        try {
            // Combine enhanced data with user-accepted suggestions
            const finalSkills = [...new Set([...results.enhanced.skills, ...acceptedSkills])];
            
            const updateRes = await fetch(`${API_BASE}/api/resume/${resumeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    summary: results.enhanced.summary || "",
                    skills: JSON.stringify(finalSkills),
                    experience: JSON.stringify(results.enhanced.experience || []),
                    education: JSON.stringify(results.enhanced.education || []),
                    projects: JSON.stringify(results.enhanced.projects || []),
                    original_resume_text: resumeText,
                    job_description: jobDescription,
                    layout_metadata: JSON.stringify(results.layout || {})
                })
            });
            
            if (updateRes.ok) {
                router.push(`/student/resume/visual?id=${resumeId}`);
            } else {
                throw new Error("Failed to save final resume");
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSaving(false);
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
            <div style={{ flex: 1, padding: '12px', background: step >= 1 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 1 ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', fontWeight: 700, textAlign: 'center', fontSize: '13px' }}>1. Your Resume</div>
            <div style={{ flex: 1, padding: '12px', background: step >= 2 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 2 ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', fontWeight: 700, textAlign: 'center', fontSize: '13px' }}>2. Job Description</div>
            <div style={{ flex: 1, padding: '12px', background: step >= 3 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 3 ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', fontWeight: 700, textAlign: 'center', fontSize: '13px' }}>3. Results</div>
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
                            <span>{aiStatus}</span>
                          </>
                        ) : '✨ Enhance Resume'}
                    </button>
                </div>
            </div>
        )}

        {step === 3 && results && (
            <div className="card shadow-lg" style={{ padding: 'var(--space-8)', border: '1px solid var(--primary)', background: 'linear-gradient(to bottom right, var(--bg-primary), var(--primary-glow))' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                    <div style={{ 
                        width: '100px', height: '100px', borderRadius: '50%', background: 'var(--primary)', 
                        color: '#fff', fontSize: '32px', fontWeight: 800, display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                        boxShadow: '0 0 20px var(--primary-glow)'
                    }}>
                        {results.score}%
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800 }}>ATS Match Score</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Your resume has been successfully optimized for the target role.</p>
                </div>

                {/* Keyword Match Visualization */}
                <div style={{ marginBottom: 'var(--space-8)', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎯 Keyword Match Analysis
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {results.keywords?.jd_skills.map((skill: string, idx: number) => {
                            const isMatched = results.keywords.matched_skills.includes(skill.toLowerCase());
                            return (
                                <span key={idx} style={{ 
                                    padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                    background: isMatched ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: isMatched ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)',
                                    border: `1px solid ${isMatched ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}>
                                    {isMatched ? '✓' : '✗'} {skill}
                                </span>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', textTransform: 'uppercase' }}>Smart Skill Suggestions</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {results.insights.missing_skills.length > 0 ? results.insights.missing_skills.map((s:string, i:number) => {
                                const isAccepted = acceptedSkills.includes(s);
                                const isIgnored = ignoredSkills.includes(s);
                                if (isIgnored) return null;
                                return (
                                    <div key={i} style={{ 
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                        padding: '10px', background: isAccepted ? 'var(--success-glow)' : 'var(--bg-primary)', 
                                        borderRadius: '8px', border: '1px solid var(--border)' 
                                    }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{s}</span>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {!isAccepted && (
                                                <button 
                                                    onClick={() => setAcceptedSkills([...acceptedSkills, s])}
                                                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    Accept
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setIgnoredSkills([...ignoredSkills, s])}
                                                style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                {isAccepted ? 'Remove' : 'Ignore'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }) : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No new skills suggested.</span>}
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)', marginBottom: '12px', textTransform: 'uppercase' }}>Content Improvements</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {results.insights.improvements.slice(0, 4).map((imp:string, i:number) => (
                                <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                    <span style={{ color: 'var(--success)' }}>✔</span>
                                    <span>{imp}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-8)' }}>
                    <button 
                        onClick={() => setShowDiff(!showDiff)}
                        className="btn btn-outline"
                        style={{ flex: 1, padding: '16px', fontWeight: 700 }}
                    >
                        {showDiff ? 'Hide Comparison' : '🔍 Compare Changes'}
                    </button>
                    <button 
                        onClick={handleFinalSave}
                        disabled={isSaving}
                        className="btn btn-primary"
                        style={{ flex: 1.5, padding: '16px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        {isSaving ? (
                            <>
                                <div className="spinner-small" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                                Saving...
                            </>
                        ) : 'Continue to Editor →'}
                    </button>
                </div>

                {showDiff && results.original && (
                    <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-8)', borderTop: '2px solid var(--border)' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: 'var(--space-6)' }}>Before vs After Comparison</h3>
                        
                        {/* Summary Diff */}
                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Summary Transformation</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div style={{ padding: '16px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2', color: '#c53030', fontSize: '13px' }}>
                                    <strong>Before:</strong><br />{results.original.summary || 'No summary provided.'}
                                </div>
                                <div style={{ padding: '16px', background: '#f0fff4', borderRadius: '8px', border: '1px solid #9ae6b4', color: '#276749', fontSize: '13px' }}>
                                    <strong>After:</strong><br />{results.enhanced.summary}
                                </div>
                            </div>
                        </div>

                        {/* Experience Diff */}
                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Experience Improvements</h4>
                            {results.enhanced.experience.map((exp: any, i: number) => {
                                const origExp = results.original.experience?.[i] || {};
                                return (
                                    <div key={i} style={{ marginBottom: 'var(--space-4)', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                        <div style={{ fontWeight: 700, marginBottom: '8px' }}>{exp.role} @ {exp.company}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                            <ul style={{ margin: 0, paddingLeft: '18px', color: '#c53030', fontSize: '12px', listStyleType: 'circle' }}>
                                                {(origExp.bullets || []).map((b: string, j: number) => <li key={j} style={{ marginBottom: '4px' }}>{b}</li>)}
                                            </ul>
                                            <ul style={{ margin: 0, paddingLeft: '18px', color: '#276749', fontSize: '12px', fontWeight: 600 }}>
                                                {(exp.bullets || []).map((b: string, j: number) => <li key={j} style={{ marginBottom: '4px' }}>{b}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
}
