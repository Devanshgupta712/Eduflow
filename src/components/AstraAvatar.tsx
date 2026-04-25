'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { API_BASE, getStoredUser } from '@/lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

// Master Articulated Avatar with Vertex-Warp for Leg Movement
function MasterArticulatedAvatar({ status, isWaving }: { status: string, isWaving: boolean }) {
    const group = useRef<THREE.Group>(null);
    const bodyRef = useRef<THREE.Mesh>(null);
    const armPivotRef = useRef<THREE.Group>(null);
    
    const bodyTex = useTexture('/ranma_body_master.png');
    const armTex = useTexture('/ranma_arm_master.png');
    
    const statusColor = status === 'listening' ? '#10b981' : 
                        status === 'thinking' ? '#8b5cf6' : 
                        status === 'speaking' ? '#3b82f6' : '#6366f1';

    // Master Shader with Chroma-Key and Vertex-Warp
    const masterMaterial = (tex: THREE.Texture, isBody: boolean) => new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: tex },
            uKeyColor: { value: new THREE.Color(1, 0, 1) },
            uSimilarity: { value: 0.52 },
            uSmoothness: { value: 0.12 },
            uTime: { value: 0 },
            uIsBody: { value: isBody ? 1.0 : 0.0 }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uIsBody;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vec3 pos = position;
                // Moveable legs effect: Warp the bottom vertices
                if (uIsBody > 0.5 && uv.y < 0.4) {
                    pos.x += sin(uTime * 1.5 + uv.y * 5.0) * (0.4 - uv.y) * 0.4;
                }
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            uniform vec3 uKeyColor;
            uniform float uSimilarity;
            uniform float uSmoothness;
            varying vec2 vUv;
            void main() {
                vec4 texColor = texture2D(uTexture, vUv);
                float dist = distance(texColor.rgb, uKeyColor);
                float alpha = smoothstep(uSimilarity, uSimilarity + uSmoothness, dist);
                if (alpha < 0.1) discard;
                gl_FragColor = vec4(texColor.rgb, alpha);
            }
        `,
        transparent: true
    });

    const bodyMat = useRef(masterMaterial(bodyTex, true));
    const armMat = useRef(masterMaterial(armTex, false));

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        bodyMat.current.uniforms.uTime.value = t;
        armMat.current.uniforms.uTime.value = t;
        
        if (group.current) {
            group.current.position.y = Math.sin(t * 1.5) * 0.1;
            group.current.rotation.y = Math.sin(t * 0.4) * 0.05;
        }

        if (armPivotRef.current) {
            if (isWaving) {
                armPivotRef.current.rotation.z = Math.sin(t * 12) * 0.25;
                armPivotRef.current.position.y = THREE.MathUtils.lerp(armPivotRef.current.position.y, 0.7, 0.1);
                armPivotRef.current.position.x = THREE.MathUtils.lerp(armPivotRef.current.position.x, -0.32, 0.1);
            } else {
                armPivotRef.current.rotation.z = THREE.MathUtils.lerp(armPivotRef.current.rotation.z, 0, 0.1);
                armPivotRef.current.position.y = THREE.MathUtils.lerp(armPivotRef.current.position.y, 0.6, 0.1);
                armPivotRef.current.position.x = THREE.MathUtils.lerp(armPivotRef.current.position.x, -0.35, 0.1);
            }
        }
    });

    return (
        <group ref={group} scale={[1.1, 1.1, 1.1]} position={[0, -0.5, 0]}>
            {/* --- MASTER BODY LAYER --- */}
            <mesh ref={bodyRef} position={[0, 0, 0]}>
                <planeGeometry args={[3.5, 5.0, 16, 16]} />
                <primitive object={bodyMat.current} attach="material" />
            </mesh>

            {/* --- CORRECTED ARM LAYER (Scaled & Aligned) --- */}
            <group ref={armPivotRef} position={[-0.35, 0.6, 0.1]}>
                <mesh position={[0.2, -0.4, 0]}>
                    <planeGeometry args={[1.1, 1.1]} />
                    <primitive object={armMat.current} attach="material" />
                </mesh>
            </group>

            {/* --- STATUS RING --- */}
            <group position={[0, -2.4, -0.1]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.9, 1.0, 64]} />
                    <meshBasicMaterial color={statusColor} transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
            </group>
            
            <pointLight position={[0, 1, 3]} distance={8} intensity={2} color={statusColor} />
        </group>
    );
}

            {/* --- STATUS GLOW RING --- */}
            <group position={[0, -2.4, -0.1]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[1.0, 1.1, 64]} />
                    <meshBasicMaterial color={statusColor} transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <planeGeometry args={[2, 2]} />
                    <meshBasicMaterial color="#000" transparent opacity={0.2} />
                </mesh>
            </group>
            
            <pointLight position={[0, 1, 3]} distance={8} intensity={2} color={statusColor} />
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
                    containerRef.current.style.right = 'auto';
                    containerRef.current.style.bottom = 'auto';
                    containerRef.current.style.left = '0px';
                    containerRef.current.style.top = '0px';
                }
            } else if (!isDragging) {
                if (containerRef.current) {
                    containerRef.current.style.transform = 'none';
                    containerRef.current.style.left = 'auto';
                    containerRef.current.style.top = 'auto';
                    containerRef.current.style.right = '24px';
                    containerRef.current.style.bottom = '24px';
                    posRef.current = { x: window.innerWidth - 350, y: window.innerHeight - 350 };
                }
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
                    <React.Suspense fallback={null}>
                        <MasterArticulatedAvatar status={currentStatus} isWaving={isWaving} />
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
