'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// --- Professional Skeletal Character (Local & Fast) ---
function SkeletalAvatar() {
    const gltf = useGLTF('/astra_model.glb');
    const { actions } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mesh.name.toLowerCase().includes('head') || mesh.name.toLowerCase().includes('skin')) {
                    mat.color.set('#ffe0bd');
                } else if (mesh.name.toLowerCase().includes('jacket') || mesh.name.toLowerCase().includes('upper')) {
                    mat.color.set('#dc2626');
                } else if (mesh.name.toLowerCase().includes('pants') || mesh.name.toLowerCase().includes('lower')) {
                    mat.color.set('#0d9488');
                }
                mat.roughness = 0.6;
            }
        });
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
        }
    });

    return (
        <group ref={group} scale={[2.5, 2.5, 2.5]} position={[0, -2.5, 0]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

// --- Instant 2D Backup (Shown while 3D loads) ---
function InstantBackup() {
    return (
        <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite'
        }}>
            <img src="/ranma_body_master.png" style={{ height: '180px', objectFit: 'contain' }} />
            <div style={{ background: '#dc2626', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '10px', marginTop: '-20px', zIndex: 10 }}>Loading 3D...</div>
        </div>
    );
}

export default function AstraAvatar() {
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: 50, y: 500 });
    const isDragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setMounted(true);
        setPos({ x: 50, y: window.innerHeight - 300 });
        
        const move = (e: MouseEvent) => {
            if (isDragging.current && containerRef.current) {
                const newX = e.clientX - offset.current.x;
                const newY = e.clientY - offset.current.y;
                containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
            }
        };
        const up = () => { isDragging.current = false; };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isOpen) return;
        isDragging.current = true;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    };

    if (!mounted) return null;

    return (
        <div 
            ref={containerRef} 
            onMouseDown={handleMouseDown}
            style={{ 
                position: 'fixed', 
                zIndex: 9999999, 
                left: 0, top: 0,
                width: '280px', 
                height: '280px', 
                cursor: isDragging.current ? 'grabbing' : 'pointer',
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                pointerEvents: 'auto',
                transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
            }}
        >
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
            `}} />
            
            <div onClick={() => !isDragging.current && setIsOpen(!isOpen)} style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Suspense fallback={<InstantBackup />}>
                    <Canvas camera={{ position: [0, 0, 5], fov: 35 }} style={{ background: 'transparent' }}>
                        <ambientLight intensity={1.5} />
                        <directionalLight position={[5, 5, 5]} intensity={1.5} />
                        <Environment preset="city" />
                        <SkeletalAvatar />
                        <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} />
                    </Canvas>
                </Suspense>

                {!isOpen && (
                    <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: 'white', padding: '4px 14px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        Astra
                    </div>
                )}
            </div>

            {isOpen && (
                <div style={{ position: 'absolute', bottom: '240px', left: '0', width: '280px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
                        Hi! I am Astra. I am here to help you navigate your training journey.
                    </p>
                    <button onClick={() => setIsOpen(false)} style={{ marginTop: '12px', background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>Dismiss</button>
                </div>
            )}
        </div>
    );
}
