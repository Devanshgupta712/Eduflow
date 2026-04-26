'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Premium Skeletal Character (Direct Interaction) ---
function PremiumAvatar({ status, rotation }: { status: string, rotation: number }) {
    const gltf = useGLTF('/astra_model.glb');
    const { actions } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);

    useEffect(() => {
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 });
                const name = mesh.name.toLowerCase();
                if (name.includes('head') || name.includes('skin')) mat.color.set('#ffe0bd');
                else if (name.includes('helmet') || name.includes('cap')) mat.color.set('#dc2626');
                else if (name.includes('upper') || name.includes('jacket') || name.includes('torso')) mat.color.set('#dc2626');
                else if (name.includes('lower') || name.includes('pants') || name.includes('leg')) mat.color.set('#0d9488');
                else mat.color.set('#475569');
                mesh.material = mat;
            }
        });
        
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.x = -center.x;
        gltf.scene.position.y = -center.y - 1.2;
        gltf.scene.position.z = -center.z;
    }, [gltf.scene]);

    useFrame((state) => {
        if (group.current) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.05;
            // Apply mouse rotation
            group.current.rotation.y = rotation;
            
            if (status === 'speaking') {
                group.current.rotation.y += Math.sin(state.clock.elapsedTime * 15) * 0.05;
            }
        }
    });

    return (
        <group ref={group} scale={[2.8, 2.8, 2.8]}>
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
    const [rotation, setRotation] = useState<number>(Math.PI); 
    const [showSettings, setShowSettings] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 50, y: 500 });
    const isDragging = useRef(false);
    const isRotating = useRef(false);
    const startX = useRef(0);
    const startPos = useRef({ x: 0, y: 0 });
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;
        posRef.current = { x: 50, y: window.innerHeight - 700 };

        const loadVoices = () => {
            setVoices(window.speechSynthesis.getVoices());
            const stored = localStorage.getItem('astra_voice');
            if (stored) setSelectedVoice(stored);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        // --- Interaction Listeners ---
        const handleMove = (e: MouseEvent) => {
            if (isRotating.current) {
                const deltaX = e.clientX - startX.current;
                setRotation(prev => prev + deltaX * 0.01);
                startX.current = e.clientX;
            }
            if (isDragging.current && containerRef.current) {
                const newX = e.clientX - startPos.current.x;
                const newY = e.clientY - startPos.current.y;
                containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
                posRef.current = { x: newX, y: newY };
            }
        };
        const handleUp = () => {
            isRotating.current = false;
            isDragging.current = false;
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
    }, []);

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
    }, [voices, selectedVoice, volume]);

    if (!mounted) return null;

    return (
        <div ref={containerRef} style={{ position: 'fixed', zIndex: 10000000, left: 0, top: 0, width: '500px', height: '700px', pointerEvents: 'auto', transform: `translate(${posRef.current.x}px, ${posRef.current.y}px)` }}>
            <div 
                onMouseDown={(e) => { isRotating.current = true; startX.current = e.clientX; }}
                style={{ width: '100%', height: '100%', position: 'relative', cursor: isRotating.current ? 'grabbing' : 'pointer' }}
            >
                <Canvas style={{ background: 'transparent' }}>
                    <PerspectiveCamera makeDefault position={[0, 0, 14]} fov={30} />
                    <ambientLight intensity={1.5} />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                        <PremiumAvatar status={status} rotation={rotation} />
                    </Suspense>
                    <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} />
                </Canvas>
                
                {/* Drag Handle & Status */}
                <div 
                    onMouseDown={(e) => { e.stopPropagation(); isDragging.current = true; startPos.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }; }}
                    style={{ 
                        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', 
                        background: '#dc2626', color: 'white', padding: '8px 24px', borderRadius: '30px', 
                        fontSize: '14px', fontWeight: 'bold', boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                        cursor: 'move', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <span>{status === 'listening' ? '👂 Listening...' : status === 'thinking' ? '🧠 thinking...' : status === 'speaking' ? '🗣️ Speaking...' : '🚀 Astra (Drag to Move)'}</span>
                </div>

                {/* Settings Gear */}
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                    style={{ position: 'absolute', right: '60px', top: '60px', background: 'white', border: 'none', borderRadius: '50%', width: '44px', height: '44px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: '22px' }}
                >
                    ⚙️
                </button>
            </div>

            {/* Interaction Button */}
            {status === 'idle' && (
                <button 
                    onClick={() => { setStatus('listening'); recognitionRef.current?.start(); }}
                    style={{ position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '30px', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 10px 25px rgba(220,38,38,0.3)', cursor: 'pointer' }}
                >
                    Talk to Astra
                </button>
            )}

            {showSettings && (
                <div style={{ position: 'absolute', top: '120px', right: '60px', width: '280px', background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #f1f5f9', zIndex: 100 }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>Astra Controls</h4>
                    <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>Voice Character</label>
                    <select 
                        value={selectedVoice} 
                        onChange={(e) => { setSelectedVoice(e.target.value); localStorage.setItem('astra_voice', e.target.value); }}
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', marginBottom: '20px' }}
                    >
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>Volume Level</label>
                    <input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#dc2626' }} />
                    <button onClick={() => setShowSettings(false)} style={{ width: '100%', marginTop: '20px', background: '#f1f5f9', color: '#475569', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Close Settings</button>
                </div>
            )}

            {status === 'speaking' && responseText && (
                <div style={{ position: 'absolute', top: '120px', left: '50%', transform: 'translateX(-50%)', width: '320px', background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: '15px', color: '#334155', fontWeight: 500, lineHeight: '1.5' }}>{responseText}</p>
                </div>
            )}
        </div>
    );
}

useGLTF.preload('/astra_model.glb');
