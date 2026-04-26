'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Capsule, Cone, Box, Torus, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Professional Procedural Student (Teenager Style) ---
function StudentAvatar({ status }: { status: string }) {
    const group = useRef<THREE.Group>(null);
    const headRef = useRef<THREE.Group>(null);
    const rightArmPivot = useRef<THREE.Group>(null);
    const leftArmPivot = useRef<THREE.Group>(null);
    const rightLegPivot = useRef<THREE.Group>(null);
    const leftLegPivot = useRef<THREE.Group>(null);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (group.current) group.current.position.y = Math.sin(t * 1.5) * 0.1;
        
        // Head movement
        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
            if (status === 'speaking') headRef.current.rotation.x = Math.sin(t * 15) * 0.05;
        }

        // Arm/Leg movement
        if (rightArmPivot.current) rightArmPivot.current.rotation.z = Math.sin(t * 1.5) * 0.05;
        if (leftArmPivot.current) leftArmPivot.current.rotation.z = -Math.sin(t * 1.5) * 0.05;
        
        if (rightLegPivot.current && leftLegPivot.current) {
            rightLegPivot.current.rotation.x = Math.sin(t * 1.5) * 0.1;
            leftLegPivot.current.rotation.x = -Math.sin(t * 1.5) * 0.1;
        }
    });

    return (
        <group ref={group} scale={[1.4, 1.4, 1.4]} position={[0, -1, 0]}>
            {/* --- HEAD & HAIR --- */}
            <group ref={headRef} position={[0, 2.6, 0]}>
                <Sphere args={[0.32, 32, 32]}><meshPhysicalMaterial color="#ffe0bd" roughness={0.3} /></Sphere>
                {/* Spiky Teen Hair */}
                <group position={[0, 0.15, 0]}>
                    {[...Array(12)].map((_, i) => (
                        <Cone key={i} args={[0.08, 0.35, 8]} position={[Math.sin(i * 1.5) * 0.25, 0.1, Math.cos(i * 1.5) * 0.2]} rotation={[0.4, 0, i * 0.8]}>
                            <meshPhysicalMaterial color="#4b2c20" roughness={0.5} />
                        </Cone>
                    ))}
                </group>
                {/* Eyes */}
                <group position={[0, 0, 0.3]}>
                    <Sphere args={[0.035, 16, 16]} position={[-0.1, 0.05, 0]}><meshBasicMaterial color="#111827" /></Sphere>
                    <Sphere args={[0.035, 16, 16]} position={[0.1, 0.05, 0]}><meshBasicMaterial color="#111827" /></Sphere>
                </group>
            </group>

            {/* --- BODY (Red Student Hoodie) --- */}
            <group position={[0, 1.7, 0]}>
                <Capsule args={[0.35, 0.8, 16, 32]}>
                    <meshPhysicalMaterial color="#dc2626" roughness={0.6} />
                </Capsule>
                {/* Hoodie Details */}
                <Box args={[0.3, 0.2, 0.1]} position={[0, -0.2, 0.3]}>
                    <meshPhysicalMaterial color="#dc2626" />
                </Box>
            </group>

            {/* --- ARMS --- */}
            <group ref={rightArmPivot} position={[0.5, 2.1, 0]}>
                <Capsule args={[0.1, 0.7]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group position={[0, -0.7, 0]}><Sphere args={[0.08, 16]} position={[0,-0.05,0]}><meshPhysicalMaterial color="#ffe0bd" /></Sphere></group>
            </group>
            <group ref={leftArmPivot} position={[-0.5, 2.1, 0]}>
                <Capsule args={[0.1, 0.7]} position={[0, -0.35, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group position={[0, -0.7, 0]}><Sphere args={[0.08, 16]} position={[0,-0.05,0]}><meshPhysicalMaterial color="#ffe0bd" /></Sphere></group>
            </group>

            {/* --- LEGS (Teal Student Jeans) --- */}
            <group ref={rightLegPivot} position={[0.2, 1.2, 0]}>
                <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                <Box args={[0.16, 0.1, 0.3]} position={[0, -0.9, 0.1]}><meshPhysicalMaterial color="#fff" /></Box> {/* White Sneaker */}
            </group>
            <group ref={leftLegPivot} position={[-0.2, 1.2, 0]}>
                <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                <Box args={[0.16, 0.1, 0.3]} position={[0, -0.9, 0.1]}><meshPhysicalMaterial color="#fff" /></Box> {/* White Sneaker */}
            </group>

            <pointLight position={[0, 2, 2]} distance={6} intensity={2} color="#fff" />
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

        // Autonomous Roaming
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
                posRef.current.x += dx * 0.01;
                posRef.current.y += dy * 0.01;
                if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);

        // Speech AI Init
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
                    const utterance = new SpeechSynthesisUtterance(data.reply);
                    utterance.onend = () => setStatus('idle');
                    window.speechSynthesis.speak(utterance);
                } catch (e) { setStatus('idle'); }
            };
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [status]);

    if (!mounted) return null;

    return (
        <div ref={containerRef} style={{ position: 'fixed', zIndex: 10000000, left: 0, top: 0, width: '350px', height: '550px', pointerEvents: 'auto' }}>
            <div onClick={() => { setStatus('listening'); recognitionRef.current?.start(); }} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}>
                <Canvas style={{ background: 'transparent' }}>
                    <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={35} />
                    <ambientLight intensity={1.5} />
                    <Environment preset="city" />
                    <StudentAvatar status={status} />
                    <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
                </Canvas>
                <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: 'white', padding: '6px 20px', borderRadius: '24px', fontSize: '13px', fontWeight: 'bold' }}>
                    {status === 'listening' ? '👂 Listening...' : status === 'thinking' ? '🧠 Thinking...' : status === 'speaking' ? '🗣️ Speaking...' : '👋 Click to talk'}
                </div>
            </div>
            {status === 'speaking' && responseText && (
                <div style={{ position: 'absolute', bottom: '480px', left: '10px', width: '300px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 600 }}>{responseText}</p>
                </div>
            )}
        </div>
    );
}
