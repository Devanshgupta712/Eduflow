'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Premium Skeletal Character (Digital Personality Engine) ---
function PremiumAvatar({ status, autoRotate, isMoving, enableRoaming }: { status: string, autoRotate: boolean, isMoving: boolean, enableRoaming: boolean }) {
    const gltf = useGLTF('/astra_model.glb');
    const { actions } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);
    const rightArm = useRef<THREE.Object3D | null>(null);
    const leftArm = useRef<THREE.Object3D | null>(null);

    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 });
                mesh.material = mat;
                const name = mesh.name.toLowerCase();
                if (name.includes('head') || name.includes('skin')) mat.color.set('#ffe0bd');
                else if (name.includes('helmet') || name.includes('cap') || name.includes('upper')) mat.color.set('#dc2626');
                else if (name.includes('lower') || name.includes('pants')) mat.color.set('#0d9488');
                else mat.color.set('#475569');
            }
            const nodeName = child.name.toLowerCase();
            if (nodeName.includes('arm') || nodeName.includes('shoulder')) {
                if (nodeName.includes('right')) rightArm.current = child;
                if (nodeName.includes('left')) leftArm.current = child;
            }
        });
        gltf.scene.rotation.y = Math.PI;
    }, [gltf.scene]);

    useEffect(() => {
        if (!actions) return;
        let activeAction = actions['Idle'] || Object.values(actions)[0];
        if (status === 'listening' || status === 'waving') activeAction = actions['Wave'] || actions['Idle'];
        else if (enableRoaming && isMoving && status === 'idle') activeAction = actions['Walk'] || actions['Run'] || actions['Idle'];
        Object.values(actions).forEach(a => { if (a !== activeAction) a?.fadeOut(0.4); });
        activeAction?.reset().fadeIn(0.4).play();
    }, [actions, isMoving, status, enableRoaming]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (group.current) {
            group.current.position.y = Math.sin(t * 1.5) * 0.08;
            if (autoRotate) group.current.rotation.y += 0.01;
            
            if (status === 'speaking') {
                if (rightArm.current) {
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 0.4, 0.1);
                    rightArm.current.rotation.x = -0.5 + Math.sin(t * 8) * 0.2;
                }
                if (leftArm.current) {
                    leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, -0.4, 0.1);
                    leftArm.current.rotation.x = -0.5 + Math.cos(t * 8) * 0.2;
                }
            } else if (!(isMoving && enableRoaming)) {
                if (rightArm.current) {
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 1.3, 0.1);
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0.1, 0.1);
                }
                if (leftArm.current) {
                    leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, -1.3, 0.1);
                    leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0.1, 0.1);
                }
            }
        }
    });

    return (
        <group ref={group} scale={[1.8, 1.8, 1.8]} position={[0, -1.2, 0]}>
            <primitive object={gltf.scene} />
            
            {/* --- DIGITAL VISOR FACE (Eyes & Mouth) --- */}
            <group position={[0, 2.6, 0.35]}>
                {/* Eyes */}
                <mesh position={[-0.06, 0.05, 0]}>
                    <sphereGeometry args={[0.02, 8, 8]} />
                    <meshBasicMaterial color="#00ffff" />
                    <pointLight intensity={1} color="#00ffff" />
                </mesh>
                <mesh position={[0.06, 0.05, 0]}>
                    <sphereGeometry args={[0.02, 8, 8]} />
                    <meshBasicMaterial color="#00ffff" />
                    <pointLight intensity={1} color="#00ffff" />
                </mesh>
                
                {/* Animated Mouth */}
                {status === 'speaking' && (
                    <mesh position={[0, -0.05, 0]}>
                        <boxGeometry args={[0.12, Math.sin(Date.now() * 0.02) * 0.03 + 0.01, 0.01]} />
                        <meshBasicMaterial color="#fff" />
                        <pointLight intensity={2} color="#fff" />
                    </mesh>
                )}
            </group>
        </group>
    );
}

