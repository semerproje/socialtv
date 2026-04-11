'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import type { AdminRole } from '@/types';

// ─── Notification types ───────────────────────────────────────────────────────

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  exact?: boolean;
  minimumRole?: AdminRole;
};

type NavGroup = {
  heading?: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊', exact: true, minimumRole: 'viewer' },
    ],
  },
  {
    heading: 'YAYINLAR',
    items: [
      { href: '/admin/publish', label: 'Yayın Merkezi', icon: '🎬', badge: 'YENİ', minimumRole: 'editor' },
      { href: '/admin/schedule', label: 'Yayın Takvimi', icon: '📅', badge: 'YENİ', minimumRole: 'editor' },
      { href: '/admin/playlist', label: 'Playlist', icon: '🎵', badge: 'YENİ', minimumRole: 'editor' },
      { href: '/admin/tv', label: 'TV Yayınları', icon: '📡', minimumRole: 'viewer' },
      { href: '/admin/screens', label: 'Ekran Yönetimi', icon: '🖥️', badge: 'LIVE', minimumRole: 'editor' },
    ],
  },
  {
    heading: 'İÇERİK',
    items: [
      { href: '/admin/instagram', label: 'Instagram', icon: '📸', minimumRole: 'editor' },
      { href: '/admin/youtube', label: 'YouTube', icon: '▶️', minimumRole: 'editor' },
      { href: '/admin/content', label: 'Sosyal İçerik', icon: '🖼️', minimumRole: 'editor' },
      { href: '/admin/news', label: 'Google Haberler', icon: '📰', badge: 'CANLI', minimumRole: 'editor' },
      { href: '/admin/ticker', label: 'Haber Bandı', icon: '📢', minimumRole: 'editor' },
      { href: '/admin/ads', label: 'Reklamlar', icon: '📺', minimumRole: 'editor' },
    ],
  },
  {
    heading: 'ARAÇLAR',
    items: [
      { href: '/admin/media', label: 'Medya Kütüphanesi', icon: '🎬', minimumRole: 'editor' },
      { href: '/admin/ai-director', label: 'AI Direktörü', icon: '🧠', badge: 'PRO', minimumRole: 'editor' },
      { href: '/admin/ai-studio', label: 'AI Studio', icon: '🤖', badge: 'AI', minimumRole: 'editor' },
      { href: '/admin/analytics', label: 'Analitik', icon: '📈', minimumRole: 'viewer' },
      { href: '/admin/monitoring', label: 'Monitoring', icon: '🩺', minimumRole: 'viewer' },
      { href: '/admin/users', label: 'Kullanıcılar', icon: '👥', minimumRole: 'ops' },
      { href: '/admin/settings', label: 'Ayarlar', icon: '⚙️', minimumRole: 'ops' },
    ],
  },
];

const ROLE_WEIGHT: Record<AdminRole, number> = {
  viewer: 1,
  editor: 2,
  ops: 3,
};

