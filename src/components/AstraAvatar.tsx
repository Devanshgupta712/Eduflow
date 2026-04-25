'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, Sphere, Capsule, Torus, Cone, Box, Cylinder } from '@react-three/drei';
import * as THREE from 'three';
import { API_BASE, getStoredUser } from '@/lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

// Props for the 3D Anime Avatar
interface AstraCoreProps {
    status: 'idle' | 'listening' | 'thinking' | 'speaking';
    isWaving?: boolean;
}

function Finger({ t, i, isWaving }: { t: number, i: number, isWaving: boolean }) {
    return (
        <group position={[0.08 - i * 0.04, 0, 0]}>
            {/* Base segment */}
            <Cylinder args={[0.015, 0.015, 0.08]} rotation={[isWaving ? Math.sin(t * 15 + i) * 0.2 + 0.2 : 0.1, 0, 0]}>
                <meshPhysicalMaterial color="#ffe0bd" roughness={0.3} />
            </Cylinder>
            {/* Tip segment */}
            <group position={[0, -0.06, 0.02]} rotation={[0.4, 0, 0]}>
                <Cylinder args={[0.012, 0.012, 0.06]}>
                    <meshPhysicalMaterial color="#ffe0bd" roughness={0.3} />
                </Cylinder>
            </group>
        </group>
    );
}

