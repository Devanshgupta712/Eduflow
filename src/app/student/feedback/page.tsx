'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

export default function StudentFeedbackPage() {
    const [trainers, setTrainers] = useState<any[]>([]);
    const [selectedTrainer, setSelectedTrainer] = useState<string>('');
    const [rating, setRating] = useState<number>(0);
    const [comments, setComments] = useState<string>('');
    const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTrainer || rating === 0) {
            alert('Please select a trainer and provide a rating.');
            return;
        }

        setSubmitting(true);
        try {
            await apiPost('/api/sessions/feedback', {
                target_type: 'TRAINER',
                target_id: selectedTrainer,
                rating: rating,
                comments: comments,
                is_anonymous: isAnonymous
            });
            setSubmitted(true);
            setRating(0);
            setComments('');
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
                        Your weekly feedback has been successfully submitted. We appreciate your input as it helps us improve the training experience.
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
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '12px' }}>Weekly Feedback</h1>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    Please evaluate your trainer's performance this week. Your feedback helps us maintain a high quality of education and is mandatory to avoid policy violations.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="glass-premium" style={{ padding: '40px', borderRadius: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* Trainer Selection */}
                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Select Trainer
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

                {/* Star Rating */}
                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Overall Rating
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '16px',
                                    background: star <= rating ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
                                    border: star <= rating ? '2px solid var(--primary)' : '2px solid transparent',
                                    color: star <= rating ? 'var(--primary)' : 'var(--text-muted)',
                                    fontSize: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    transform: star <= rating ? 'scale(1.05)' : 'scale(1)'
                                }}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>

                {/* Comments */}
                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Additional Comments (Optional)
                    </label>
                    <textarea 
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="What went well? What could be improved?"
                        style={{
                            width: '100%',
                            minHeight: '140px',
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

                {/* Anonymous Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                        type="checkbox" 
                        id="anonymous"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="anonymous" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Submit anonymously (Trainer won't see your name)
                    </label>
                </div>

                {/* Submit Button */}
                <div style={{ marginTop: '16px' }}>
                    <button 
                        type="submit" 
                        disabled={submitting || trainers.length === 0 || rating === 0}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '18px',
                            borderRadius: '16px',
                            fontSize: '16px',
                            fontWeight: 700,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '12px',
                            opacity: (submitting || trainers.length === 0 || rating === 0) ? 0.6 : 1,
                            cursor: (submitting || trainers.length === 0 || rating === 0) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {submitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                </div>
            </form>
        </div>
    );
}