const ROLE_LABEL: Record<AdminRole, string> = {
  viewer: 'Goruntuleyici',
  editor: 'Editor',
  ops: 'Operasyon',
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, adminRole, signOut } = useAuth();
  const effectiveRole: AdminRole | null = adminRole ?? (user ? 'viewer' : null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Firestore real-time listener for unread notifications
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? '',
          body: data.body ?? '',
          type: data.type ?? 'info',
          isRead: data.isRead ?? false,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
          link: data.link,
        } as AppNotification;
      }));
    }, () => { /* silent on error */ });
    return () => unsub();
  }, [user]);

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await Promise.allSettled(notifications.map(n =>
      updateDoc(doc(db, 'notifications', n.id), { isRead: true })
    ));
  };

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const canAccess = (minimumRole: AdminRole = 'viewer') => {
    if (!effectiveRole) return false;
    return ROLE_WEIGHT[effectiveRole] >= ROLE_WEIGHT[minimumRole];
  };

  return (
    <aside
      className="hidden md:flex w-64 flex-shrink-0 flex-col min-h-screen border-r border-white/[0.06]"
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #030712 100%)' }}
    >
      {/* Logo + Notification Bell */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <Image src="/logo.png" alt="Social Lounge" width={36} height={36} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Social Lounge
            </h1>
            <p className="text-[11px] text-tv-muted">Admin Panel</p>
          </div>
          {/* Notification Bell */}
          <div className="relative flex-shrink-0" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
            >
              <span className="text-base leading-none">🔔</span>
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1 w-72 rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                  style={{ background: '#0b0f1a' }}
                >
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
                    <p className="text-white/70 text-xs font-semibold">Bildirimler</p>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Tümünü okundu işaretle</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-2xl mb-2">🎉</p>
                      <p className="text-white/30 text-xs">Yeni bildirim yok</p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {notifications.map(n => {
                        const typeClr: Record<string, string> = {
                          error: 'border-l-red-500 bg-red-500/5',
                          warning: 'border-l-amber-500 bg-amber-500/5',
                          success: 'border-l-emerald-500 bg-emerald-500/5',
                          info: 'border-l-indigo-500 bg-indigo-500/5',
                        };
                        return (
                          <div
                            key={n.id}
                            className={cn('border-l-2 px-3 py-2.5 border-b border-white/[0.04] cursor-pointer hover:bg-white/3 transition-colors', typeClr[n.type] ?? typeClr.info)}
                            onClick={() => { if (n.link) router.push(n.link); updateDoc(doc(db, 'notifications', n.id), { isRead: true }); setShowNotifs(false); }}
                          >
                            <p className="text-white/80 text-xs font-medium leading-snug">{n.title}</p>
                            {n.body && <p className="text-white/40 text-[10px] mt-0.5 line-clamp-2">{n.body}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
            {group.heading && (
              <p className="px-3 pb-1.5 text-[9px] font-bold tracking-[0.15em] text-white/20 uppercase">
                {group.heading}
              </p>
            )}
            {group.items.map((link) => {
              const active = isActive(link);
              const accessible = canAccess(link.minimumRole);

              if (!accessible) {
                return (
                  <div
                    key={link.href}
                    className="sidebar-link opacity-45 cursor-not-allowed"
                    aria-disabled="true"
                    title={`Bu alan icin en az ${ROLE_LABEL[link.minimumRole ?? 'viewer']} yetkisi gerekir`}
                  >
                    <span className="text-base w-5 text-center">{link.icon}</span>
                    <span className="flex-1 min-w-0 truncate">{link.label}</span>
                    <span className="badge text-[9px] py-0.5 px-1.5 flex-shrink-0 badge-warning">
                      KILITLI
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn('sidebar-link', active && 'active')}
                >
                  <span className="text-base w-5 text-center">{link.icon}</span>
                  <span className="flex-1 min-w-0 truncate">{link.label}</span>
                  {link.badge && (
                    <span className={cn(
                      'badge text-[9px] py-0.5 px-1.5 flex-shrink-0',
                      link.badge === 'LIVE' ? 'badge-live' : link.badge === 'AI' ? 'badge-ai' : 'badge-new'
                    )}>
                      {link.badge}
                    </span>
                  )}
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-tv-primary flex-shrink-0" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/[0.06] space-y-2">
        <a
          href="/screen"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-tv-muted hover:text-tv-text hover:bg-white/5 transition-all duration-200"
        >
          <span>🖥️</span>
          <span>Yayın Ekranı</span>
          <span className="ml-auto text-xs">↗</span>
        </a>

        <div className="px-3 py-2.5 rounded-xl glass text-xs text-tv-muted">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 font-medium">Sistem Aktif</span>
          </div>
          <p className="truncate">{user?.email ?? 'v2.0.0'}</p>
          <p className="mt-1 text-[11px] text-white/45">
            Rol: {effectiveRole ? ROLE_LABEL[effectiveRole] : 'Dogrulaniyor'}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <span>🚪</span>
          <span>Çıkış</span>
        </button>
      </div>
    </aside>
  );
}
