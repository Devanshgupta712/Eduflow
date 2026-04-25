'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture, Environment } from '@react-three/drei';
import * as THREE from 'three';

// --- Master Articulated Avatar (Stable & Premium) ---
function MasterArticulatedAvatar({ status, isWaving }: { status: string, isWaving: boolean }) {
    const group = useRef<THREE.Group>(null);
    const bodyRef = useRef<THREE.Mesh>(null);
    const armPivotRef = useRef<THREE.Group>(null);
    
    const bodyTex = useTexture('/ranma_body_master.png');
    const armTex = useTexture('/ranma_arm_master.png');
    
    const statusColor = status === 'listening' ? '#10b981' : 
                        status === 'thinking' ? '#8b5cf6' : 
                        status === 'speaking' ? '#3b82f6' : '#6366f1';

    // Master Shader (Chroma-Key + Warp for movement)
    const masterMaterial = (tex: THREE.Texture, isBody: boolean) => new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: tex },
            uKeyColor: { value: new THREE.Color(1, 0, 1) }, // Magenta
            uSimilarity: { value: 0.52 },
            uSmoothness: { value: 0.12 },
            uTime: { value: 0 },
            uIsBody: { value: isBody ? 1.0 : 0.0 }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uIsBody;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vec3 pos = position;
                // Subtle leg sway within the master image
                if (uIsBody > 0.5 && uv.y < 0.35) {
                    pos.x += sin(uTime * 1.5 + uv.y * 6.0) * (0.35 - uv.y) * 0.3;
                }
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            uniform vec3 uKeyColor;
            uniform float uSimilarity;
            uniform float uSmoothness;
            varying vec2 vUv;
            void main() {
                vec4 texColor = texture2D(uTexture, vUv);
                float dist = distance(texColor.rgb, uKeyColor);
                float alpha = smoothstep(uSimilarity, uSimilarity + uSmoothness, dist);
                if (alpha < 0.1) discard;
                gl_FragColor = vec4(texColor.rgb, alpha);
            }
        `,
        transparent: true
    });

    const bodyMat = useRef(masterMaterial(bodyTex, true));
    const armMat = useRef(masterMaterial(armTex, false));

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        bodyMat.current.uniforms.uTime.value = t;
        armMat.current.uniforms.uTime.value = t;
        
        if (group.current) {
            group.current.position.y = Math.sin(t * 1.2) * 0.1;
            group.current.rotation.y = Math.sin(t * 0.3) * 0.05;
        }

        if (armPivotRef.current) {
            if (isWaving) {
                armPivotRef.current.rotation.z = Math.sin(t * 12) * 0.2;
                armPivotRef.current.position.y = THREE.MathUtils.lerp(armPivotRef.current.position.y, 0.75, 0.1);
                armPivotRef.current.position.x = THREE.MathUtils.lerp(armPivotRef.current.position.x, -0.32, 0.1);
            } else {
                armPivotRef.current.rotation.z = THREE.MathUtils.lerp(armPivotRef.current.rotation.z, 0, 0.1);
                armPivotRef.current.position.y = THREE.MathUtils.lerp(armPivotRef.current.position.y, 0.7, 0.1);
                armPivotRef.current.position.x = THREE.MathUtils.lerp(armPivotRef.current.position.x, -0.35, 0.1);
            }
        }
    });

    return (
        <group ref={group} scale={[1.1, 1.1, 1.1]} position={[0, -0.5, 0]}>
            {/* Unified Master Body */}
            <mesh ref={bodyRef} position={[0, 0, 0]}>
                <planeGeometry args={[3.5, 5.0, 16, 16]} />
                <primitive object={bodyMat.current} attach="material" />
            </mesh>

            {/* Surgical Arm Attachment (Scaled & Aligned) */}
            <group ref={armPivotRef} position={[-0.35, 0.7, 0.1]}>
                <mesh position={[0.2, -0.35, 0]}>
                    <planeGeometry args={[1.05, 1.05]} />
                    <primitive object={armMat.current} attach="material" />
                </mesh>
            </group>

            {/* Status Glow */}
            <group position={[0, -2.4, -0.1]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.9, 1.0, 64]} />
                    <meshBasicMaterial color={statusColor} transparent opacity={0.8} />
                </mesh>
            </group>
            
            <pointLight position={[0, 1, 3]} distance={8} intensity={2} color={statusColor} />
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
        const updatePos = (time: number) => {
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
                <div style={{ width: '350px', height: '500px', background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
                        <span>Astra AI</span>
                        <button onClick={() => setIsOpen(false)}>×</button>
                    </div>
                </div>
            )}
            <div onClick={() => !isDragging && setIsOpen(!isOpen)} style={{ width: '400px', height: '400px', position: 'relative' }}>
                <Canvas camera={{ position: [0, 0, 5] }}>
                    <ambientLight intensity={1.5} />
                    <Environment preset="city" />
                    <React.Suspense fallback={null}>
                        <MasterArticulatedAvatar status="idle" isWaving={isOpen} />
                    </React.Suspense>
                </Canvas>
                {!isOpen && (
                    <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>Hello!</div>
                )}
            </div>
        </div>
    );
}
