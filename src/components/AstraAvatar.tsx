'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Global Speech Configuration ---
const speak = (text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.onend = onEnd || null;
    window.speechSynthesis.speak(utterance);
};

// --- Professional Skeletal Character ---
function SkeletalAvatar({ status }: { status: string }) {
    const gltf = useGLTF('/astra_model.glb');
    const { actions } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.2 });
                const name = mesh.name.toLowerCase();
                if (name.includes('head') || name.includes('skin')) mat.color.set('#ffe0bd');
                else if (name.includes('upper') || name.includes('jacket') || name.includes('torso')) mat.color.set('#dc2626');
                else if (name.includes('lower') || name.includes('pants') || name.includes('leg')) mat.color.set('#0d9488');
                else mat.color.set('#111827');
                mesh.material = mat;
            }
        });
        
        // Correct Rotation: Facing Forward (0 instead of PI)
        gltf.scene.rotation.y = 0;
        
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        gltf.scene.position.y = -1.2;
    }, [gltf.scene]);

    useEffect(() => {
        if (!actions) return;
        const idle = actions['Idle'];
        if (idle) idle.reset().fadeIn(0.5).play();
        return () => { if (idle) idle.fadeOut(0.5); };
    }, [actions]);

    useFrame((state) => {
        if (group.current) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.05;
            if (status === 'speaking') {
                group.current.rotation.y = Math.sin(state.clock.elapsedTime * 15) * 0.08;
                group.current.rotation.x = Math.sin(state.clock.elapsedTime * 10) * 0.05;
            } else if (status === 'listening') {
                group.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
            } else {
                group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
                group.current.rotation.x = 0;
            }
        }
    });

    return (
        <group ref={group} scale={[2.0, 2.0, 2.0]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

export default function AstraAvatar() {
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState('idle'); 
    const [responseText, setResponseText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 50, y: 500 });
    const targetRef = useRef({ x: 50, y: 500 });
    const isDragging = useRef(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;

        posRef.current = { x: 50, y: window.innerHeight - 380 };
        targetRef.current = { x: 50, y: window.innerHeight - 380 };

        // --- Autonomous Roaming Logic ---
        let animationFrameId: number;
        let lastMoveTime = 0;

        const updatePos = (time: number) => {
            if (status === 'idle' && !isDragging.current) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                
                // Randomize target if reached or after 5 seconds
                if (Math.sqrt(dx*dx + dy*dy) < 50 || time - lastMoveTime > 5000) {
                    targetRef.current = { 
                        x: Math.random() * (window.innerWidth - 300) + 50, 
                        y: Math.random() * (window.innerHeight - 380) + 50 
                    };
                    lastMoveTime = time;
                }
                
                posRef.current.x += dx * 0.008;
                posRef.current.y += dy * 0.008;
                
                if (containerRef.current) {
                    containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                }
            } else if (status !== 'idle' && containerRef.current) {
                // Dock to the bottom-left while interacting
                containerRef.current.style.transform = `translate(50px, ${window.innerHeight - 380}px)`;
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);

        // --- Speech Recognition ---
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.onresult = async (event: any) => {
                const transcript = event.results[0][0].transcript;
                setStatus('thinking');
                try {
                    const res = await fetch('https://lms-api-bkuw.onrender.com/api/training/chatbot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: transcript, history: [] })
                    });
                    const data = await res.json();
                    setResponseText(data.reply || "I am here to help!");
                    setStatus('speaking');
                    speak(data.reply || "I am here to help!", () => setStatus('idle'));
                } catch (e) { setStatus('idle'); }
            };
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [status]);

    const handleInteraction = () => {
        if (status === 'idle') {
            setStatus('listening');
            recognitionRef.current?.start();
        } else {
            window.speechSynthesis.cancel();
            setStatus('idle');
            setResponseText('');
        }
    };

    if (!mounted) return null;

    return (
        <div 
            ref={containerRef} 
            style={{ 
                position: 'fixed', zIndex: 10000000, left: 0, top: 0,
                width: '300px', height: '400px',
                pointerEvents: 'auto', userSelect: 'none',
                transition: status !== 'idle' ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
        >
            <div onClick={handleInteraction} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}>
                <Suspense fallback={null}>
                    <Canvas style={{ background: 'transparent' }}>
                        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={35} />
                        <ambientLight intensity={1.5} />
                        <directionalLight position={[5, 5, 5]} intensity={1.5} />
                        <Environment preset="city" />
                        <SkeletalAvatar status={status} />
                        <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
                    </Canvas>
                </Suspense>

                <div style={{ 
                    position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', 
                    background: status === 'listening' ? '#10b981' : status === 'thinking' ? '#8b5cf6' : '#dc2626',
                    color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', 
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)', transition: 'all 0.3s'
                }}>
                    {status === 'listening' ? '👂 Listening...' : status === 'thinking' ? '🧠 Thinking...' : status === 'speaking' ? '🗣️ Speaking...' : '👋 Click me'}
                </div>
            </div>

            {status === 'speaking' && responseText && (
                <div style={{ 
                    position: 'absolute', bottom: '320px', left: '10px', width: '280px', 
                    background: 'white', padding: '20px', borderRadius: '24px', 
                    boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6', fontWeight: 500 }}>
                        {responseText}
                    </p>
                </div>
            )}
        </div>
    );
}
