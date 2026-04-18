'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

const SECTIONS = [
    {
        title: "Instructor Feedback",
        scale: ["Poor", "Fair", "Satisfactory", "Very good", "Excellent"],
        questions: [
            { id: "s1_effort", label: "Level of effort trainer" },
            { id: "s1_punctuality", label: "Punctuality Of Trainer" },
        ]
    },
    {
        title: "Contribution to your learning everyday",
        scale: ["Poor", "Fair", "Satisfactory", "Very good", "Excellent"],
        questions: [
            { id: "s2_knowledge", label: "Improvement in Your Knowledge" },
            { id: "s2_confidence", label: "Your confidence level to take up interviews now" },
        ]
    },
    {
        title: "Skill and responsiveness of the instructor",
        scale: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
        questions: [
            { id: "s3_comm", label: "Instructor communication" },
            { id: "s3_org", label: "Instructor organises the concepts in an understandable order" },
            { id: "s3_encourage", label: "Instructor encourages student interest to learn more" },
            { id: "s3_time", label: "Instructor effectively used time" },
            { id: "s3_doubts", label: "Instructor availability for doubts" },
        ]
    },
    {
        title: "Course content",
        scale: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
        questions: [
            { id: "s4_obj", label: "Instructor explained the Learning objectives of each topic" },
            { id: "s4_examples", label: "Instructor gave real time examples in the class" },
            { id: "s4_assignments", label: "Instructor gave assignments and made you to work" },
            { id: "s4_interaction", label: "Instructor had personal interaction with you in the class" },
        ]
    }
];

const TRAINEE_QUESTIONS = [
    { id: "t_consistency", label: "My consistency in attending classes this week" },
    { id: "t_practice", label: "My daily practice hours (at least 2-4 hours)" },
    { id: "t_assignments", label: "Timely completion of all assignments/tasks" },
    { id: "t_confidence", label: "Confidence in topics covered this week" },
    { id: "t_participation", label: "My active participation in class discussions" },
];


