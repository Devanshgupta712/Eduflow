/**
 * API Helper — Centralized fetch wrapper that injects JWT auth token.
 * All frontend pages should use this instead of raw `fetch`.
 */

const rawApiBase = process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com';
export const API_BASE = (rawApiBase === '/api' || !rawApiBase.startsWith('http')) 
    ? 'https://lms-api-bkuw.onrender.com' 
    : rawApiBase;

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
}

export function setToken(token: string) {
    localStorage.setItem('auth_token', token);
}

export function clearToken() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
}

export function getStoredUser(): any | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: any) {
    localStorage.setItem('auth_user', JSON.stringify(user));
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = getToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };

    // Only set Content-Type: application/json if not already set and body is not FormData
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    // Auto-handle expired/invalid token: clear session and redirect to login
    if (res.status === 401 && typeof window !== 'undefined') {
        const body = await res.clone().json().catch(() => ({}));
        const detail: string = body?.detail || '';
        if (detail.toLowerCase().includes('expired') || detail.toLowerCase().includes('invalid token')) {
            clearToken();
            window.location.href = '/login?reason=session_expired';
        }
    }
    return res;
}

export async function apiGet(path: string) {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
}

export async function apiPost(path: string, body: any) {
    const res = await apiFetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    return res;
}

export async function apiPatch(path: string, body: any) {
    const res = await apiFetch(path, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
    return res.json();
}

export async function apiPut(path: string, body: any) {
    const res = await apiFetch(path, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
    return res.json();
}

export async function apiDelete(path: string) {
    const res = await apiFetch(path, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
    return res.json();
}
