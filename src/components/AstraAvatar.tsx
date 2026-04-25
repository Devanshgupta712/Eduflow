'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error: any, errorInfo: any) { console.error("Astra Error:", error, errorInfo); }
    render() {
        if (this.state.hasError) return null; // Fail silently so the main page still works
        return this.props.children;
    }
}

// --- True 3D Video Game Character ---
function VideoGameAvatar({ status, isWaving }: { status: string, isWaving: boolean }) {
    const gltf = useGLTF('https://vazxmix.github.io/vroid-glb/characters/boy.glb');
    const { actions, names } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    useEffect(() => {
        if (!actions || names.length === 0) return;
        try {
            const idleName = names.find(n => n.toLowerCase().includes('idle')) || names[0];
            const waveName = names.find(n => n.toLowerCase().includes('wave')) || names[1] || names[0];

            if (actions[idleName]) actions[idleName].reset().fadeIn(0.5).play();

            if (isWaving && actions[waveName]) {
                actions[waveName].reset().fadeIn(0.2).play();
                setTimeout(() => { if (actions[waveName]) actions[waveName].fadeOut(0.5); }, 3000);
            }
        } catch (e) {}
    }, [isWaving, actions, names]);

    useEffect(() => {
        if (!gltf.scene) return;
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mesh.name.toLowerCase().includes('hair')) mat.color.set('#dc2626');
                else if (mesh.name.toLowerCase().includes('top')) mat.color.set('#dc2626');
                else if (mesh.name.toLowerCase().includes('bottom')) mat.color.set('#0d9488');
            }
        });
    }, [gltf.scene]);

    useFrame((state) => {
        if (group.current) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
            if (status === 'speaking') group.current.rotation.y = Math.sin(state.clock.elapsedTime * 10) * 0.03;
        }
    });

    return (
        <group ref={group} scale={[2.5, 2.5, 2.5]} position={[0, -2.5, 0]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

function LoadingOrb() {
    return (
        <mesh>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={2} transparent opacity={0.6} />
        </mesh>
    );
}

export default function AstraAvatar() {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef({ x: 0, y: 0 });
    const targetRef = useRef({ x: 0, y: 0 });
    const offsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Initialize Speech Safely
        try {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.onresult = (event: any) => handleSendMessage(event.results[0][0].transcript);
                recognitionRef.current.onend = () => setIsListening(false);
            }
            synthRef.current = window.speechSynthesis;
        } catch (e) {}

        // Initialize Position
        posRef.current = { x: window.innerWidth - 350, y: window.innerHeight - 350 };
        targetRef.current = { x: window.innerWidth - 350, y: window.innerHeight - 350 };

        let animationFrameId: number;
        const updatePos = (time: number) => {
            if (!isOpen && !isDragging) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                if (Math.sqrt(dx*dx + dy*dy) < 50) {
                    targetRef.current = { x: Math.random() * (window.innerWidth - 350) + 50, y: Math.random() * (window.innerHeight - 350) + 50 };
                }
                posRef.current.x += dx * 0.015;
                posRef.current.y += dy * 0.015;
                if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            } else if (!isDragging && containerRef.current) {
                containerRef.current.style.transform = 'none';
                containerRef.current.style.right = '24px';
                containerRef.current.style.bottom = '24px';
                containerRef.current.style.left = 'auto';
                containerRef.current.style.top = 'auto';
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isOpen, isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isOpen) return;
        setIsDragging(true);
        offsetRef.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
    };

    useEffect(() => {
        const move = (e: MouseEvent) => {
            if (isDragging && containerRef.current) {
                posRef.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y };
                containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            }
        };
        const up = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, [isDragging]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;
        setMessages(prev => [...prev, { role: 'user', content: text }]);
        setInputValue('');
        setIsThinking(true);
        try {
            const res = await fetch('https://lms-beta-lilac.vercel.app/api/ai/chat', { // Static URL for safety
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.text();
            setMessages(prev => [...prev, { role: 'assistant', content: data }]);
            if (synthRef.current) {
                const utt = new SpeechSynthesisUtterance(data);
                utt.onstart = () => setIsSpeaking(true);
                utt.onend = () => setIsSpeaking(false);
                synthRef.current.speak(utt);
            }
        } catch (e) {} finally { setIsThinking(false); }
    };

    return (
        <ErrorBoundary>
            <div ref={containerRef} onMouseDown={handleMouseDown} style={{ position: 'fixed', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', cursor: isDragging ? 'grabbing' : 'pointer' }}>
                {isOpen && (
                    <div style={{ width: '350px', height: '500px', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
                            <span>Hello Assistant</span>
                            <button onClick={() => setIsOpen(false)}>×</button>
                        </div>
                        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                            {messages.map((m, i) => <div key={i} style={{ color: '#fff', marginBottom: '8px' }}>{m.content}</div>)}
                        </div>
                        <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                            <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage(inputValue)} style={{ flex: 1 }} />
                            <button onClick={() => setIsOpen(!isOpen)}>Send</button>
                        </div>
                    </div>
                )}
                <div onClick={() => !isDragging && setIsOpen(!isOpen)} style={{ width: '350px', height: '350px' }}>
                    <Canvas camera={{ position: [0, 0, 5] }}>
                        <ambientLight intensity={1} />
                        <Environment preset="city" />
                        <Suspense fallback={<LoadingOrb />}>
                            <VideoGameAvatar status={isSpeaking ? 'speaking' : 'idle'} isWaving={isOpen} />
                        </Suspense>
                    </Canvas>
                </div>
            </div>
        </ErrorBoundary>
    );
}
