'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';

// --- ROBOT EXPRESSIVE (Full Animation + Morph Target Engine) ---
function ExpressiveBot({ status, isMoving, enableRoaming }: { status: string, isMoving: boolean, enableRoaming: boolean }) {
    const gltf = useGLTF('/student_avatar.glb');
    const { actions, names, mixer } = useAnimations(gltf.animations, gltf.scene);
    const group = useRef<THREE.Group>(null);
    const headMesh = useRef<THREE.Mesh | null>(null);

    // Find the head mesh with morph targets
    useEffect(() => {
        console.log('RobotExpressive animations:', names);
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0) {
                    headMesh.current = mesh;
                    console.log('Morph targets found:', mesh.morphTargetDictionary);
                }
            }
        });
    }, [gltf.scene, names]);

    // --- Full Animation State Machine ---
    useEffect(() => {
        if (!actions || names.length === 0) return;

        const findAnim = (...keywords: string[]) => {
            for (const kw of keywords) {
                const found = names.find(n => n.toLowerCase().includes(kw.toLowerCase()));
                if (found && actions[found]) return actions[found];
            }
            return null;
        };

        // Stop all first
        Object.values(actions).forEach(a => a?.fadeOut(0.3));

        let targetAction: THREE.AnimationAction | null = null;

        if (status === 'clicking') {
            targetAction = findAnim('punch', 'thumbsup', 'yes');
        } else if (status === 'waving' || status === 'listening') {
            targetAction = findAnim('wave', 'thumbsup', 'yes');
        } else if (status === 'speaking') {
            targetAction = findAnim('talk', 'idle', 'yes');
        } else if (status === 'thinking') {
            targetAction = findAnim('idle', 'stand');
        } else if ((enableRoaming && isMoving) || status === 'walking_to_click') {
            targetAction = findAnim('walk', 'walking', 'run', 'running');
        } else {
            // Idle: just stand still
            targetAction = findAnim('idle', 'stand');
        }

        if (targetAction) {
            targetAction.reset().fadeIn(0.3).play();
        }
    }, [actions, names, isMoving, status, enableRoaming]);

    // --- Morph Target Mouth Animation ---
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (group.current) {
            group.current.position.y = Math.sin(t * 1.5) * 0.04;
        }

        // Animate mouth morph targets while speaking
        if (headMesh.current && headMesh.current.morphTargetDictionary && headMesh.current.morphTargetInfluences) {
            const dict = headMesh.current.morphTargetDictionary;
            const influences = headMesh.current.morphTargetInfluences;

            if (status === 'speaking') {
                // Open/close mouth in sync with "speech"
                const mouthIdx = dict['Surprised'] ?? dict['surprised'] ?? dict['mouthOpen'] ?? dict['jawOpen'];
                if (mouthIdx !== undefined) {
                    influences[mouthIdx] = Math.abs(Math.sin(t * 12)) * 0.6;
                }
                // Happy expression while talking
                const happyIdx = dict['Happy'] ?? dict['happy'] ?? dict['smile'];
                if (happyIdx !== undefined) {
                    influences[happyIdx] = 0.4;
                }
            } else if (status === 'thinking') {
                // Sad/thinking expression
                const sadIdx = dict['Sad'] ?? dict['sad'];
                if (sadIdx !== undefined) {
                    influences[sadIdx] = 0.5;
                }
                // Reset others
                const happyIdx = dict['Happy'] ?? dict['happy'];
                if (happyIdx !== undefined) influences[happyIdx] = 0;
                const surprisedIdx = dict['Surprised'] ?? dict['surprised'];
                if (surprisedIdx !== undefined) influences[surprisedIdx] = 0;
            } else if (status === 'waving' || status === 'listening') {
                // Happy greeting
                const happyIdx = dict['Happy'] ?? dict['happy'];
                if (happyIdx !== undefined) influences[happyIdx] = 0.8;
            } else {
                // Reset all morph targets for idle
                for (let i = 0; i < influences.length; i++) {
                    influences[i] = THREE.MathUtils.lerp(influences[i], 0, 0.1);
                }
            }
        }
    });

    return (
        <group ref={group} scale={[0.22, 0.22, 0.22]} position={[0, -0.4, 0]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

export default function AstraAvatar() {
    const router = useRouter();
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
    const [isHidden, setIsHidden] = useState(false);
    const [inputLanguage, setInputLanguage] = useState('en-IN');
    const [showChatBubble, setShowChatBubble] = useState(false);
    const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean; clicking: boolean }>({ x: 0, y: 0, visible: false, clicking: false });
    
    const containerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: typeof window !== 'undefined' ? window.innerWidth - 320 : 800, y: typeof window !== 'undefined' ? window.innerHeight - 420 : 400 });
    const targetRef = useRef({ x: typeof window !== 'undefined' ? window.innerWidth - 320 : 800, y: typeof window !== 'undefined' ? window.innerHeight - 420 : 400 });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const recognitionRef = useRef<any>(null);
    const walkAndClickRef = useRef<(path: string) => void>(() => {});

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
        posRef.current = { x: window.innerWidth - 320, y: window.innerHeight - 420 };
        targetRef.current = { x: window.innerWidth - 320, y: window.innerHeight - 420 };

        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices();
            setVoices(v);
            const storedVoice = localStorage.getItem('astra_voice');
            if (storedVoice) setSelectedVoice(storedVoice);
            const storedLang = localStorage.getItem('astra_lang');
            if (storedLang) setInputLanguage(storedLang);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        let animationFrameId: number;
        let lastMoveTime = 0;
        const updatePos = (time: number) => {
            if ((enableRoaming && status === 'idle' && !isDragging.current) || status === 'walking_to_click') {
                const dx = targetRef.current.x - posRef.current.x;
                const dy = targetRef.current.y - posRef.current.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (enableRoaming && status === 'idle') {
                    if (distance < 50 || time - lastMoveTime > 8000) {
                        targetRef.current = { x: Math.random() * (window.innerWidth - 350) + 50, y: Math.random() * (window.innerHeight - 500) + 50 };
                        lastMoveTime = time;
                    }
                }

                if (distance > 10) {
                    setIsMoving(true);
                    const speed = status === 'walking_to_click' ? 0.05 : 0.012;
                    posRef.current.x += dx * speed;
                    posRef.current.y += dy * speed;
                    if (containerRef.current) containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
                } else { 
                    setIsMoving(false); 
                    if (status === 'walking_to_click') {
                        setStatus('clicking');
                    }
                }
            } else if (!isDragging.current) {
                setIsMoving(false);
            }
            animationFrameId = requestAnimationFrame(updatePos);
        };
        animationFrameId = requestAnimationFrame(updatePos);
        return () => cancelAnimationFrame(animationFrameId);
    }, [enableRoaming, status]);

    useEffect(() => {
        if (status === 'clicking') {
            const timer = setTimeout(() => {
                if (pendingNavigationPath) {
                    router.push(pendingNavigationPath);
                    setPendingNavigationPath(null);
                }
                setStatus('idle');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [status, pendingNavigationPath, router]);

    // --- Client-side Route Normalizer (AI-proof) ---
    const ROUTE_MAP: Record<string, string> = {
        '/batches': '/admin/batches',
        '/courses': '/admin/courses',
        '/students': '/admin/students',
        '/registrations': '/admin/registrations',
        '/leaves': '/admin/leaves',
        '/time-tracking': '/admin/time-tracking',
        '/reports': '/admin/reports',
        '/sessions': '/admin/sessions',
        '/feedback': '/admin/feedback',
        '/suggestions': '/admin/suggestions',
        '/users': '/admin/users',
        '/settings': '/admin/settings',
        '/attendance': '/training/attendance',
        '/tasks': '/training/tasks',
        '/assignments': '/training/assignments',
        '/videos': '/training/videos',
        '/violations': '/training/violations',
        '/projects': '/training/projects',
        '/leads': '/marketing/leads',
        '/campaigns': '/marketing/campaigns',
        '/jobs': '/placement/jobs',
        '/assessments': '/placement/assessments',
        '/mock-interviews': '/placement/mock-interviews',
        '/practice': '/placement/practice',
        '/profile': '/student/profile',
        '/resume': '/student/resume',
        '/notifications': '/student/notifications',
    };

    const normalizeNavPath = (raw: string): string => {
        const trimmed = raw.trim().toLowerCase();
        // Already a full known path — return as-is
        if (trimmed.startsWith('/admin/') || trimmed.startsWith('/training/') ||
            trimmed.startsWith('/marketing/') || trimmed.startsWith('/placement/') ||
            trimmed.startsWith('/student/') || trimmed === '/dashboard') {
            return trimmed;
        }
        // Correct short/wrong paths using map
        return ROUTE_MAP[trimmed] || trimmed;
    };

    // --- Walk + Cursor Click Animation ---
    const walkAndClick = (rawNavPath: string) => {
        const navPath = normalizeNavPath(rawNavPath);
        // Find the link using multiple selector strategies
        let linkEl: HTMLElement | null = 
            document.querySelector(`a[href="${navPath}"]`) ||
            document.querySelector(`a[href$="${navPath}"]`) ||
            null;

        // Fallback: full querySelectorAll scan
        if (!linkEl) {
            document.querySelectorAll('a').forEach((a) => {
                if (!linkEl && (a as HTMLAnchorElement).href.includes(navPath)) linkEl = a as HTMLElement;
            });
        }

        if (linkEl) {
            const rect = linkEl.getBoundingClientRect();
            const targetX = rect.left + rect.width / 2;
            const targetY = rect.top + rect.height / 2;

            // Walk Astra's body toward the link
            targetRef.current = { 
                x: Math.max(0, rect.left - 160), 
                y: Math.max(0, rect.top - 100) 
            };
            setStatus('walking_to_click');
            setPendingNavigationPath(navPath);

            // Animate floating cursor hand starting at Astra's position
            setCursorPos({ x: posRef.current.x + 140, y: posRef.current.y + 100, visible: true, clicking: false });
            
            setTimeout(() => {
                setCursorPos({ x: targetX - 16, y: targetY - 16, visible: true, clicking: false });
            }, 100);

            setTimeout(() => {
                setCursorPos(prev => ({ ...prev, clicking: true }));
                const el = linkEl;
                if (el) {
                    const orig = el.style.outline;
                    el.style.outline = '3px solid #10b981';
                    el.style.outlineOffset = '4px';
                    el.style.borderRadius = '8px';
                    setTimeout(() => { if (el) { el.style.outline = orig; } }, 800);
                }
            }, 1400);

            setTimeout(() => {
                setCursorPos(prev => ({ ...prev, visible: false, clicking: false }));
                router.push(navPath);
                setPendingNavigationPath(null);
                setStatus('idle');
            }, 2000);
        } else {
            // No link found on screen — navigate directly
            router.push(navPath);
        }
    };
    // Always keep the ref up-to-date so speech useEffect closure is never stale
    walkAndClickRef.current = walkAndClick;

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

    // --- PERSONALIZATION ENGINE ---
    const getUserContext = () => {
        if (typeof window === 'undefined') return { name: 'Guest', role: 'GUEST', email: '', page: '/' };
        try {
            const raw = localStorage.getItem('auth_user');
            const user = raw ? JSON.parse(raw) : null;
            const page = window.location.pathname;
            const pageTitle = document.title;
            return {
                name: user?.name || 'Guest',
                role: user?.role || 'GUEST',
                email: user?.email || '',
                batch: user?.batch_name || user?.batch || '',
                page,
                pageTitle
            };
        } catch { return { name: 'Guest', role: 'GUEST', email: '', page: '/', pageTitle: '' }; }
    };

    const buildPersonalizedPrompt = (userMessage: string) => {
        const ctx = getUserContext();
        const firstName = ctx.name.split(' ')[0];
        const pageName = ctx.page.replace(/\//g, ' > ').replace(/>/g, '›').trim() || 'Home';

        let rolePersonality = '';
        let navInstruction = `CRITICAL: ONLY append exactly "[NAVIGATE: /path]" to the very end of your response IF AND ONLY IF the user EXPLICITLY asks you to "take me to", "go to", "open", or "redirect to" a specific page. DO NOT use this command if they are just asking a question. Use ONLY these exact paths:
- Dashboard → [NAVIGATE: /dashboard]
- Leads → [NAVIGATE: /marketing/leads]
- Campaigns → [NAVIGATE: /marketing/campaigns]
- Courses → [NAVIGATE: /admin/courses]
- Batches → [NAVIGATE: /admin/batches]
- Registrations → [NAVIGATE: /admin/registrations]
- Students → [NAVIGATE: /admin/students]
- Leaves (admin) → [NAVIGATE: /admin/leaves]
- Time Tracking → [NAVIGATE: /admin/time-tracking]
- Reports (admin) → [NAVIGATE: /admin/reports]
- Sessions (admin) → [NAVIGATE: /admin/sessions]
- Feedback (admin) → [NAVIGATE: /admin/feedback]
- Attendance → [NAVIGATE: /training/attendance]
- Tasks (trainer) → [NAVIGATE: /training/tasks]
- Assignments → [NAVIGATE: /training/assignments]
- Videos → [NAVIGATE: /training/videos]
- Violations → [NAVIGATE: /training/violations]
- My Profile → [NAVIGATE: /student/profile]
- My Courses → [NAVIGATE: /student/courses]
- Job Board → [NAVIGATE: /student/jobs]
- Notifications → [NAVIGATE: /student/notifications]
- Resume Builder → [NAVIGATE: /student/resume]
- Jobs (placement) → [NAVIGATE: /placement/jobs]
- Assessments → [NAVIGATE: /placement/assessments]
- Mock Interviews → [NAVIGATE: /placement/mock-interviews]
- Settings → [NAVIGATE: /admin/settings]
- Users → [NAVIGATE: /admin/users]`;

        if (ctx.role === 'STUDENT') {
            rolePersonality = `You are talking to a student/trainee named ${firstName}. Be a friendly, encouraging tutor. Help them with assignments, courses, and career guidance. If they're on an assessment page, wish them luck. If they're on attendance, help them track it.`;
        } else if (ctx.role === 'TRAINER') {
            rolePersonality = `You are talking to a trainer named ${firstName}. Be professional and supportive. Help them manage batches, track trainee progress, and handle attendance.`;
        } else if (ctx.role === 'ADMIN') {
            rolePersonality = `You are talking to an admin named ${firstName}. Be professional and efficient. Help them with reports, managing users, batches, and system operations.`;
        } else if (ctx.role === 'SUPER_ADMIN') {
            rolePersonality = `You are talking to a Super Admin named ${firstName}. Be an executive advisor. Help with system-wide decisions, analytics, and platform management.`;
        } else if (ctx.role === 'MARKETER') {
            rolePersonality = `You are talking to a marketer named ${firstName}. Help them with leads, campaigns, and enrollment metrics.`;
        } else {
            rolePersonality = `You are talking to a visitor. Be welcoming and help them understand the platform, courses, and enrollment process.`;
            navInstruction = `DO NOT use the [NAVIGATE: /path] command. If they ask to go to a dashboard or specific page, politely tell them they need to log in first to access those areas.`;
        }

        return `You are Astra, a friendly AI assistant for the EduSuite.ai Learning Management System. ${rolePersonality} The user is currently on the page: "${pageName}". IMPORTANT: Always respond in the exact same language that the user is speaking to you in. Respond concisely in 3-4 sentences. Address them as ${firstName}. ${navInstruction} User says: ${userMessage}`;
    };

    // Speech AI (Personalized)
    useEffect(() => {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = inputLanguage;
            recognitionRef.current.onresult = async (event: any) => {
                const transcript = event.results[0][0].transcript;
                setStatus('thinking');
                try {
                    const personalizedMessage = buildPersonalizedPrompt(transcript);
                    const res = await fetch('https://lms-api-bkuw.onrender.com/api/training/chatbot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: personalizedMessage, history: [] })
                    });
                    const data = await res.json();
                    let finalReply = data.reply;
                    
                    if (!finalReply) {
                        finalReply = "I'm sorry, I couldn't process that right now. Please try asking again.";
                    }
                    
                    // Parse Navigation Command
                    const navMatch = finalReply.match(/\[NAVIGATE:\s*([^\]]+)\]/i);
                    let isNavigating = false;
                    if (navMatch) {
                        const navPath = navMatch[1].trim();
                        finalReply = finalReply.replace(/\[NAVIGATE:\s*([^\]]+)\]/gi, '').trim();
                        isNavigating = true;
                        walkAndClickRef.current(navPath);
                    }

                    setResponseText(finalReply);
                    setShowChatBubble(true);
                    if (!isNavigating) setStatus('waving');
                    
                    setTimeout(() => {
                        if (!isNavigating) setStatus('speaking');
                        const utterance = new SpeechSynthesisUtterance(finalReply);
                        utterance.lang = inputLanguage; // Ensure TTS engine uses the right accent
                        const voice = voices.find(v => v.name === selectedVoice);
                        if (voice) utterance.voice = voice;
                        utterance.volume = volume;
                        utterance.onend = () => { if (!isNavigating) setStatus('idle'); };
                        window.speechSynthesis.speak(utterance);
                    }, 800);
                } catch (e) { setStatus('idle'); }
            };
        }
    }, [voices, selectedVoice, volume, inputLanguage]);

    if (!mounted) return null;

    // Show a small floating button when hidden
    if (isHidden) {
        return (
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 10000000 }}>
                <button onClick={() => setIsHidden(false)} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '50px', padding: '10px 18px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤖 Show Astra
                </button>
            </div>
        );
    }

    const isLeftHalf = typeof window !== 'undefined' && posRef.current.x < window.innerWidth / 2;
    const bubbleStyle = isLeftHalf 
        ? { top: '20px', left: '220px' } 
        : { top: '20px', left: '-230px' }; 

    return (
        <div ref={containerRef} style={{ position: 'fixed', zIndex: 10000000, left: 0, top: 0, width: '280px', height: '380px', pointerEvents: 'auto', transform: `translate(${posRef.current.x}px, ${posRef.current.y}px)`, transition: 'transform 0.1s linear' }}>
            
            {showChatBubble && responseText && (
                <div style={{ position: 'absolute', ...bubbleStyle, width: '260px', background: 'white', padding: '18px', borderRadius: '20px', boxShadow: '0 15px 40px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9', zIndex: 10000 }}>
                    <button onClick={(e) => { e.stopPropagation(); setShowChatBubble(false); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' }}>✕</button>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', fontWeight: 600, lineHeight: 1.5, paddingRight: '12px' }}>{responseText}</p>
                    
                    <div style={{ position: 'absolute', top: '25px', ...(isLeftHalf ? { left: '-10px', clipPath: 'polygon(100% 0%, 100% 100%, 0% 50%)' } : { right: '-10px', clipPath: 'polygon(0% 0%, 0% 100%, 100% 50%)' }), width: '16px', height: '16px', background: 'white' }}></div>
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
                    <PerspectiveCamera makeDefault position={[0, 0.3, 8]} fov={20} />
                    <ambientLight intensity={1.5} />
                    <spotLight position={[5, 5, 5]} angle={0.3} penumbra={1} intensity={2} castShadow />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                        <ExpressiveBot status={status} isMoving={isMoving} enableRoaming={enableRoaming} />
                    </Suspense>
                    <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} />
                </Canvas>
                
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setIsHidden(true); }} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', boxShadow: '0 4px 12px rgba(239,68,68,0.3)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', lineHeight: '28px' }}>✕</button>
                    <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: '13px' }}>⚙️</button>
                    <div onClick={handleAstraClick} style={{ background: status === 'speaking' ? '#dc2626' : status === 'listening' ? '#f59e0b' : status === 'thinking' ? '#8b5cf6' : '#10b981', color: 'white', padding: '5px 8px', borderRadius: '14px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        {status === 'listening' ? '👂 Listen' : status === 'thinking' ? '🧠 Think' : status === 'speaking' ? '🛑 Stop' : status === 'waving' ? '👋 Hi!' : '💬 Ask'}
                    </div>
                </div>

        {/* Floating Cursor Hand for Walk-and-Click */}
        {cursorPos.visible && (
            <div style={{
                position: 'fixed',
                left: cursorPos.x,
                top: cursorPos.y,
                zIndex: 99999999,
                fontSize: '28px',
                pointerEvents: 'none',
                transition: 'left 1.3s cubic-bezier(0.4, 0, 0.2, 1), top 1.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: cursorPos.clicking ? 'scale(0.7)' : 'scale(1)',
                filter: cursorPos.clicking ? 'drop-shadow(0 0 8px #10b981)' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
            }}>
                👆
            </div>
        )}
            </div>
            {showSettings && (
                <div style={{ position: 'absolute', top: '120px', right: '20px', width: '240px', background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #f1f5f9', zIndex: 100 }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Settings</h4>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                        <input type="checkbox" checked={enableRoaming} onChange={() => setEnableRoaming(!enableRoaming)} /> Enable Roaming
                    </label>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Spoken Language</label>
                    <select value={inputLanguage} onChange={(e) => { setInputLanguage(e.target.value); localStorage.setItem('astra_lang', e.target.value); }} style={{ width: '100%', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', marginBottom: '12px' }}>
                        <option value="en-IN">English (India)</option>
                        <option value="hi-IN">Hindi</option>
                        <option value="ta-IN">Tamil</option>
                        <option value="te-IN">Telugu</option>
                        <option value="mr-IN">Marathi</option>
                        <option value="bn-IN">Bengali</option>
                        <option value="gu-IN">Gujarati</option>
                        <option value="kn-IN">Kannada</option>
                        <option value="ml-IN">Malayalam</option>
                        <option value="pa-IN">Punjabi</option>
                    </select>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>TTS Voice</label>
                    <select value={selectedVoice} onChange={(e) => { setSelectedVoice(e.target.value); localStorage.setItem('astra_voice', e.target.value); }} style={{ width: '100%', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', marginBottom: '12px' }}>
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Volume</label>
                    <input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#10b981' }} />
                    <button onClick={() => setShowSettings(false)} style={{ width: '100%', marginTop: '15px', background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Close</button>
                </div>
            )}
        </div>
    );
}

useGLTF.preload('/student_avatar.glb');
