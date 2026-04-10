'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import type { AdminRole } from '@/types';

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
      { href: '/admin/ticker', label: 'Haber Bandı', icon: '📢', minimumRole: 'editor' },
      { href: '/admin/ads', label: 'Reklamlar', icon: '📺', minimumRole: 'editor' },
    ],
  },
  {
    heading: 'ARAÇLAR',
    items: [
      { href: '/admin/media', label: 'Medya Kütüphanesi', icon: '🎬', minimumRole: 'editor' },
      { href: '/admin/ai-studio', label: 'AI Studio', icon: '🤖', badge: 'AI', minimumRole: 'editor' },
      { href: '/admin/analytics', label: 'Analitik', icon: '📈', minimumRole: 'viewer' },
      { href: '/admin/monitoring', label: 'Monitoring', icon: '🩺', minimumRole: 'viewer' },
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
      className="w-64 flex-shrink-0 flex flex-col min-h-screen border-r border-white/[0.06]"
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #030712 100%)' }}
    >
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <Image src="/logo.png" alt="Social Lounge" width={36} height={36} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Social Lounge
            </h1>
            <p className="text-[11px] text-tv-muted">Admin Panel</p>
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
