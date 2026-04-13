import React from 'react';

export default function SkeletonLoader({ count = 3, type = 'card' }: { count?: number; type?: 'card' | 'row' | 'stat' }) {
    if (type === 'stat') {
        return (
            <div className="grid-4" style={{ marginBottom: '40px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="glass-premium" style={{ padding: '24px', borderRadius: '20px', animation: 'pulse 1.5s infinite var(--ease-out-smooth)' }}>
                        <div style={{ height: '12px', width: '40%', background: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '16px' }} />
                        <div style={{ height: '32px', width: '20%', background: 'var(--bg-secondary)', borderRadius: '8px' }} />
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'row') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '16px', background: 'var(--bg-primary)', animation: `pulse 1.5s infinite ${i * 0.1}s var(--ease-out-smooth)` }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ height: '16px', width: '30%', background: 'var(--bg-secondary)', borderRadius: '4px' }} />
                            <div style={{ height: '12px', width: '20%', background: 'var(--bg-secondary)', borderRadius: '4px' }} />
                        </div>
                        <div style={{ height: '32px', width: '80px', background: 'var(--bg-secondary)', borderRadius: '8px' }} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card-glass" style={{ height: '220px', display: 'flex', flexDirection: 'column', animation: `pulse 1.5s infinite ${i * 0.1}s var(--ease-out-smooth)` }}>
                    <div style={{ height: '24px', width: '60%', background: 'var(--bg-secondary)', borderRadius: '6px', marginBottom: '12px' }} />
                    <div style={{ height: '16px', width: '40%', background: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '24px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ height: '14px', width: '80%', background: 'var(--bg-secondary)', borderRadius: '4px' }} />
                        <div style={{ height: '14px', width: '70%', background: 'var(--bg-secondary)', borderRadius: '4px' }} />
                        <div style={{ height: '14px', width: '90%', background: 'var(--bg-secondary)', borderRadius: '4px' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
