'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- PREMIUM HUMAN STUDENT CHARACTER ---
function PremiumHumanAvatar({ status, autoRotate, isMoving, enableRoaming }: { status: string, autoRotate: boolean, isMoving: boolean, enableRoaming: boolean }) {
    const gltf = useGLTF('/student_avatar.glb');
    const { actions, names } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    // Log available animations on first load so we can debug
    useEffect(() => {
        console.log('Available animations:', names);
        console.log('Actions:', Object.keys(actions));
        
        // Set nice materials on the human model
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((mat) => {
                        if (mat instanceof THREE.MeshStandardMaterial) {
                            mat.roughness = 0.6;
                            mat.metalness = 0.1;
                        }
                    });
                } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
                    mesh.material.roughness = 0.6;
                    mesh.material.metalness = 0.1;
                }
            }
        });
    }, [gltf.scene, names, actions]);

    // --- Animation State Machine ---
    useEffect(() => {
        if (!actions || names.length === 0) return;

        // Find the best matching animation for each state
        const findAnim = (...keywords: string[]) => {
            for (const kw of keywords) {
                const found = names.find(n => n.toLowerCase().includes(kw.toLowerCase()));
                if (found && actions[found]) return actions[found];
            }
            return null;
        };

        let targetAction: THREE.AnimationAction | null = null;

        if (status === 'waving' || status === 'listening') {
            targetAction = findAnim('wave', 'greet', 'hello');
        } else if (status === 'speaking') {
            targetAction = findAnim('talk', 'gesture');
        } else if (enableRoaming && isMoving) {
            targetAction = findAnim('walk', 'run', 'locomotion');
        }
        // For 'idle' and 'thinking': NO animation — just stand still

        // Stop all animations first
        Object.values(actions).forEach(a => a?.fadeOut(0.3));

        // Only play if we found a specific animation for the current state
        if (targetAction) {
            targetAction.reset().fadeIn(0.3).play();
        }
    }, [actions, names, isMoving, status, enableRoaming]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (group.current) {
            // Gentle hover
            group.current.position.y = Math.sin(t * 1.5) * 0.06;
            if (autoRotate) group.current.rotation.y += 0.008;
        }
    });

    return (
        <group ref={group} scale={[0.9, 0.9, 0.9]} position={[0, -1.2, 0]}>
            <primitive object={gltf.scene} />
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

    // --- Global Drag Logic ---
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging.current) {
                posRef.current.x = e.clientX - dragOffset.current.x;
                posRef.current.y = e.clientY - dragOffset.current.y;
                targetRef.current = { ...posRef.current };
                if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            }
        };
        const handleGlobalMouseUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, []);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;
        posRef.current = { x: 50, y: window.innerHeight - 500 };
        targetRef.current = { x: 50, y: window.innerHeight - 500 };

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
            if (enableRoaming && status === 'idle' && !isDragging.current) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < 50 || time - lastMoveTime > 8000) {
                    targetRef.current = { x: Math.random() * (window.innerWidth - 350) + 50, y: Math.random() * (window.innerHeight - 500) + 50 };
                    lastMoveTime = time;
                }
                if (distance > 10) {
                    setIsMoving(true);
                    posRef.current.x += dx * 0.012;
                    posRef.current.y += dy * 0.012;
                    if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                } else { setIsMoving(false); }
            } else if (!isDragging.current) {
                setIsMoving(false);
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);
        return () => cancelAnimationFrame(animationFrameId);
    }, [enableRoaming, status]);

    const handleAstraClick = (e: React.MouseEvent) => {
        e.stopPropagation();
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
        ? { top: '50px', left: '260px' } 
        : { top: '50px', left: '-220px' }; 

    return (
        <div ref={containerRef} style={{ position: 'fixed', zIndex: 10000000, left: 0, top: 0, width: '300px', height: '450px', pointerEvents: 'auto', transform: `translate(${posRef.current.x}px, ${posRef.current.y}px)`, transition: 'transform 0.1s linear' }}>
            
            {(status === 'speaking' || status === 'waving') && responseText && (
                <div style={{ position: 'absolute', ...bubbleStyle, width: '280px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9', zIndex: 10000 }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>{responseText}</p>
                    <div style={{ position: 'absolute', top: '30px', ...(isLeftHalf ? { left: '-10px', clipPath: 'polygon(100% 0%, 100% 100%, 0% 50%)' } : { right: '-10px', clipPath: 'polygon(0% 0%, 0% 100%, 100% 50%)' }), width: '20px', height: '20px', background: 'white' }}></div>
                </div>
            )}

            <div 
                onMouseDown={(e) => { 
                    isDragging.current = true; 
                    dragOffset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }; 
                }} 
                style={{ width: '100%', height: '100%', position: 'relative', cursor: isDragging.current ? 'grabbing' : 'grab' }}
            >
                <Canvas shadows>
                    <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={30} />
                    <ambientLight intensity={1.5} />
                    <spotLight position={[5, 5, 5]} angle={0.3} penumbra={1} intensity={2} castShadow />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                        <PremiumHumanAvatar status={status} autoRotate={autoRotate} isMoving={isMoving} enableRoaming={enableRoaming} />
                    </Suspense>
                    <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} />
                </Canvas>
                
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

useGLTF.preload('/student_avatar.glb');