export default function AstraAvatar() {
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState('idle'); 
    const [isMoving, setIsMoving] = useState(false);
    const [enableRoaming, setEnableRoaming] = useState(false);
    const [responseText, setResponseText] = useState('');
    const [autoRotate, setAutoRotate] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [volume, setVolume] = useState<number>(1.0);
    const [showSettings, setShowSettings] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 50, y: 500 });
    const targetRef = useRef({ x: 50, y: 500 });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;
        posRef.current = { x: 50, y: window.innerHeight - 650 };
        targetRef.current = { x: 50, y: window.innerHeight - 650 };

        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices();
            setVoices(v);
            const stored = localStorage.getItem('astra_voice');
            if (stored) setSelectedVoice(stored);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        let animationFrameId: number;
        let lastMoveTime = 0;
        const updatePos = (time: number) => {
            if (enableRoaming && status === 'idle') {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < 50 || time - lastMoveTime > 8000) {
                    targetRef.current = { x: Math.random() * (window.innerWidth - 350) + 50, y: Math.random() * (window.innerHeight - 650) + 50 };
                    lastMoveTime = time;
                }
                if (distance > 10) {
                    setIsMoving(true);
                    posRef.current.x += dx * 0.012;
                    posRef.current.y += dy * 0.012;
                    if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                } else { setIsMoving(false); }
            } else { setIsMoving(false); }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);
        return () => cancelAnimationFrame(animationFrameId);
    }, [enableRoaming, status]);

    const handleAstraClick = () => {
        if (status === 'speaking' || status === 'thinking') {
            window.speechSynthesis.cancel();
            setStatus('idle');
            return;
        }
        setIsMoving(false);
        setStatus('listening');
        recognitionRef.current?.start();
    };

    // Speech AI
    useEffect(() => {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.onresult = async (event: any) => {
                const transcript = event.results[0][0].transcript;
                setStatus('thinking');
                try {
                    const res = await fetch('https://lms-api-bkuw.onrender.com/api/training/chatbot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: "Respond in a helpful yet concise manner (around 3-4 sentences): " + transcript, history: [] })
                    });
                    const data = await res.json();
                    setResponseText(data.reply);
                    setStatus('waving');
                    setTimeout(() => {
                        setStatus('speaking');
                        const utterance = new SpeechSynthesisUtterance(data.reply);
                        const voice = voices.find(v => v.name === selectedVoice);
                        if (voice) utterance.voice = voice;
                        utterance.volume = volume;
                        utterance.onend = () => setStatus('idle');
                        window.speechSynthesis.speak(utterance);
                    }, 800);
                } catch (e) { setStatus('idle'); }
            };
        }
    }, [voices, selectedVoice, volume]);

    if (!mounted) return null;

    const isLeftHalf = typeof window !== 'undefined' && posRef.current.x < window.innerWidth / 2;
    const bubbleStyle = isLeftHalf 
        ? { top: '50px', left: '260px' } // Tighter Gap
        : { top: '50px', left: '-220px' }; // Tighter Gap

    return (
        <div ref={containerRef} style={{ position: 'fixed', zIndex: 10000000, left: 0, top: 0, width: '380px', height: '650px', pointerEvents: 'auto', transform: `translate(${posRef.current.x}px, ${posRef.current.y}px)`, transition: 'transform 0.1s linear' }}>
            
            {(status === 'speaking' || status === 'waving') && responseText && (
                <div style={{ position: 'absolute', ...bubbleStyle, width: '280px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9', zIndex: 10000 }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>{responseText}</p>
                    <div style={{ position: 'absolute', top: '30px', ...(isLeftHalf ? { left: '-10px', clipPath: 'polygon(100% 0%, 100% 100%, 0% 50%)' } : { right: '-10px', clipPath: 'polygon(0% 0%, 0% 100%, 100% 50%)' }), width: '20px', height: '20px', background: 'white' }}></div>
                </div>
            )}

            <div onMouseDown={(e) => { isDragging.current = true; dragOffset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }; }} style={{ width: '100%', height: '100%', position: 'relative', cursor: isDragging.current ? 'grabbing' : 'grab' }}>
                <Canvas style={{ background: 'transparent' }}>
                    <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={35} />
                    <ambientLight intensity={1.5} />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                        <PremiumAvatar status={status} autoRotate={autoRotate} isMoving={isMoving} enableRoaming={enableRoaming} />
                    </Suspense>
                    <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} />
                </Canvas>
                
                {/* Clean Actions Overlay */}
                <div style={{ position: 'absolute', top: '50px', right: '40px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: '20px' }}>⚙️</button>
                    {status === 'speaking' && (
                        <button onClick={handleAstraClick} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '20px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Stop Talking</button>
                    )}
                    {status === 'idle' && (
                        <div onClick={handleAstraClick} style={{ background: '#dc2626', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Ask Astra</div>
                    )}
                </div>
            </div>
            {showSettings && (
                <div style={{ position: 'absolute', top: '150px', right: '40px', width: '260px', background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #f1f5f9', zIndex: 100 }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: 'bold' }}>Settings</h4>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '15px' }}>
                        <input type="checkbox" checked={enableRoaming} onChange={() => setEnableRoaming(!enableRoaming)} /> Enable Roaming
                    </label>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Voice Language</label>
                    <select value={selectedVoice} onChange={(e) => { setSelectedVoice(e.target.value); localStorage.setItem('astra_voice', e.target.value); }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', marginBottom: '15px' }}>
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '15px' }}>
                        <input type="checkbox" checked={autoRotate} onChange={() => setAutoRotate(!autoRotate)} /> Auto-Rotate
                    </label>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Volume</label>
                    <input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#dc2626' }} />
                    <button onClick={() => setShowSettings(false)} style={{ width: '100%', marginTop: '20px', background: '#f1f5f9', color: '#475569', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
                </div>
            )}
        </div>
    );
}

useGLTF.preload('/astra_model.glb');
