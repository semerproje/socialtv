'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function sendClientLog(payload: Record<string, unknown>) {
  fetch('/api/monitoring/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export default function ClientErrorReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      sendClientLog({
        level: 'error',
        source: 'client-window',
        message: event.message || 'Unhandled client error',
        metadata: {
          pathname,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      sendClientLog({
        level: 'error',
        source: 'client-promise',
        message: typeof event.reason === 'string' ? event.reason : 'Unhandled promise rejection',
        metadata: {
          pathname,
          reason: typeof event.reason === 'string' ? event.reason : JSON.stringify(event.reason ?? null),
        },
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [pathname]);

  return null;
}