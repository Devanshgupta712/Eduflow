'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// --- Professional Skeletal Character (Stable & High Quality) ---
function SkeletalAvatar({ isWaving }: { isWaving: boolean }) {
    // Using the official Three.js stable soldier model
    const gltf = useGLTF('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb');
    const { actions, names } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    // Apply Ranma Saotome "Code-Painting"
    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                
                // Identifying parts to color
                if (mesh.name.toLowerCase().includes('head') || mesh.name.toLowerCase().includes('skin')) {
                    mat.color.set('#ffe0bd'); // Skin
                } else if (mesh.name.toLowerCase().includes('jacket') || mesh.name.toLowerCase().includes('upper')) {
                    mat.color.set('#dc2626'); // Red Jacket
                } else if (mesh.name.toLowerCase().includes('pants') || mesh.name.toLowerCase().includes('lower')) {
                    mat.color.set('#0d9488'); // Teal Pants
                } else {
                    mat.color.set('#111827'); // Black details
                }
                mat.roughness = 0.6;
            }
        });
    }, [gltf.scene]);

    // Handle Skeletal Animations (Idle & Wave)
    useEffect(() => {
        if (!actions) return;
        
        // Soldier model names: 'Idle', 'Walk', 'Run'
        const idle = actions['Idle'];
        if (idle) idle.reset().fadeIn(0.5).play();

        return () => { if (idle) idle.fadeOut(0.5); };
    }, [actions]);

    useFrame((state) => {
        if (group.current) {
            // Subtle floating/breathing
            group.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.05;
            
            // If waving, we can procedurally tilt the arm since it's a skeletal mesh
            if (isWaving) {
                group.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
            }
        }
    });

    return (
        <group ref={group} scale={[2.2, 2.2, 2.2]} position={[0, -2.2, 0]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

// Fallback while loading
function LoadingSpinner() {
    return (
        <mesh>
            <sphereGeometry args={[0.4, 32, 32]} />
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.5} wireframe />
        </mesh>
    );
}

export default function AstraAvatar() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef({ x: 40, y: 0 });
    const targetRef = useRef({ x: 40, y: 0 });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Start bottom-left
        posRef.current = { x: 40, y: window.innerHeight - 320 };
        targetRef.current = { x: 40, y: window.innerHeight - 320 };

        let animationFrameId: number;
        const updatePos = () => {
            if (!isOpen && !isDragging) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                
                // Autonomous Roaming
                if (Math.sqrt(dx*dx + dy*dy) < 50) {
                    targetRef.current = { 
                        x: Math.random() * (window.innerWidth - 250) + 40, 
                        y: Math.random() * (window.innerHeight - 320) + 40 
                    };
                }
                
                posRef.current.x += dx * 0.008;
                posRef.current.y += dy * 0.008;
                
                if (containerRef.current) {
                    containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                }
            } else if (!isDragging && containerRef.current) {
                // Docked position
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
    }, [isOpen]);

    return (
        <div 
            ref={containerRef} 
            onClick={() => setIsOpen(!isOpen)}
            style={{ 
                position: 'fixed', 
                zIndex: 100000, // Extremely high z-index to show on landing page
                width: '250px', 
                height: '250px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto'
            }}
        >
            <Canvas camera={{ position: [0, 0, 5], fov: 40 }} style={{ background: 'transparent' }}>
                <ambientLight intensity={1.5} />
                <directionalLight position={[5, 5, 5]} intensity={2} />
                <Environment preset="city" />
                <Suspense fallback={<LoadingSpinner />}>
                    <SkeletalAvatar isWaving={isOpen} />
                </Suspense>
                <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} />
            </Canvas>
            
            {/* Minimal interaction hint */}
            {!isOpen && (
                <div style={{ 
                    position: 'absolute', 
                    top: '20px', 
                    background: 'rgba(220, 38, 38, 0.9)', 
                    color: 'white', 
                    padding: '4px 12px', 
                    borderRadius: '12px', 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    opacity: 0.8
                }}>
                    Astra
                </div>
            )}
        </div>
    );
}

useGLTF.preload('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb');
