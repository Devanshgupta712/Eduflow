'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Premium Skeletal Character (Student Re-Skin) ---
function PremiumAvatar({ status, rotation }: { status: string, rotation: number }) {
    const gltf = useGLTF('/astra_model.glb');
    const { actions } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = new THREE.MeshStandardMaterial({ roughness: 1.0, metalness: 0.0 });
                const name = mesh.name.toLowerCase();
                
                if (name.includes('head') || name.includes('skin')) mat.color.set('#ffe0bd');
                else if (name.includes('helmet') || name.includes('cap')) mat.color.set('#dc2626');
                else if (name.includes('upper') || name.includes('jacket') || name.includes('torso')) mat.color.set('#dc2626');
                else if (name.includes('lower') || name.includes('pants') || name.includes('leg')) mat.color.set('#0d9488');
                else mat.color.set('#475569');
                mesh.material = mat;
            }
        });
        
        // Base Center
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.x = -center.x;
        gltf.scene.position.y = -center.y - 1.0;
        gltf.scene.position.z = -center.z;
    }, [gltf.scene]);

    useFrame((state) => {
        if (group.current) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
            // Manual rotation from slider
            group.current.rotation.y = rotation;
            
            if (status === 'speaking') {
                group.current.rotation.y += Math.sin(state.clock.elapsedTime * 15) * 0.05;
            }
        }
    });

    return (
        <group ref={group} scale={[2.6, 2.6, 2.6]}>
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
    const [volume, setVolume] = useState<number>(1.0);
    const [rotation, setRotation] = useState<number>(Math.PI); // Default PI
    const [showSettings, setShowSettings] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 50, y: 500 });
    const targetRef = useRef({ x: 50, y: 500 });
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;

        posRef.current = { x: 50, y: window.innerHeight - 600 };
        targetRef.current = { x: 50, y: window.innerHeight - 600 };

        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices();
            setVoices(v);
            const stored = localStorage.getItem('astra_voice');
            if (stored) setSelectedVoice(stored);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        // Roaming
        let animationFrameId: number;
        let lastMoveTime = 0;
        const updatePos = (time: number) => {
            if (status === 'idle' && !showSettings) {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                if (Math.sqrt(dx*dx + dy*dy) < 50 || time - lastMoveTime > 8000) {
                    targetRef.current = { 
                        x: Math.random() * (window.innerWidth - 350) + 50, 
                        y: Math.random() * (window.innerHeight - 650) + 50 
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
                    utterance.volume = volume;
                    utterance.onend = () => setStatus('idle');
                    window.speechSynthesis.speak(utterance);
                } catch (e) { setStatus('idle'); }
            };
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [status, voices, selectedVoice, showSettings, volume]);

    if (!mounted) return null;

    return (
        <div ref={containerRef} style={{ position: 'fixed', zIndex: 10000000, left: 0, top: 0, width: '350px', height: '650px', pointerEvents: 'auto' }}>
            <div onClick={() => { if (!showSettings) { setStatus('listening'); recognitionRef.current?.start(); } }} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}>
                <Canvas style={{ background: 'transparent' }}>
                    {/* Camera moved further back to position 12 for GUARANTEED full body view */}
                    <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={35} />
                    <ambientLight intensity={1.5} />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                        <PremiumAvatar status={status} rotation={rotation} />
                    </Suspense>
                    <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
                </Canvas>
                
                <div style={{ 
                    position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', 
                    background: '#dc2626', color: 'white', padding: '6px 20px', borderRadius: '24px', 
                    fontSize: '13px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' 
                }}>
                    {status === 'listening' ? '👂 Listening...' : status === 'thinking' ? '🧠 Thinking...' : status === 'speaking' ? '🗣️ Speaking...' : '👋 Click me'}
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                    style={{ position: 'absolute', right: '40px', bottom: '250px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: '20px' }}
                >
                    ⚙️
                </button>
            </div>

            {showSettings && (
                <div style={{ position: 'absolute', bottom: '300px', right: '40px', width: '280px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', border: '1px solid #f1f5f9', zIndex: 100 }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: 'bold' }}>Astra Settings</h4>
                    
                    <label style={{ fontSize: '12px', color: '#64748b' }}>Choose Voice</label>
                    <select 
                        value={selectedVoice} 
                        onChange={(e) => { setSelectedVoice(e.target.value); localStorage.setItem('astra_voice', e.target.value); }}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '12px', marginBottom: '15px' }}
                    >
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>

                    <label style={{ fontSize: '12px', color: '#64748b' }}>Volume (Voice Level)</label>
                    <input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} style={{ width: '100%', marginBottom: '15px' }} />

                    <label style={{ fontSize: '12px', color: '#64748b' }}>Rotate Astra (360°)</label>
                    <input type="range" min="0" max={Math.PI * 2} step="0.1" value={rotation} onChange={(e) => setRotation(parseFloat(e.target.value))} style={{ width: '100%', marginBottom: '15px' }} />

                    <button onClick={() => setShowSettings(false)} style={{ width: '100%', background: '#dc2626', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Save & Close</button>
                </div>
            )}

            {status === 'speaking' && responseText && !showSettings && (
                <div style={{ position: 'absolute', bottom: '580px', left: '10px', width: '300px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 600 }}>{responseText}</p>
                </div>
            )}
        </div>
    );
}

useGLTF.preload('/astra_model.glb');
