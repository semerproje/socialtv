'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/admin/Sidebar';
import AdminApiAuthBridge from '@/components/admin/AdminApiAuthBridge';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

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
      <main className="flex-1 overflow-auto">
        {children}
      </main>
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
