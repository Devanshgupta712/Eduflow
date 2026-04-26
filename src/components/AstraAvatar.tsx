'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Professional Skeletal Character (Student Re-Skin) ---
function PremiumAvatar({ status }: { status: string }) {
    const gltf = useGLTF('/astra_model.glb');
    const { actions } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                // Fabric material (not metal)
                const mat = new THREE.MeshStandardMaterial({ roughness: 1.0, metalness: 0.0 });
                const name = mesh.name.toLowerCase();
                
                if (name.includes('head') || name.includes('skin')) {
                    mat.color.set('#ffe0bd');
                } else if (name.includes('helmet') || name.includes('cap')) {
                    mat.color.set('#dc2626'); // Red Cap
                } else if (name.includes('upper') || name.includes('jacket') || name.includes('torso')) {
                    mat.color.set('#dc2626'); // Red Hoodie
                } else if (name.includes('lower') || name.includes('pants') || name.includes('leg')) {
                    mat.color.set('#0d9488'); // Teal Jeans
                } else {
                    mat.color.set('#475569'); // Student Grey details
                }
                mesh.material = mat;
            }
        });
        gltf.scene.rotation.y = Math.PI;
    }, [gltf.scene]);

    useEffect(() => {
        if (!actions) return;
        const idle = actions['Idle'];
        if (idle) idle.reset().fadeIn(0.5).play();
        return () => { if (idle) idle.fadeOut(0.5); };
    }, [actions]);

    useFrame((state) => {
        if (group.current) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
            if (status === 'speaking') {
                group.current.rotation.y = Math.PI + Math.sin(state.clock.elapsedTime * 15) * 0.08;
            } else {
                group.current.rotation.y = Math.PI + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
            }
        }
    });

    return (
        <group ref={group} scale={[2.4, 2.4, 2.4]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

export default function AstraAvatar() {
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState('idle'); 
    const [responseText, setResponseText] = useState('');
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [showSettings, setShowSettings] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 50, y: 500 });
    const targetRef = useRef({ x: 50, y: 500 });
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;

        posRef.current = { x: 50, y: window.innerHeight - 500 };
        targetRef.current = { x: 50, y: window.innerHeight - 500 };

        // Load Voices
        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices();
            setVoices(v);
            const stored = localStorage.getItem('astra_voice');
            if (stored) setSelectedVoice(stored);
            else if (v.length > 0) setSelectedVoice(v[0].name);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        // Autonomous Roaming
        let animationFrameId: number;
        let lastMoveTime = 0;
        const updatePos = (time: number) => {
            if (status === 'idle' && !showSettings) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                if (Math.sqrt(dx*dx + dy*dy) < 50 || time - lastMoveTime > 7000) {
                    targetRef.current = { 
                        x: Math.random() * (window.innerWidth - 350) + 50, 
                        y: Math.random() * (window.innerHeight - 500) + 50 
                    };
                    lastMoveTime = time;
                }
                posRef.current.x += dx * 0.01;
                posRef.current.y += dy * 0.01;
                if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);

        // Speech AI
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.onresult = async (event: any) => {
                const transcript = event.results[0][0].transcript;
                setStatus('thinking');
                try {
                    const res = await fetch('https://lms-api-bkuw.onrender.com/api/training/chatbot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: transcript, history: [] })
                    });
                    const data = await res.json();
                    setResponseText(data.reply);
                    setStatus('speaking');
                    
                    const utterance = new SpeechSynthesisUtterance(data.reply);
                    const voice = voices.find(v => v.name === selectedVoice);
                    if (voice) utterance.voice = voice;
                    utterance.onend = () => setStatus('idle');
                    window.speechSynthesis.speak(utterance);
                } catch (e) { setStatus('idle'); }
            };
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [status, voices, selectedVoice, showSettings]);

    if (!mounted) return null;

    return (
        <div ref={containerRef} style={{ position: 'fixed', zIndex: 10000000, left: 0, top: 0, width: '350px', height: '550px', pointerEvents: 'auto' }}>
            <div onClick={() => { if (!showSettings) { setStatus('listening'); recognitionRef.current?.start(); } }} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}>
                <Canvas style={{ background: 'transparent' }}>
                    <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={35} />
                    <ambientLight intensity={1.5} />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                        <PremiumAvatar status={status} />
                    </Suspense>
                    <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
                </Canvas>
                
                {/* Status Badge */}
                <div style={{ 
                    position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', 
                    background: '#dc2626', color: 'white', padding: '6px 20px', borderRadius: '24px', 
                    fontSize: '13px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' 
                }}>
                    {status === 'listening' ? '👂 Listening...' : status === 'thinking' ? '🧠 Thinking...' : status === 'speaking' ? '🗣️ Speaking...' : '👋 Click me'}
                </div>

                {/* Settings Gear */}
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                    style={{ position: 'absolute', right: '40px', bottom: '150px', background: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: '18px' }}
                >
                    ⚙️
                </button>
            </div>

            {/* Voice Settings Menu */}
            {showSettings && (
                <div style={{ position: 'absolute', bottom: '190px', right: '40px', width: '250px', background: 'white', padding: '16px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9', zIndex: 100 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Choose Voice</h4>
                    <select 
                        value={selectedVoice} 
                        onChange={(e) => { setSelectedVoice(e.target.value); localStorage.setItem('astra_voice', e.target.value); }}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '12px' }}
                    >
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <button onClick={() => setShowSettings(false)} style={{ width: '100%', marginTop: '10px', background: '#dc2626', color: 'white', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
                </div>
            )}

            {status === 'speaking' && responseText && !showSettings && (
                <div style={{ position: 'absolute', bottom: '480px', left: '10px', width: '300px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 600 }}>{responseText}</p>
                </div>
            )}
        </div>
    );
}

useGLTF.preload('/astra_model.glb');
