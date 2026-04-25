'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Capsule, Cone, Box, Torus, Environment, ContactShadows } from '@react-three/drei';
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
        if (group.current) group.current.position.y = Math.sin(t * 1.2) * 0.1;
        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
            if (status === 'speaking') headRef.current.rotation.x = Math.sin(t * 15) * 0.05;
        }
        if (rightArmPivot.current) {
            if (isWaving) {
                rightArmPivot.current.rotation.z = -1.8 + Math.sin(t * 15) * 0.3;
            } else {
                rightArmPivot.current.rotation.z = 0.4 + Math.sin(t * 1.2) * 0.05;
            }
        }
        if (leftArmPivot.current) leftArmPivot.current.rotation.z = -0.4 - Math.sin(t * 1.2) * 0.05;
        if (rightLegPivot.current && leftLegPivot.current) {
            rightLegPivot.current.rotation.x = Math.sin(t * 1.2) * 0.15;
            leftLegPivot.current.rotation.x = -Math.sin(t * 1.2) * 0.15;
        }
    });

    return (
        <group ref={group} scale={[1.3, 1.3, 1.3]} position={[0, -1, 0]}>
            <group ref={headRef} position={[0, 2.8, 0]}>
                <Sphere args={[0.35, 32, 32]}><meshPhysicalMaterial color="#ffe0bd" roughness={0.3} /></Sphere>
                <group position={[0, 0.1, 0]}>
                    {[...Array(12)].map((_, i) => (
                        <Cone key={i} args={[0.08, 0.4, 8]} position={[Math.sin(i * 1.5) * 0.3, 0.2, Math.cos(i * 1.5) * 0.25]} rotation={[0.5, 0, i]}>
                            <meshPhysicalMaterial color="#dc2626" roughness={0.2} />
                        </Cone>
                    ))}
                </group>
                <group position={[0, 0, 0.32]}>
                    <Sphere args={[0.04, 16, 16]} position={[-0.12, 0.05, 0]}><meshBasicMaterial color="#111827" /></Sphere>
                    <Sphere args={[0.04, 16, 16]} position={[0.12, 0.05, 0]}><meshBasicMaterial color="#111827" /></Sphere>
                </group>
            </group>
            <group position={[0, 1.8, 0]}>
                <Capsule args={[0.3, 0.8, 16, 32]}><meshPhysicalMaterial color="#dc2626" roughness={0.4} /></Capsule>
                <Torus args={[0.28, 0.04, 16, 32]} position={[0, 0.5, 0]} rotation={[Math.PI/2, 0, 0]}><meshBasicMaterial color="#fff" /></Torus>
            </group>
            <group ref={rightArmPivot} position={[0.45, 2.3, 0]}>
                <Capsule args={[0.1, 0.6]} position={[0, -0.3, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group position={[0, -0.6, 0]}><Capsule args={[0.09, 0.6]} position={[0, -0.3, 0]}><meshPhysicalMaterial color="#ffe0bd" /></Capsule></group>
            </group>
            <group ref={leftArmPivot} position={[-0.45, 2.3, 0]}>
                <Capsule args={[0.1, 0.6]} position={[0, -0.3, 0]}><meshPhysicalMaterial color="#dc2626" /></Capsule>
                <group position={[0, -0.6, 0]}><Capsule args={[0.09, 0.6]} position={[0, -0.3, 0]}><meshPhysicalMaterial color="#ffe0bd" /></Capsule></group>
            </group>
            <group ref={rightLegPivot} position={[0.2, 1.2, 0]}>
                <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
            </group>
            <group ref={leftLegPivot} position={[-0.2, 1.2, 0]}>
                <Capsule args={[0.14, 0.8]} position={[0, -0.4, 0]}><meshPhysicalMaterial color="#0d9488" /></Capsule>
            </group>
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef({ x: 50, y: 0 }); // Start on the LEFT
    const targetRef = useRef({ x: 50, y: 0 });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        posRef.current = { x: 50, y: window.innerHeight - 450 };
        targetRef.current = { x: 50, y: window.innerHeight - 450 };

        let animationFrameId: number;
        const updatePos = () => {
            if (!isOpen && !isDragging) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                if (Math.sqrt(dx*dx + dy*dy) < 50) {
                    targetRef.current = { x: Math.random() * (window.innerWidth - 400) + 50, y: Math.random() * (window.innerHeight - 450) + 50 };
                }
                posRef.current.x += dx * 0.01;
                posRef.current.y += dy * 0.01;
                if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            } else if (!isDragging && containerRef.current) {
                containerRef.current.style.transform = 'none';
                containerRef.current.style.left = '40px';
                containerRef.current.style.bottom = '40px';
                containerRef.current.style.right = 'auto';
                containerRef.current.style.top = 'auto';
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isOpen]);

    return (
        <div ref={containerRef} onClick={() => setIsOpen(!isOpen)} style={{ position: 'fixed', zIndex: 10000, width: '400px', height: '400px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }} style={{ background: 'transparent' }}>
                <ambientLight intensity={1.5} />
                <Environment preset="city" />
                <HighFidelityAvatar status="idle" isWaving={isOpen} />
                <ContactShadows opacity={0.4} scale={10} blur={2} />
            </Canvas>
            {!isOpen && (
                <div style={{ position: 'absolute', top: '15%', background: '#dc2626', color: 'white', padding: '8px 20px', borderRadius: '24px', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)' }}>Hello! I am here</div>
            )}
        </div>
    );
}
