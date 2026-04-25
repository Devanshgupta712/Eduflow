'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { API_BASE, getStoredUser } from '@/lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

// Robust 3D Video Game Character Component
function VideoGameAvatar({ status, isWaving }: { status: string, isWaving: boolean }) {
    // High-quality public anime model
    const gltf = useGLTF('https://vazxmix.github.io/vroid-glb/characters/boy.glb');
    const { actions, names } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    // Safety checks for animations
    useEffect(() => {
        if (!actions || names.length === 0) return;

        try {
            // Find appropriate animations safely
            const idleName = names.find(n => n.toLowerCase().includes('idle')) || names[0];
            const waveName = names.find(n => n.toLowerCase().includes('wave')) || names[1] || names[0];

            const idleAction = actions[idleName];
            const waveAction = actions[waveName];

            if (idleAction) {
                idleAction.reset().fadeIn(0.5).play();
            }

            if (isWaving && waveAction) {
                waveAction.reset().fadeIn(0.2).play();
                const timer = setTimeout(() => {
                    if (waveAction) waveAction.fadeOut(0.5);
                }, 3000);
                return () => clearTimeout(timer);
            }
        } catch (err) {
            console.warn("Animation error:", err);
        }
    }, [isWaving, actions, names]);

    // Apply Ranma Saotome colors programmatically
    useEffect(() => {
        if (!gltf.scene) return;
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                
                if (mesh.name.toLowerCase().includes('hair')) {
                    mat.color.set('#dc2626'); // Red Hair
                } else if (mesh.name.toLowerCase().includes('top') || mesh.name.toLowerCase().includes('shirt')) {
                    mat.color.set('#dc2626'); // Red Jacket
                } else if (mesh.name.toLowerCase().includes('bottom') || mesh.name.toLowerCase().includes('pants')) {
                    mat.color.set('#0d9488'); // Teal Pants
                }
                mat.roughness = 0.5;
            }
        });
    }, [gltf.scene]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (group.current) {
            group.current.position.y = Math.sin(t * 1.5) * 0.05;
            if (status === 'speaking') {
                group.current.rotation.y = Math.sin(t * 10) * 0.03;
            }
        }
    });

    const statusColor = status === 'listening' ? '#10b981' : 
                        status === 'thinking' ? '#8b5cf6' : 
                        status === 'speaking' ? '#3b82f6' : '#6366f1';

    return (
        <group ref={group} scale={[2.5, 2.5, 2.5]} position={[0, -2.5, 0]}>
            <primitive object={gltf.scene} />
            
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[0.6, 0.7, 64]} />
                <meshBasicMaterial color={statusColor} transparent opacity={0.8} />
            </mesh>

            <pointLight position={[0, 2, 2]} distance={5} intensity={2} color={new THREE.Color(statusColor)} />
        </group>
    );
}

// Fallback for when the model is loading
function LoadingFallback() {
    return (
        <mesh>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="#6366f1" wireframe />
        </mesh>
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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        posRef.current = { x: window.innerWidth - 350, y: window.innerHeight - 350 };
        targetRef.current = { x: window.innerWidth - 350, y: window.innerHeight - 350 };
        
        let animationFrameId: number;
        let lastChangeTime = 0;

        const updatePosition = (time: number) => {
            if (!isOpen && isFlying && !isDragging) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 50 || time - lastChangeTime > 4000) {
                    targetRef.current = {
                        x: Math.random() * (window.innerWidth - 350) + 50,
                        y: Math.random() * (window.innerHeight - 350) + 50
                    };
                    lastChangeTime = time;
                }

                posRef.current.x += dx * 0.015;
                posRef.current.y += dy * 0.015;
                
                if (containerRef.current) {
                    containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                }
            } else if (!isDragging && containerRef.current) {
                containerRef.current.style.transform = 'none';
                containerRef.current.style.right = '24px';
                containerRef.current.style.bottom = '24px';
                containerRef.current.style.left = 'auto';
                containerRef.current.style.top = 'auto';
            }
            animationFrameId = requestAnimationFrame(updatePosition);
        };
        
        animationFrameId = requestAnimationFrame(updatePosition);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isOpen, isFlying, isDragging]);

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
                cursor: isDragging ? 'grabbing' : isOpen ? 'default' : 'grab',
                transition: isOpen ? 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
            }}
        >
            {isOpen && (
                <div style={{
                    width: '350px', height: '500px', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>Hello</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#cbd5e1' }}>
                                <input type="checkbox" checked={isFlying} onChange={(e) => setIsFlying(e.target.checked)} />
                                Flying Mode
                            </label>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>×</button>
                        </div>
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

            <div 
                onClick={(e) => { if (!isDragging) setIsOpen(!isOpen); }}
                style={{ width: isOpen ? '300px' : '380px', height: isOpen ? '300px' : '380px', position: 'relative' }}
            >
                <Canvas camera={{ position: [0, 0, 5] }} style={{ pointerEvents: 'none', background: 'transparent' }}>
                    <ambientLight intensity={1} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <Environment preset="city" />
                    <ContactShadows opacity={0.4} scale={10} blur={2.4} far={4.5} />
                    <Suspense fallback={<LoadingFallback />}>
                        <VideoGameAvatar status={currentStatus} isWaving={isWaving} />
                    </Suspense>
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

useGLTF.preload('https://vazxmix.github.io/vroid-glb/characters/boy.glb');
