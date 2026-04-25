'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// --- Safe Video Game Character ---
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
                mat.roughness = 0.4;
            }
        });
    }, [gltf.scene]);

    useFrame((state) => {
        if (group.current) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
            if (status === 'speaking') group.current.rotation.y = Math.sin(state.clock.elapsedTime * 10) * 0.05;
        }
    });

    // High-visibility character placement
    return (
        <group ref={group} scale={[2.8, 2.8, 2.8]} position={[0, -1.8, 0]}>
            <primitive object={gltf.scene} />
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

    return (
        <div ref={containerRef} onMouseDown={handleMouseDown} style={{ position: 'fixed', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', cursor: isDragging ? 'grabbing' : 'pointer' }}>
            {isOpen && (
                <div style={{ width: '350px', height: '500px', background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontWeight: 'bold' }}>Astra AI</span>
                        <button onClick={() => setIsOpen(false)} style={{ fontSize: '24px' }}>×</button>
                    </div>
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                        {messages.map((m, i) => <div key={i} style={{ color: '#fff', marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px' }}>{m.content}</div>)}
                    </div>
                    <div style={{ padding: '20px', display: 'flex', gap: '10px' }}>
                        <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && setMessages([...messages, {content: inputValue}])} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }} placeholder="Ask Astra..." />
                    </div>
                </div>
            )}
            <div onClick={() => !isDragging && setIsOpen(!isOpen)} style={{ width: '400px', height: '400px', position: 'relative' }}>
                <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                    <ambientLight intensity={1.5} />
                    <directionalLight position={[5, 5, 5]} intensity={2} />
                    <pointLight position={[-5, 5, 5]} intensity={1.5} color="#dc2626" />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                        <VideoGameAvatar status="idle" isWaving={isOpen} />
                    </Suspense>
                    <ContactShadows opacity={0.5} scale={10} blur={2} far={4} />
                </Canvas>
                {!isOpen && (
                    <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)', pointerEvents: 'none' }}>Hello! Click me</div>
                )}
            </div>
        </div>
    );
}
