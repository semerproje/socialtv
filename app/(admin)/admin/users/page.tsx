'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'viewer' | 'editor' | 'ops';

interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  disabled: boolean;
  lastSignInTime: string | null;
  creationTime: string | null;
  role: Role;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Gözlemci',
  editor: 'Editör',
  ops: 'Operasyon',
};

const ROLE_COLOR: Record<Role, string> = {
  viewer: 'text-white/50 bg-white/8 border-white/12',
  editor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  ops: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Avatar({ user }: { user: AdminUser }) {
  const initials = user.displayName
    ? user.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? '?';

  return user.photoURL ? (
    <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold">
      {initials}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const d = await res.json();
        setUsers(d.data ?? []);
      } else {
        toast.error('Kullanıcılar yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateRole = async (uid: string, role: Role) => {
    setUpdating(uid);
    try {
      const res = await fetch(`/api/admin/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
        toast.success('Rol güncellendi');
      } else {
        toast.error('Güncelleme başarısız');
      }
    } finally {
      setUpdating(null); }
  };

  const toggleDisabled = async (uid: string, currentDisabled: boolean) => {
    setUpdating(uid);
    try {
      const res = await fetch(`/api/admin/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, disabled: !currentDisabled }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, disabled: !currentDisabled } : u));
        toast.success(!currentDisabled ? 'Kullanıcı devre dışı bırakıldı' : 'Kullanıcı aktifleştirildi');
      } else {
        toast.error('İşlem başarısız');
      }
    } finally {
      setUpdating(null); }
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.email ?? '').toLowerCase().includes(q) || (u.displayName ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          👥 Kullanıcı Yönetimi
        </h1>
        <p className="text-white/40 text-sm">{users.length} kullanıcı · Firebase Admin Auth</p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="E-posta veya isimle ara…"
          className="input w-full max-w-sm text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/25">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-sm">{search ? 'Kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: '#0b0f1a' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th className="text-left text-[10px] font-bold tracking-[0.12em] uppercase text-white/30 px-4 py-3">Kullanıcı</th>
                <th className="text-left text-[10px] font-bold tracking-[0.12em] uppercase text-white/30 px-4 py-3 hidden sm:table-cell">Son Giriş</th>
                <th className="text-left text-[10px] font-bold tracking-[0.12em] uppercase text-white/30 px-4 py-3">Rol</th>
                <th className="text-right text-[10px] font-bold tracking-[0.12em] uppercase text-white/30 px-4 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((u, i) => (
                <motion.tr
                  key={u.uid}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn('transition-colors hover:bg-white/[0.02]', u.disabled && 'opacity-50')}
                >
                  {/* User Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} />
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{u.displayName ?? u.email ?? u.uid}</p>
                        {u.displayName && <p className="text-white/40 text-[11px] truncate">{u.email}</p>}
                        {u.disabled && <span className="text-red-400 text-[9px] font-bold uppercase">Devre Dışı</span>}
                      </div>
                    </div>
                  </td>

                  {/* Last Login */}
                  <td className="px-4 py-3 text-white/40 text-xs hidden sm:table-cell">{fmtDate(u.lastSignInTime)}</td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={updating === u.uid}
                      onChange={e => updateRole(u.uid, e.target.value as Role)}
                      className={cn(
                        'text-xs rounded-lg px-2 py-1 border font-medium bg-transparent cursor-pointer transition-all',
                        ROLE_COLOR[u.role]
                      )}
                    >
                      <option value="viewer">Gözlemci</option>
                      <option value="editor">Editör</option>
                      <option value="ops">Operasyon</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {updating === u.uid ? (
                        <div className="w-4 h-4 border border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
                      ) : (
                        <button
                          onClick={() => toggleDisabled(u.uid, u.disabled)}
                          className={cn(
                            'text-[11px] px-2.5 py-1 rounded-lg border transition-all',
                            u.disabled
                              ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/12'
                              : 'text-red-400/70 border-red-500/15 bg-red-500/5 hover:bg-red-500/10 hover:text-red-400'
                          )}
                        >
                          {u.disabled ? 'Aktifleştir' : 'Devre Dışı'}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <p className="text-white/20 text-xs mt-4 text-center">
        Rol değişiklikleri anında uygulanır · Firebase Authentication &amp; Firestore
      </p>
    </div>
  );
}
