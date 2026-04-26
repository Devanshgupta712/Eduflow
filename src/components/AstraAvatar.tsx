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
        
        // Correct Rotation: Forced Front Facing
        gltf.scene.rotation.y = Math.PI;
        
        // Accurate Centering
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.x = -center.x;
        gltf.scene.position.y = -center.y - 1.0; // Shift down so feet are visible
        gltf.scene.position.z = -center.z;
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
            } else if (status === 'listening') {
                group.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
            } else {
                group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
            }
        }
    });

    return (
        <group ref={group} scale={[2.2, 2.2, 2.2]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

export default function AstraAvatar() {
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState('idle'); 
    const [responseText, setResponseText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 50, y: 500 });
    const targetRef = useRef({ x: 50, y: 500 });
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;

        posRef.current = { x: 50, y: window.innerHeight - 500 };
        targetRef.current = { x: 50, y: window.innerHeight - 500 };

        // --- Autonomous Roaming ---
        let animationFrameId: number;
        let lastMoveTime = 0;

        const updatePos = (time: number) => {
            if (status === 'idle') {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                if (Math.sqrt(dx*dx + dy*dy) < 50 || time - lastMoveTime > 6000) {
                    targetRef.current = { 
                        x: Math.random() * (window.innerWidth - 350) + 50, 
                        y: Math.random() * (window.innerHeight - 500) + 50 
                    };
                    lastMoveTime = time;
                }
                posRef.current.x += dx * 0.008;
                posRef.current.y += dy * 0.008;
                if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);

        // --- Speech AI ---
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
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
                    setResponseText(data.reply);
                    setStatus('speaking');
                    speak(data.reply, () => setStatus('idle'));
                } catch (e) { setStatus('idle'); }
            };
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [status]);

    if (!mounted) return null;

    return (
        <div 
            ref={containerRef} 
            style={{ 
                position: 'fixed', zIndex: 10000000, left: 0, top: 0,
                width: '350px', height: '550px', // Much taller for full body
                pointerEvents: 'auto', userSelect: 'none'
            }}
        >
            <div onClick={() => { setStatus('listening'); recognitionRef.current?.start(); }} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}>
                <Suspense fallback={null}>
                    <Canvas style={{ background: 'transparent' }}>
                        {/* Camera moved back to position 9 for full body view */}
                        <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={35} />
                        <ambientLight intensity={1.5} />
                        <directionalLight position={[5, 5, 5]} intensity={1.5} />
                        <Environment preset="city" />
                        <SkeletalAvatar status={status} />
                        <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
                    </Canvas>
                </Suspense>

                <div style={{ 
                    position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', 
                    background: '#dc2626', color: 'white', padding: '6px 20px', borderRadius: '24px', 
                    fontSize: '13px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' 
                }}>
                    {status === 'listening' ? '👂 Listening...' : status === 'thinking' ? '🧠 thinking...' : status === 'speaking' ? '🗣️ Speaking...' : '👋 Click to talk'}
                </div>
            </div>

            {status === 'speaking' && responseText && (
                <div style={{ 
                    position: 'absolute', bottom: '480px', left: '10px', width: '300px', 
                    background: 'white', padding: '20px', borderRadius: '24px', 
                    boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9'
                }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 600 }}>{responseText}</p>
                </div>
            )}
        </div>
    );
}
