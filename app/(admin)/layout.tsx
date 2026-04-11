'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/admin/Sidebar';
import AdminApiAuthBridge from '@/components/admin/AdminApiAuthBridge';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const MOBILE_TABS = [
  { href: '/admin', label: 'Panel', icon: '📊', exact: true },
  { href: '/admin/publish', label: 'Yayınla', icon: '🎬' },
  { href: '/admin/screens', label: 'Ekranlar', icon: '🖥️' },
  { href: '/admin/tv', label: 'TV', icon: '📡' },
  { href: '/admin/settings', label: 'Ayarlar', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-tv-bg">
      <AdminApiAuthBridge />
      <Sidebar />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden flex border-t border-white/[0.08] z-40" style={{ background: '#0f172a' }}>
        {MOBILE_TABS.map(tab => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-indigo-400' : 'text-white/30 hover:text-white/60'
              )}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#f8fafc' },
          },
        }}
      />
    </div>
  );
}
