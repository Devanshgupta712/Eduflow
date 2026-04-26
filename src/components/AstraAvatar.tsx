'use client';

import React, { useState, useEffect, useRef } from 'react';

// --- Instant-Load High Fidelity Assistant ---
export default function AstraAvatar() {
    const [isOpen, setIsOpen] = useState(false);
    const [isWaving, setIsWaving] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Ensure visibility after mount
        setIsVisible(true);
        
        // Initial wave
        const timer = setTimeout(() => setIsWaving(true), 1500);
        const timer2 = setTimeout(() => setIsWaving(false), 4500);
        return () => { clearTimeout(timer); clearTimeout(timer2); };
    }, []);

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '40px',
            left: '40px',
            zIndex: 999999, // Absolute top
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'auto'
        }}>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes float {
                    0% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(2deg); }
                    100% { transform: translateY(0px) rotate(0deg); }
                }
                @keyframes wave {
                    0% { transform: rotate(0deg); }
                    25% { transform: rotate(15deg); }
                    75% { transform: rotate(-10deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes shadow {
                    0% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(0.8); opacity: 0.15; }
                    100% { transform: scale(1); opacity: 0.3; }
                }
                .astra-body {
                    animation: float 4s ease-in-out infinite;
                    cursor: pointer;
                    position: relative;
                    width: 140px;
                    height: 200px;
                    display: flex;
                    justify-content: center;
                    align-items: flex-end;
                }
                .astra-arm {
                    position: absolute;
                    top: 45px;
                    left: 20px;
                    width: 45px;
                    transform-origin: top center;
                    z-index: 2;
                }
                .astra-arm.waving {
                    animation: wave 0.8s ease-in-out infinite;
                }
                .astra-main {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .astra-shadow {
                    width: 60px;
                    height: 10px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 50%;
                    margin-top: 10px;
                    filter: blur(4px);
                    animation: shadow 4s ease-in-out infinite;
                }
                .astra-tag {
                    position: absolute;
                    top: -40px;
                    background: #dc2626;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    white-space: nowrap;
                    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
                }
            `}} />

            <div className="astra-body" onClick={() => setIsOpen(!isOpen)}>
                {!isOpen && <div className="astra-tag">Hello! I am Astra</div>}
                
                {/* Articulated Arm (Waves) */}
                <img 
                    src="/ranma_arm_master.png" 
                    className={`astra-arm ${isWaving || isOpen ? 'waving' : ''}`}
                    style={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.2))' }}
                />
                
                {/* Master Body */}
                <img 
                    src="/ranma_body_master.png" 
                    className="astra-main"
                    style={{ filter: 'drop-shadow(4px 8px 12px rgba(0,0,0,0.15))' }}
                />
            </div>

            {/* Contact Shadow */}
            <div className="astra-shadow" />

            {/* Simple Dialog if Open */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    bottom: '220px',
                    left: '0',
                    width: '300px',
                    background: '#fff',
                    padding: '20px',
                    borderRadius: '24px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                    border: '1px solid #f1f5f9',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                        Hi! I am Astra. I am here to help you navigate your training journey. How can I assist you today?
                    </p>
                    <button 
                        onClick={() => setIsOpen(false)}
                        style={{ marginTop: '12px', background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}
