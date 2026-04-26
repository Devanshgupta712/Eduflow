'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Professional Skeletal Character (Fixed View & Colors) ---
function SkeletalAvatar() {
    const gltf = useGLTF('/astra_model.glb');
    const { actions } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    // Precise Color Mapping for Ranma Saotome
    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = new THREE.MeshStandardMaterial({
                    roughness: 0.7,
                    metalness: 0.2
                });
                
                const name = mesh.name.toLowerCase();
                if (name.includes('head') || name.includes('skin')) {
                    mat.color.set('#ffe0bd'); // Skin
                } else if (name.includes('upper') || name.includes('jacket') || name.includes('torso')) {
                    mat.color.set('#dc2626'); // Red Jacket
                } else if (name.includes('lower') || name.includes('pants') || name.includes('leg')) {
                    mat.color.set('#0d9488'); // Teal Pants
                } else {
                    mat.color.set('#111827'); // Black Boots/Details
                }
                mesh.material = mat;
            }
        });

        // Auto-Center the model logic
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        gltf.scene.position.y = -1.2; // Adjust for feet on ground
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
            group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
        }
    });

    return (
        <group ref={group} scale={[1.8, 1.8, 1.8]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

// --- Instant 2D Backup ---
function InstantBackup() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/ranma_body_master.png" style={{ height: '150px', objectFit: 'contain' }} />
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
        setPos({ x: 50, y: window.innerHeight - 350 });
        
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
                zIndex: 10000000, 
                left: 0, top: 0,
                width: '250px', 
                height: '350px', // Taller for full body
                cursor: isDragging.current ? 'grabbing' : 'pointer',
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                pointerEvents: 'auto',
                transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
                userSelect: 'none'
            }}
        >
            <div onClick={() => !isDragging.current && setIsOpen(!isOpen)} style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Suspense fallback={<InstantBackup />}>
                    <Canvas style={{ background: 'transparent' }}>
                        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={40} />
                        <ambientLight intensity={1.5} />
                        <directionalLight position={[5, 5, 5]} intensity={1.5} />
                        <Environment preset="city" />
                        <SkeletalAvatar />
                        <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
                    </Canvas>
                </Suspense>

                {!isOpen && (
                    <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: 'white', padding: '4px 14px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        Astra
                    </div>
                )}
            </div>

            {isOpen && (
                <div style={{ position: 'absolute', bottom: '300px', left: '0', width: '280px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: 600 }}>
                        👋 Hi! I am Astra. I am your personal AI guide.
                    </p>
                    <button onClick={() => setIsOpen(false)} style={{ marginTop: '12px', background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Dismiss</button>
                </div>
            )}
        </div>
    );
}

useGLTF.preload('/astra_model.glb');