function PremiumHumanoid({ status, isWaving }: AstraCoreProps) {
    const group = useRef<THREE.Group>(null);
    const headRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const rightForearmRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    
    const statusColor = status === 'listening' ? '#10b981' : 
                        status === 'thinking' ? '#8b5cf6' : 
                        status === 'speaking' ? '#3b82f6' : '#6366f1';

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        
        if (group.current) {
            group.current.position.y = Math.sin(t * 1.2) * 0.03;
            group.current.rotation.y = Math.sin(t * 0.3) * 0.05;
        }

        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 0.8) * 0.1;
            if (status === 'speaking') {
                headRef.current.rotation.x = Math.sin(t * 15) * 0.05;
            }
        }

        // Realistic Human Waving Animation
        if (rightArmRef.current && rightForearmRef.current) {
            if (isWaving) {
                // Natural shoulder rotation
                rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -1.8, 0.1);
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -0.4, 0.1);
                // Fluid elbow wave
                rightForearmRef.current.rotation.z = Math.sin(t * 12) * 0.5 - 0.2;
            } else {
                // Idle resting pose
                rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.4, 0.05);
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0.1, 0.05);
                rightForearmRef.current.rotation.z = THREE.MathUtils.lerp(rightForearmRef.current.rotation.z, 0.3, 0.05);
            }
        }

        if (leftArmRef.current) {
            leftArmRef.current.rotation.z = -0.4 + Math.sin(t * 1.2) * 0.03;
        }
    });

    return (
        <group ref={group} scale={[0.85, 0.85, 0.85]} position={[0, -1.5, 0]}>
            
            {/* --- HEAD --- */}
            <group ref={headRef} position={[0, 3.2, 0]}>
                {/* Anatomical Head Shape */}
                <Sphere args={[0.38, 32, 32]} scale={[1, 1.15, 0.95]}>
                    <meshPhysicalMaterial color="#ffe0bd" roughness={0.3} clearcoat={1} />
                </Sphere>
                
                {/* Hair Spikes (Premium Refined) */}
                <group position={[0, 0.1, 0]}>
                    {[...Array(18)].map((_, i) => (
                        <Cone 
                            key={i} 
                            args={[0.08, 0.55, 8]} 
                            position={[Math.sin(i * 1.1) * 0.35, Math.cos(i * 0.4) * 0.25 + 0.2, Math.cos(i * 1.1) * 0.3]}
                            rotation={[Math.sin(i), 0, Math.cos(i)]}
                        >
                            <meshPhysicalMaterial color="#1e40af" roughness={0.2} clearcoat={1} />
                        </Cone>
                    ))}
                    <Sphere args={[0.39, 16, 16]} position={[0, 0.05, -0.05]}>
                        <meshPhysicalMaterial color="#1e40af" roughness={0.2} clearcoat={1} />
                    </Sphere>
                </group>

                {/* Face Detail */}
                <Sphere position={[-0.12, 0.05, 0.3]} args={[0.04, 16, 16]}><meshPhysicalMaterial color="#111827" /></Sphere>
                <Sphere position={[0.12, 0.05, 0.3]} args={[0.04, 16, 16]}><meshPhysicalMaterial color="#111827" /></Sphere>
                <Box args={[0.03, 0.06, 0.04]} position={[0, -0.05, 0.35]}><meshPhysicalMaterial color="#ffe0bd" /></Box>
            </group>

            {/* --- NECK --- */}
            <Cylinder args={[0.08, 0.09, 0.25]} position={[0, 2.95, 0]}>
                <meshPhysicalMaterial color="#ffe0bd" roughness={0.3} />
            </Cylinder>

            {/* --- TORSO (Human Shape) --- */}
            <group position={[0, 2, 0]}>
                {/* Tapered Chest Box (Red Jacket) */}
                <Box args={[0.7, 0.8, 0.45]} position={[0, 0.4, 0]}>
                    <meshPhysicalMaterial color="#dc2626" roughness={0.4} clearcoat={0.5} />
                </Box>
                {/* White Collar */}
                <Torus args={[0.25, 0.04, 16, 32]} position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <meshPhysicalMaterial color="#ffffff" />
                </Torus>
                {/* Abdomen (Teal) */}
                <Cylinder args={[0.28, 0.35, 0.6]} position={[0, -0.1, 0]}>
                    <meshPhysicalMaterial color="#0d9488" roughness={0.4} />
                </Cylinder>
            </group>

            {/* --- ARMS --- */}
            {/* Right Arm */}
            <group ref={rightArmRef} position={[0.45, 2.5, 0]}>
                <Sphere args={[0.12, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                <Capsule args={[0.09, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                {/* Elbow Joint */}
                <group ref={rightForearmRef} position={[0, -0.75, 0]}>
                    <Sphere args={[0.08, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                    <Capsule args={[0.09, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                    {/* ADVANCED HAND */}
                    <group position={[0, -0.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
                        <Box args={[0.15, 0.06, 0.2]} position={[0, 0, 0]}>
                            <meshPhysicalMaterial color="#ffe0bd" />
                        </Box>
                        <group position={[0, -0.05, 0]}>
                            {[0, 1, 2, 3].map((i) => (
                                <Finger key={i} i={i} t={THREE.MathUtils.lerp(0, 5, 0.5)} isWaving={isWaving || false} />
                            ))}
                        </group>
                    </group>
                </group>
            </group>

            {/* Left Arm */}
            <group ref={leftArmRef} position={[-0.45, 2.5, 0]}>
                <Sphere args={[0.12, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                <Capsule args={[0.09, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group position={[0, -0.75, 0]}>
                    <Sphere args={[0.08, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                    <Capsule args={[0.09, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                    <group position={[0, -0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <Box args={[0.15, 0.06, 0.2]} position={[0, 0, 0]}>
                            <meshPhysicalMaterial color="#ffe0bd" />
                        </Box>
                        <group position={[0, -0.05, 0]}>
                            {[0, 1, 2, 3].map((i) => (
                                <Finger key={i} i={i} t={0} isWaving={false} />
                            ))}
                        </group>
                    </group>
                </group>
            </group>

            {/* --- LEGS (Standard Human Proportions) --- */}
            <group position={[0, 1.2, 0]}>
                {/* Right Leg */}
                <group position={[0.2, 0, 0]} rotation={[1.2, -0.1, 0]}>
                    <Capsule args={[0.15, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    <group position={[0, -0.9, 0]} rotation={[-0.8, 0, 0]}>
                        <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    </group>
                </group>
                {/* Left Leg */}
                <group position={[-0.2, 0, 0]} rotation={[1.2, 0.1, 0]}>
                    <Capsule args={[0.15, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    <group position={[0, -0.9, 0]} rotation={[-0.8, 0, 0]}>
                        <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    </group>
                </group>
            </group>

            {/* Status Glow Ring */}
            <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.5, 1.7, 64]} />
                <meshBasicMaterial color={statusColor} transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
            <pointLight position={[0, 3, 3]} distance={8} intensity={2} color={statusColor} />
        </group>
    );
}

export default function AstraAvatar() {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const [volume, setVolume] = useState(1); // 1 is 100% volume
    const [isFlying, setIsFlying] = useState(true); // Default to flying mode
    const [isWaving, setIsWaving] = useState(false);

    // For flying animation
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 0, y: 0 });
    const targetRef = useRef({ x: 0, y: 0 });

    // Determine current status for 3D Core
    const currentStatus = isSpeaking ? 'speaking' : isThinking ? 'thinking' : isListening ? 'listening' : 'idle';

    // Initialize User, Speech Recognition and Synthesis
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedVol = localStorage.getItem('astra_volume');
            if (storedVol !== null) {
                setVolume(parseFloat(storedVol));
            }
            const stored = getStoredUser();
            setUser(stored);

            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = false;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    handleSendMessage(transcript);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
            synthRef.current = window.speechSynthesis;
            if (synthRef.current.onvoiceschanged !== undefined) {
                synthRef.current.onvoiceschanged = () => {
                    synthRef.current?.getVoices();
                };
            }
        }
    }, []);

    // Flying logic
    useEffect(() => {
        if (typeof window !== 'undefined') {
            posRef.current = { x: window.innerWidth - 180, y: window.innerHeight - 180 };
            targetRef.current = { x: window.innerWidth - 180, y: window.innerHeight - 180 };
            
            let animationFrameId: number;
            let lastChangeTime = 0;

            const updatePosition = (time: number) => {
                if (!isOpen && isFlying) {
                    const dx = targetRef.current.x - posRef.current.x;
                    const dy = targetRef.current.y - posRef.current.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 20 || time - lastChangeTime > 4000) {
                        targetRef.current = {
                            x: Math.random() * (window.innerWidth - 250) + 50,
                            y: Math.random() * (window.innerHeight - 250) + 50
                        };
                        lastChangeTime = time;
                    }

                    posRef.current.x += dx * 0.015;
                    posRef.current.y += dy * 0.015;
                    
                    if (containerRef.current) {
                        containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                        containerRef.current.style.right = 'auto';
                        containerRef.current.style.bottom = 'auto';
                        containerRef.current.style.left = '0px';
                        containerRef.current.style.top = '0px';
                    }
                } else {
                     if (containerRef.current) {
                        containerRef.current.style.transform = 'none';
                        containerRef.current.style.left = 'auto';
                        containerRef.current.style.top = 'auto';
                        containerRef.current.style.right = '24px';
                        containerRef.current.style.bottom = '24px';
                     }
                }
                animationFrameId = requestAnimationFrame(updatePosition);
            };
            
            animationFrameId = requestAnimationFrame(updatePosition);
            
            return () => {
                cancelAnimationFrame(animationFrameId);
            };
        }
    }, [isOpen, isFlying]);

    // Stop all speech and listening when window is closed
    useEffect(() => {
        if (!isOpen) {
            stopAudioAndListening();
            setIsWaving(false);
        } else {
            setIsWaving(true);
            const timer = setTimeout(() => setIsWaving(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const stopAudioAndListening = () => {
        if (synthRef.current) {
            synthRef.current.cancel();
        }
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
        setIsSpeaking(false);
        setIsListening(false);
        setIsThinking(false);
    };

    const toggleListening = () => {
        if (isSpeaking) {
            if (synthRef.current) synthRef.current.cancel();
            setIsSpeaking(false);
        }

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current?.start();
                setIsListening(true);
            } catch (e) {
                console.error("Speech recognition error:", e);
            }
        }
    };

    const speak = (text: string) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Female')) || voices[0];
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        utterance.volume = volume;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
        const newUserMessage = { role: 'user', content: text };
        setMessages(prev => [...prev, newUserMessage as Message]);
        setInputValue('');
        setIsThinking(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    message: text,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
                })
            });
            if (!res.ok) throw new Error('API Error');
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            if (!reader) throw new Error('Empty response');
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                assistantContent += chunk;
                setMessages(prev => {
                    const others = prev.slice(0, -1);
                    return [...others, { role: 'assistant', content: assistantContent }];
                });
            }
            decoder.decode();
            if (assistantContent && isOpen) {
                speak(assistantContent);
            }
        } catch (error) {
            console.error('Chat Error:', error);
            const errMessage = "Sorry, my systems are currently offline.";
            setMessages(prev => [...prev, { role: 'assistant', content: errMessage }]);
            speak(errMessage);
        } finally {
            setIsThinking(false);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);
        localStorage.setItem('astra_volume', newVol.toString());
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    return (
        <div ref={containerRef} style={{
            position: 'fixed',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '12px',
            willChange: 'transform'
        }}>
            
            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    width: '350px',
                    height: '500px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(0, 0, 0, 0.2)'
                    }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    background: currentStatus === 'idle' ? '#6366f1' : 
                                                currentStatus === 'listening' ? '#10b981' : 
                                                currentStatus === 'thinking' ? '#8b5cf6' : '#3b82f6',
                                    boxShadow: `0 0 10px ${currentStatus === 'idle' ? '#6366f1' : currentStatus === 'listening' ? '#10b981' : currentStatus === 'thinking' ? '#8b5cf6' : '#3b82f6'}`
                                }} />
                                Hello
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>AI Mentor & Counselor</span>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#cbd5e1' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={isFlying} 
                                        onChange={(e) => setIsFlying(e.target.checked)}
                                        style={{ accentColor: 'var(--primary)' }}
                                    />
                                    Flying Mode
                                </label>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px' }}>{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
                            <input 
                                type="range" 
                                min="0" max="1" step="0.1" 
                                value={volume} 
                                onChange={handleVolumeChange}
                                style={{ width: '60px', accentColor: 'var(--primary)' }}
                            />
                        </div>
                    </div>

                    <div ref={scrollRef} style={{
                        flex: 1,
                        padding: '20px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        scrollBehavior: 'smooth'
                    }}>
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px', fontSize: '14px' }}>
                                <p>Hi {user?.name?.split(' ')[0] || 'there'}! I'm here to help.</p>
                                <p>How can I assist you today?</p>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                                color: '#fff',
                                padding: '12px 16px',
                                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                maxWidth: '85%',
                                fontSize: '14px',
                                lineHeight: '1.5'
                            }}>
                                {msg.content}
                            </div>
                        ))}
                        {isThinking && (
                            <div style={{ alignSelf: 'flex-start', color: '#8b5cf6', fontSize: '14px', padding: '12px 16px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '20px 20px 20px 4px' }}>
                                Assistant is thinking...
                            </div>
                        )}
                    </div>

                    <div style={{
                        padding: '16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        gap: '12px',
                        background: 'rgba(0, 0, 0, 0.2)'
                    }}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleSendMessage(inputValue)}
                            placeholder="Type a message..."
                            disabled={isThinking}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: '20px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#fff',
                                outline: 'none',
                                fontSize: '14px'
                            }}
                        />
                        <button
                            onClick={toggleListening}
                            disabled={isThinking}
                            style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                border: 'none',
                                background: isListening ? '#ef4444' : 'var(--primary)',
                                color: '#fff',
                                cursor: isThinking ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                fontSize: '20px'
                            }}
                        >
                            {isListening ? '🛑' : '🎤'}
                        </button>
                    </div>
                </div>
            )}

            {/* 3D Avatar Container */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: isOpen ? '220px' : '320px',
                    height: isOpen ? '220px' : '320px',
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transform: isOpen ? 'scale(1)' : 'scale(1.1)',
                    position: 'relative'
                }}
            >
                <Canvas camera={{ position: [0, 0, 6] }} style={{ pointerEvents: 'none', background: 'transparent' }}>
                    <ambientLight intensity={1} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <Environment preset="city" />
                    <React.Suspense fallback={null}>
                        <PremiumHumanoid status={currentStatus} isWaving={isWaving} />
                    </React.Suspense>
                </Canvas>
                
                {!isOpen && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '12px',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        animation: 'pulse 2s infinite',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                    }}>
                        Hello
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
            `}} />
        </div>
    );
}
