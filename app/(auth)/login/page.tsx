'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.push('/admin');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('E-posta veya şifre hatalı');
      } else if (code === 'auth/too-many-requests') {
        setError('Çok fazla deneme. Lütfen bekleyin.');
      } else {
        setError('Giriş başarısız. Tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      {/* Card */}
      <div className="rounded-2xl border border-white/[0.08] p-8 space-y-7"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(15,23,42,0.95) 100%)' }}>

        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16">
            <Image src="/logo.png" alt="Social Lounge" width={64} height={64} className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Social Lounge TV
            </h1>
            <p className="text-sm text-white/40 mt-0.5">Admin Paneline Giriş</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm
                         focus:outline-none focus:border-indigo-500/70 focus:bg-white/8 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm
                         focus:outline-none focus:border-indigo-500/70 focus:bg-white/8 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Giriş yapılıyor…
              </span>
            ) : (
              'Giriş Yap'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-white/25">
          Social Lounge TV · Admin Panel
        </p>
      </div>
    </div>
  );
}
