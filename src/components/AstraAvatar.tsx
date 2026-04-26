'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// --- Professional Skeletal Character (Local & Fast) ---
function SkeletalAvatar({ isWaving }: { isWaving: boolean }) {
    // Using the local model we just downloaded for instant loading
    const gltf = useGLTF('/astra_model.glb');
    const { actions, names } = useAnimations(gltf.animations, gltf.scene);
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
                } else {
                    mat.color.set('#111827');
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
        <group ref={group} scale={[2.2, 2.2, 2.2]} position={[0, -2.2, 0]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

function LoadingSpinner() {
    return (
        <mesh>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshStandardMaterial color="#dc2626" wireframe />
        </mesh>
    );
}

export default function AstraAvatar() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef({ x: 50, y: 0 });
    const targetRef = useRef({ x: 50, y: 0 });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        posRef.current = { x: 50, y: window.innerHeight - 300 };
        targetRef.current = { x: 50, y: window.innerHeight - 300 };

        let animationFrameId: number;
        let lastTime = 0;

        const updatePos = (time: number) => {
            if (!isOpen && !isDragging) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                
                // Roaming Logic
                if (Math.sqrt(dx*dx + dy*dy) < 50 || time - lastTime > 4000) {
                    targetRef.current = { 
                        x: Math.random() * (window.innerWidth - 300) + 50, 
                        y: Math.random() * (window.innerHeight - 300) + 50 
                    };
                    lastTime = time;
                }
                
                posRef.current.x += dx * 0.01;
                posRef.current.y += dy * 0.01;
                
                if (containerRef.current) {
                    containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                }
            } else if (!isDragging && containerRef.current) {
                containerRef.current.style.transform = 'none';
                containerRef.current.style.left = '32px';
                containerRef.current.style.bottom = '32px';
                containerRef.current.style.right = 'auto';
                containerRef.current.style.top = 'auto';
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isOpen, isDragging]);

    return (
        <div 
            ref={containerRef} 
            onClick={() => setIsOpen(!isOpen)}
            style={{ 
                position: 'fixed', 
                zIndex: 1000000, 
                width: '300px', 
                height: '300px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <Canvas camera={{ position: [0, 0, 5], fov: 35 }} style={{ background: 'transparent' }}>
                <ambientLight intensity={1.5} />
                <directionalLight position={[5, 5, 5]} intensity={1.5} />
                <Environment preset="city" />
                <Suspense fallback={<LoadingSpinner />}>
                    <SkeletalAvatar isWaving={isOpen} />
                </Suspense>
                <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} />
            </Canvas>
            {!isOpen && (
                <div style={{ position: 'absolute', top: '10px', background: '#dc2626', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                    Hello! I am Astra
                </div>
            )}
        </div>
    );
}

useGLTF.preload('/astra_model.glb');