export default function StudentFeedbackPage() {
    const [trainers, setTrainers] = useState<any[]>([]);
    const [selectedTrainer, setSelectedTrainer] = useState<string>('');
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [qUseful, setQUseful] = useState<string>('');
    const [qImprove, setQImprove] = useState<string>('');
    
    const [loading, setLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [submitted, setSubmitted] = useState<boolean>(false);

    useEffect(() => {
        apiGet('/api/training/my-trainers')
            .then(data => {
                setTrainers(data || []);
                if (data && data.length > 0) {
                    setSelectedTrainer(data[0].id);
                }
            })
            .catch(err => console.error("Error fetching trainers", err))
            .finally(() => setLoading(false));
    }, []);

    const handleRatingChange = (qId: string, val: number) => {
        setRatings(prev => ({ ...prev, [qId]: val }));
    };

    // Calculate if all multiple choice questions are answered
    const totalQuestions = SECTIONS.reduce((acc, section) => acc + section.questions.length, 0);
    const answeredCount = Object.keys(ratings).length;
    const isComplete = answeredCount === totalQuestions && selectedTrainer && qUseful.trim() && qImprove.trim();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isComplete) {
            alert('Please answer all questions before submitting.');
            return;
        }

        setSubmitting(true);
        
        try {
            // 1. Calculate Average Rating (out of 5)
            const sum = Object.values(ratings).reduce((a, b) => a + b, 0);
            const averageRating = Math.round(sum / totalQuestions);

            // 2. Format detailed responses into Markdown
            let formattedComments = `## Detailed Feedback Report\n\n`;
            
            SECTIONS.forEach(sec => {
                formattedComments += `### ${sec.title}\n`;
                sec.questions.forEach(q => {
                    const score = ratings[q.id];
                    const label = sec.scale[score - 1]; // 1-indexed to 0-indexed array
                    formattedComments += `- **${q.label}**: ${label} (${score}/5)\n`;
                });
                formattedComments += `\n`;
            });

            formattedComments += `### Open Feedback\n`;
            formattedComments += `**What aspects of this course were most useful or valuable?**\n${qUseful}\n\n`;
            formattedComments += `**How we can improve this course?**\n${qImprove}\n`;

            await apiPost('/api/sessions/feedback', {
                target_type: 'TRAINER',
                target_id: selectedTrainer,
                rating: averageRating,
                comments: formattedComments,
                is_anonymous: false // Hardcoded per user request
            });

            // 3. Submit Trainee Feedback (Self-Evaluation)
            const tSum = TRAINEE_QUESTIONS.reduce((a, q) => a + (ratings[q.id] || 0), 0);
            const tAvg = Math.round(tSum / TRAINEE_QUESTIONS.length);
            
            await apiPost('/api/sessions/trainee-feedback', {
                rating: tAvg,
                comments: `Self-Evaluation: ${qUseful}\nImprovement Plan: ${qImprove}`,
                week: 1 // Could be calculated
            });

            
            setSubmitted(true);
            setRatings({});
            setQUseful('');
            setQImprove('');
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-muted)' }}>Loading...</div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="reveal-on-scroll" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', paddingTop: '40px' }}>
                <div className="glass-premium" style={{ padding: '60px 40px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Thank You!</h2>
                    <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                        Your comprehensive feedback has been successfully submitted. We deeply appreciate your time and insights to help us improve the program.
                    </p>
                    <button 
                        onClick={() => setSubmitted(false)}
                        className="btn-primary"
                        style={{ padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 700 }}
                    >
                        Submit Another Review
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '12px' }}>Course Feedback</h1>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    Please evaluate your trainer's performance this week. Your honest feedback is highly valuable and is mandatory to avoid policy violations.
                </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* Trainer Selection Card */}
                <div className="glass-premium" style={{ padding: '32px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Select Trainer *
                    </label>
                    {trainers.length === 0 ? (
                        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                            No trainers found for your active batches.
                        </div>
                    ) : (
                        <select 
                            value={selectedTrainer}
                            onChange={(e) => setSelectedTrainer(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '16px', 
                                borderRadius: '12px', 
                                background: 'var(--bg-tertiary)', 
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="" disabled>Choose your trainer...</option>
                            {trainers.map(t => (
                                <option key={t.id} value={t.id}>{t.name} (Batch: {t.batch_name})</option>
                            ))}
                        </select>
                    )}
                </div>

                    </div>
                ))}

                {/* Trainee Self-Evaluation Matrix */}
                <div className="glass-premium" style={{ padding: '32px', borderRadius: '24px', border: '1px solid var(--primary-glow)', overflowX: 'auto', background: 'var(--primary-glow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <span style={{ fontSize: '24px' }}>👤</span>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                Trainee Self-Evaluation <span style={{ color: 'var(--danger)' }}>*</span>
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Evaluate your own progress and performance this week</p>
                        </div>
                    </div>
                    
                    <div style={{ minWidth: '600px' }}>
                        <div style={{ display: 'flex', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ width: '40%' }}></div>
                            <div style={{ width: '60%', display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                                {["Poor", "Fair", "Satisfactory", "Good", "Excellent"].map((label, i) => (
                                    <div key={i} style={{ width: '20%', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {TRAINEE_QUESTIONS.map((q, qIdx) => (
                            <div key={q.id} style={{ 
                                display: 'flex', padding: '16px 0', 
                                borderBottom: qIdx === TRAINEE_QUESTIONS.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                                alignItems: 'center'
                            }}>
                                <div style={{ width: '40%', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', paddingRight: '16px' }}>
                                    {q.label}
                                </div>
                                <div style={{ width: '60%', display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                                    {[1, 2, 3, 4, 5].map((val) => (
                                        <div key={val} style={{ width: '20%', display: 'flex', justifyContent: 'center' }}>
                                            <input 
                                                type="radio" name={q.id} value={val}
                                                checked={ratings[q.id] === val}
                                                onChange={() => handleRatingChange(q.id, val)}
                                                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Open Ended Questions */}
                <div className="glass-premium" style={{ padding: '32px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                            What aspects of this course were most useful or valuable? <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <textarea 
                            value={qUseful}
                            onChange={(e) => setQUseful(e.target.value)}
                            placeholder="Your answer"
                            style={{
                                width: '100%',
                                minHeight: '120px',
                                padding: '16px',
                                borderRadius: '16px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                            How we can improve this course? <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <textarea 
                            value={qImprove}
                            onChange={(e) => setQImprove(e.target.value)}
                            placeholder="Your answer"
                            style={{
                                width: '100%',
                                minHeight: '120px',
                                padding: '16px',
                                borderRadius: '16px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>
                </div>

                {/* Missing required warning */}
                {!isComplete && (
                    <div style={{ textAlign: 'right', color: 'var(--danger)', fontSize: '14px', fontWeight: 600, paddingRight: '16px' }}>
                        * Please complete all required fields
                    </div>
                )}

                {/* Submit Button */}
                <div style={{ marginBottom: '60px' }}>
                    <button 
                        type="submit" 
                        disabled={submitting || !isComplete}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '20px',
                            borderRadius: '16px',
                            fontSize: '18px',
                            fontWeight: 700,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '12px',
                            opacity: (submitting || !isComplete) ? 0.6 : 1,
                            cursor: (submitting || !isComplete) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {submitting ? 'Submitting Responses...' : 'Submit Form'}
                    </button>
                </div>
            </form>
        </div>
    );
}
