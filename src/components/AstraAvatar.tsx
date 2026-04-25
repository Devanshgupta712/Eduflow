'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, Capsule, Cone, Box, Torus, Environment } from '@react-three/drei';
import * as THREE from 'three';

// --- High-Fidelity Procedural Ranma (Skeletal & Stable) ---
function HighFidelityAvatar({ status, isWaving }: { status: string, isWaving: boolean }) {
    const group = useRef<THREE.Group>(null);
    const headRef = useRef<THREE.Group>(null);
    const rightArmPivot = useRef<THREE.Group>(null);
    const leftArmPivot = useRef<THREE.Group>(null);
    const rightLegPivot = useRef<THREE.Group>(null);
    const leftLegPivot = useRef<THREE.Group>(null);

    const statusColor = status === 'listening' ? '#10b981' : 
                        status === 'thinking' ? '#8b5cf6' : 
                        status === 'speaking' ? '#3b82f6' : '#dc2626';

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        
        // Natural Body Float
        if (group.current) group.current.position.y = Math.sin(t * 1.2) * 0.1;

        // Head Look
        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
            if (status === 'speaking') headRef.current.rotation.x = Math.sin(t * 15) * 0.05;
        }

        // Arm Movement
        if (rightArmPivot.current) {
            if (isWaving) {
                rightArmPivot.current.rotation.z = -1.8 + Math.sin(t * 15) * 0.3;
                rightArmPivot.current.rotation.x = -0.5;
            } else {
                rightArmPivot.current.rotation.z = 0.4 + Math.sin(t * 1.2) * 0.05;
                rightArmPivot.current.rotation.x = 0;
            }
        }
        if (leftArmPivot.current) {
            leftArmPivot.current.rotation.z = -0.4 - Math.sin(t * 1.2) * 0.05;
        }

        // Leg Movement (Walking/Swaying)
        if (rightLegPivot.current && leftLegPivot.current) {
            rightLegPivot.current.rotation.x = Math.sin(t * 1.2) * 0.1;
            leftLegPivot.current.rotation.x = -Math.sin(t * 1.2) * 0.1;
        }
    });

    return (
        <group ref={group} scale={[1.2, 1.2, 1.2]} position={[0, -1, 0]}>
            {/* --- HEAD & HAIR --- */}
            <group ref={headRef} position={[0, 2.8, 0]}>
                <Sphere args={[0.35, 32, 32]} scale={[1, 1.05, 0.95]}>
                    <meshPhysicalMaterial color="#ffe0bd" roughness={0.3} />
                </Sphere>
                {/* Anime Hair Spikes */}
                <group position={[0, 0.1, 0]}>
                    {[...Array(15)].map((_, i) => (
                        <Cone key={i} args={[0.08, 0.4, 8]} position={[Math.sin(i * 1.5) * 0.3, Math.cos(i * 0.5) * 0.2 + 0.15, Math.cos(i * 1.5) * 0.25]} rotation={[Math.sin(i), 0, Math.cos(i)]}>
                            <meshPhysicalMaterial color="#dc2626" roughness={0.2} clearcoat={1} />
                        </Cone>
                    ))}
                </group>
                {/* Eyes */}
                <group position={[0, 0, 0.32]}>
                    <Sphere args={[0.04, 16, 16]} position={[-0.12, 0.05, 0]}><meshBasicMaterial color="#111827" /></Sphere>
                    <Sphere args={[0.04, 16, 16]} position={[0.12, 0.05, 0]}><meshBasicMaterial color="#111827" /></Sphere>
                </group>
            </group>

            {/* --- TORSO --- */}
            <group position={[0, 1.8, 0]}>
                <Capsule args={[0.3, 0.8, 16, 32]} scale={[1.2, 1, 0.8]}>
                    <meshPhysicalMaterial color="#dc2626" roughness={0.4} clearcoat={0.5} />
                </Capsule>
                <Torus args={[0.28, 0.04, 16, 32]} position={[0, 0.5, 0]} rotation={[Math.PI/2, 0, 0]}>
                    <meshBasicMaterial color="#fff" />
                </Torus>
            </group>

            {/* --- ARMS --- */}
            {/* Right Arm */}
            <group ref={rightArmPivot} position={[0.45, 2.3, 0]}>
                <Capsule args={[0.1, 0.6]} position={[0, -0.3, 0]} rotation={[0, 0, 0]}>
                    <meshPhysicalMaterial color="#dc2626" />
                </Capsule>
                <group position={[0, -0.6, 0]}>
                    <Capsule args={[0.09, 0.6]} position={[0, -0.3, 0]}><meshPhysicalMaterial color="#ffe0bd" /></Capsule>
                </group>
            </group>
            {/* Left Arm */}
            <group ref={leftArmPivot} position={[-0.45, 2.3, 0]}>
                <Capsule args={[0.1, 0.6]} position={[0, -0.3, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group position={[0, -0.6, 0]}>
                    <Capsule args={[0.09, 0.6]} position={[0, -0.3, 0]}><meshPhysicalMaterial color="#ffe0bd" /></Capsule>
                </group>
            </group>

            {/* --- LEGS --- */}
            {/* Right Leg */}
            <group ref={rightLegPivot} position={[0.2, 1.2, 0]}>
                <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                <group position={[0, -0.8, 0]}>
                    <Capsule args={[0.13, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    <Box args={[0.2, 0.08, 0.3]} position={[0, -0.85, 0.1]}><meshPhysicalMaterial color="#111827" /></Box>
                </group>
            </group>
            {/* Left Leg */}
            <group ref={leftLegPivot} position={[-0.2, 1.2, 0]}>
                <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                <group position={[0, -0.8, 0]}>
                    <Capsule args={[0.13, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
                    <Box args={[0.2, 0.08, 0.3]} position={[0, -0.85, 0.1]}><meshPhysicalMaterial color="#111827" /></Box>
                </group>
            </group>

            {/* Status Glow */}
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.5, 0]}>
                <ringGeometry args={[1.2, 1.3, 64]} />
                <meshBasicMaterial color={statusColor} transparent opacity={0.8} />
            </mesh>
            <pointLight position={[0, 2, 2]} distance={6} intensity={2} color={statusColor} />
        </group>
    );
}

export default function AstraAvatar() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef({ x: 0, y: 0 });
    const targetRef = useRef({ x: 0, y: 0 });
    const offsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        posRef.current = { x: window.innerWidth - 380, y: window.innerHeight - 450 };
        targetRef.current = { x: window.innerWidth - 380, y: window.innerHeight - 450 };

        let animationFrameId: number;
        const updatePos = () => {
            if (!isOpen && !isDragging) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                if (Math.sqrt(dx*dx + dy*dy) < 50) {
                    targetRef.current = { x: Math.random() * (window.innerWidth - 400) + 50, y: Math.random() * (window.innerHeight - 450) + 50 };
                }
                posRef.current.x += dx * 0.015;
                posRef.current.y += dy * 0.015;
                if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            } else if (!isDragging && containerRef.current) {
                containerRef.current.style.transform = 'none';
                containerRef.current.style.right = '40px';
                containerRef.current.style.bottom = '40px';
                containerRef.current.style.left = 'auto';
                containerRef.current.style.top = 'auto';
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isOpen]);

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

    return (
        <div ref={containerRef} onMouseDown={handleMouseDown} style={{ position: 'fixed', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', cursor: isDragging ? 'grabbing' : 'pointer' }}>
            {isOpen && (
                <div style={{ width: '350px', height: '500px', background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontWeight: 'bold' }}>Astra AI</span>
                        <button onClick={() => setIsOpen(false)} style={{ fontSize: '24px' }}>×</button>
                    </div>
                </div>
            )}
            <div onClick={() => !isDragging && setIsOpen(!isOpen)} style={{ width: '400px', height: '400px', position: 'relative' }}>
                <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                    <ambientLight intensity={1} />
                    <Environment preset="city" />
                    <HighFidelityAvatar status="idle" isWaving={isOpen} />
                </Canvas>
                {!isOpen && (
                    <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>Hello! Click me</div>
                )}
            </div>
        </div>
    );
}
