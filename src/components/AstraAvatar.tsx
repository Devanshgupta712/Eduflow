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

function Finger({ side, i, t, isWaving }: { side: 'left' | 'right', i: number, t: number, isWaving: boolean }) {
    return (
        <group position={[0.06 - i * 0.035, 0, 0]}>
            <Cylinder args={[0.012, 0.012, 0.08]} rotation={[isWaving && side === 'right' ? Math.sin(t * 15 + i) * 0.3 : 0, 0, 0]}>
                <meshPhysicalMaterial color="#ffe0bd" roughness={0.3} />
            </Cylinder>
        </group>
    );
}

function Proper3DCharacter({ status, isWaving }: AstraCoreProps) {
    const group = useRef<THREE.Group>(null);
    const headRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const rightForearmRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    
    const statusColor = status === 'listening' ? '#10b981' : 
                        status === 'thinking' ? '#8b5cf6' : 
                        status === 'speaking' ? '#3b82f6' : '#6366f1';

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        
        if (group.current) {
            // Natural standing sway
            group.current.position.y = Math.sin(t * 1.2) * 0.03;
            group.current.rotation.y = Math.sin(t * 0.3) * 0.04;
        }

        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 0.8) * 0.1;
            if (status === 'speaking') {
                headRef.current.rotation.x = Math.sin(t * 15) * 0.05;
            }
        }

        // --- Moveable Arms ---
        if (rightArmRef.current && rightForearmRef.current) {
            if (isWaving) {
                rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -1.8, 0.1);
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -0.4, 0.1);
                rightForearmRef.current.rotation.z = Math.sin(t * 12) * 0.5 - 0.2;
            } else {
                rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.4, 0.05);
                rightForearmRef.current.rotation.z = THREE.MathUtils.lerp(rightForearmRef.current.rotation.z, 0.3, 0.05);
            }
        }

        if (leftArmRef.current) {
            leftArmRef.current.rotation.z = -0.4 + Math.sin(t * 1.2) * 0.03;
        }

        // --- Moveable Legs (Subtle standing motion) ---
        if (rightLegRef.current && leftLegRef.current) {
            rightLegRef.current.rotation.x = Math.sin(t * 1.2) * 0.02;
            leftLegRef.current.rotation.x = -Math.sin(t * 1.2) * 0.02;
        }
    });

    return (
        <group ref={group} scale={[0.8, 0.8, 0.8]} position={[0, -1.8, 0]}>
            
            {/* --- HEAD --- */}
            <group ref={headRef} position={[0, 3.2, 0]}>
                <Sphere args={[0.38, 32, 32]} scale={[1, 1.1, 0.95]}>
                    <meshPhysicalMaterial color="#ffe0bd" roughness={0.3} clearcoat={1} />
                </Sphere>
                
                {/* Hair (Red spikes) */}
                <group position={[0, 0.1, 0]}>
                    {[...Array(20)].map((_, i) => (
                        <Cone 
                            key={i} 
                            args={[0.07, 0.5, 8]} 
                            position={[Math.sin(i * 1.2) * 0.32, Math.cos(i * 0.5) * 0.25 + 0.2, Math.cos(i * 1.2) * 0.28]}
                            rotation={[Math.sin(i), 0, Math.cos(i)]}
                        >
                            <meshPhysicalMaterial color="#dc2626" roughness={0.2} clearcoat={1} />
                        </Cone>
                    ))}
                    <Sphere args={[0.39, 16, 16]} position={[0, 0.05, -0.05]}>
                        <meshPhysicalMaterial color="#dc2626" roughness={0.2} clearcoat={1} />
                    </Sphere>
                </group>

                {/* Face Details */}
                <group position={[0, 0, 0.35]}>
                    <Sphere position={[-0.12, 0.05, 0]} args={[0.04, 16, 16]}><meshPhysicalMaterial color="#111827" /></Sphere>
                    <Sphere position={[0.12, 0.05, 0]} args={[0.04, 16, 16]}><meshPhysicalMaterial color="#111827" /></Sphere>
                    <Box args={[0.03, 0.06, 0.04]} position={[0, -0.05, 0]}><meshPhysicalMaterial color="#ffe0bd" /></Box>
                </group>
            </group>

            {/* --- TORSO --- */}
            <group position={[0, 2.1, 0]}>
                <Box args={[0.75, 0.9, 0.45]} position={[0, 0.35, 0]}>
                    <meshPhysicalMaterial color="#dc2626" roughness={0.4} clearcoat={0.5} />
                </Box>
                <Torus args={[0.26, 0.04, 16, 32]} position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <meshPhysicalMaterial color="#ffffff" />
                </Torus>
                <Cylinder args={[0.3, 0.36, 0.6]} position={[0, -0.2, 0]}>
                    <meshPhysicalMaterial color="#0d9488" roughness={0.4} />
                </Cylinder>
            </group>

            {/* --- ARMS --- */}
            {/* Right Arm (Waving) */}
            <group ref={rightArmRef} position={[0.45, 2.7, 0]}>
                <Sphere args={[0.12, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                <Capsule args={[0.1, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group ref={rightForearmRef} position={[0, -0.7, 0]}>
                    <Sphere args={[0.08, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                    <Capsule args={[0.1, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                    {/* Proper Hand */}
                    <group position={[0, -0.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
                        <Box args={[0.15, 0.06, 0.18]}><meshPhysicalMaterial color="#ffe0bd" /></Box>
                        {[0, 1, 2, 3].map((i) => (
                            <Finger key={i} side="right" i={i} t={THREE.MathUtils.lerp(0, 5, 0.5)} isWaving={isWaving || false} />
                        ))}
                    </group>
                </group>
            </group>

            {/* Left Arm */}
            <group ref={leftArmRef} position={[-0.45, 2.7, 0]}>
                <Sphere args={[0.12, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                <Capsule args={[0.1, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group position={[0, -0.7, 0]}>
                    <Sphere args={[0.08, 16, 16]}><meshPhysicalMaterial color="#dc2626" /></Sphere>
                    <Capsule args={[0.1, 0.6]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                    <group position={[0, -0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <Box args={[0.15, 0.06, 0.18]}><meshPhysicalMaterial color="#ffe0bd" /></Box>
                        {[0, 1, 2, 3].map((i) => (
                            <Finger key={i} side="left" i={i} t={0} isWaving={false} />
                        ))}
                    </group>
                </group>
            </group>

            {/* --- LEGS (Moveable) --- */}
            {/* Right Leg */}
            <group ref={rightLegRef} position={[0.22, 1.4, 0]}>
                <Capsule args={[0.16, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                <group position={[0, -0.9, 0]}>
                    <Capsule args={[0.15, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    <Box args={[0.2, 0.1, 0.3]} position={[0, -0.85, 0.1]}><meshPhysicalMaterial color="#111827" /></Box>
                </group>
            </group>
            {/* Left Leg */}
            <group ref={leftLegRef} position={[-0.22, 1.4, 0]}>
                <Capsule args={[0.16, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                <group position={[0, -0.9, 0]}>
                    <Capsule args={[0.15, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    <Box args={[0.2, 0.1, 0.3]} position={[0, -0.85, 0.1]}><meshPhysicalMaterial color="#111827" /></Box>
                </group>
            </group>

            {/* Status Glow */}
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
    const [volume, setVolume] = useState(1);
    const [isFlying, setIsFlying] = useState(true);
    const [isWaving, setIsWaving] = useState(false);

    // Draggable & Flying State
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef({ x: 0, y: 0 });
    const targetRef = useRef({ x: 0, y: 0 });
    const offsetRef = useRef({ x: 0, y: 0 });

    const currentStatus = isSpeaking ? 'speaking' : isThinking ? 'thinking' : isListening ? 'listening' : 'idle';

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedVol = localStorage.getItem('astra_volume');
            if (storedVol !== null) setVolume(parseFloat(storedVol));
            const stored = getStoredUser();
            setUser(stored);

            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.onresult = (event: any) => handleSendMessage(event.results[0][0].transcript);
                recognitionRef.current.onend = () => setIsListening(false);
            }
            synthRef.current = window.speechSynthesis;
        }
    }, []);

    // Interactive Dragging and Flying Logic
    useEffect(() => {
        if (typeof window === 'undefined') return;

        posRef.current = { x: window.innerWidth - 300, y: window.innerHeight - 300 };
        targetRef.current = { x: window.innerWidth - 300, y: window.innerHeight - 300 };
        
        let animationFrameId: number;
        let lastChangeTime = 0;

        const updatePosition = (time: number) => {
            if (!isOpen && isFlying && !isDragging) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 30 || time - lastChangeTime > 5000) {
                    targetRef.current = {
                        x: Math.random() * (window.innerWidth - 300) + 50,
                        y: Math.random() * (window.innerHeight - 300) + 50
                    };
                    lastChangeTime = time;
                }

                posRef.current.x += dx * 0.012;
                posRef.current.y += dy * 0.012;
                
                if (containerRef.current) {
                    containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                    containerRef.current.style.right = 'auto';
                    containerRef.current.style.bottom = 'auto';
                    containerRef.current.style.left = '0px';
                    containerRef.current.style.top = '0px';
                }
            } else if (!isDragging && !isOpen) {
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
        return () => cancelAnimationFrame(animationFrameId);
    }, [isOpen, isFlying, isDragging]);

    // Drag events
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isOpen) return;
        setIsDragging(true);
        setIsFlying(false);
        offsetRef.current = {
            x: e.clientX - posRef.current.x,
            y: e.clientY - posRef.current.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && containerRef.current) {
                posRef.current = {
                    x: e.clientX - offsetRef.current.x,
                    y: e.clientY - offsetRef.current.y
                };
                containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    useEffect(() => {
        if (!isOpen) {
            stopAudioAndListening();
            setIsWaving(false);
        } else {
            setIsWaving(true);
            setTimeout(() => setIsWaving(false), 3000);
        }
    }, [isOpen]);

    const stopAudioAndListening = () => {
        if (synthRef.current) synthRef.current.cancel();
        if (recognitionRef.current && isListening) recognitionRef.current.stop();
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
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const speak = (text: string) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = volume;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;
        setMessages(prev => [...prev, { role: 'user', content: text }]);
        setInputValue('');
        setIsThinking(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({ message: text, history: messages.map(m => ({ role: m.role, content: m.content })) })
            });
            const assistantContent = await res.text();
            setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
            if (isOpen) speak(assistantContent);
        } catch (error) {
            console.error('Chat Error:', error);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div 
            ref={containerRef} 
            onMouseDown={handleMouseDown}
            style={{
                position: 'fixed',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '12px',
                cursor: isDragging ? 'grabbing' : isOpen ? 'default' : 'grab'
            }}
        >
            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    width: '350px', height: '500px', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>Hello</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#cbd5e1' }}>
                            <input type="checkbox" checked={isFlying} onChange={(e) => setIsFlying(e.target.checked)} />
                            Flying Mode
                        </label>
                    </div>
                    <div ref={scrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)', color: '#fff', padding: '12px 16px', borderRadius: '20px' }}>
                                {msg.content}
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '12px' }}>
                        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage(inputValue)} placeholder="Type a message..." style={{ flex: 1, padding: '12px 16px', borderRadius: '20px', border: 'none', background: 'rgba(255, 255, 255, 0.05)', color: '#fff' }} />
                        <button onClick={toggleListening} style={{ width: '44px', height: '44px', borderRadius: '50%', background: isListening ? '#ef4444' : 'var(--primary)', color: '#fff', border: 'none' }}>{isListening ? '🛑' : '🎤'}</button>
                    </div>
                </div>
            )}

            {/* 3D Avatar Container */}
            <div 
                onClick={(e) => { if (!isDragging) setIsOpen(!isOpen); }}
                style={{ width: isOpen ? '240px' : '350px', height: isOpen ? '240px' : '350px', position: 'relative' }}
            >
                <Canvas camera={{ position: [0, 0, 6] }} style={{ pointerEvents: 'none', background: 'transparent' }}>
                    <ambientLight intensity={1} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <Environment preset="city" />
                    <React.Suspense fallback={null}>
                        <Proper3DCharacter status={currentStatus} isWaving={isWaving} />
                    </React.Suspense>
                </Canvas>
                {!isOpen && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: 'white', fontSize: '12px', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>Hello</div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
            `}} />
        </div>
    );
}
