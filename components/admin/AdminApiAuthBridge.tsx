'use client';

import { useEffect } from 'react';
import { auth } from '@/lib/firebase';

const PUBLIC_PREFIXES = [
  '/api/display',
  '/api/markets',
  '/api/news',
  '/api/monitoring/health',
];

function shouldAttachAuth(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.startsWith('/api/')) return false;
    return !PUBLIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

export default function AdminApiAuthBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!shouldAttachAuth(input) || !auth?.currentUser) {
        return originalFetch(input, init);
      }

      const token = await auth.currentUser.getIdToken();
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set('Authorization', `Bearer ${token}`);

      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}