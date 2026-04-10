'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch('/api/monitoring/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        source: 'global-error-boundary',
        message: error.message,
        metadata: { digest: error.digest, stack: error.stack },
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-red-300/70">System Fault</p>
          <h1 className="mt-3 text-2xl font-bold">Beklenmeyen bir hata oluştu</h1>
          <p className="mt-3 text-sm text-white/45">Hata kaydedildi. Arayüzü tekrar başlatmayı deneyebilirsiniz.</p>
          <button onClick={() => reset()} className="btn-primary mt-6">Tekrar Dene</button>
        </div>
      </body>
    </html>
  );
}