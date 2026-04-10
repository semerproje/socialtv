'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface IGProfile {
  username: string;
  displayName: string;
  profilePicUrl: string;
  followerCount: number;
  isVerified: boolean;
}

interface IGFetchedPost {
  instagramId: string;
  shortcode: string;
  username: string;
  displayName: string;
  profilePicUrl: string;
  mediaUrl: string;
  thumbnailUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption: string;
  permalink: string;
  likeCount: number;
  commentCount: number;
  postedAt: string;
}

interface LibraryPost {
  id: string;
  instagramId?: string;
  username: string;
  displayName?: string;
  profilePicUrl?: string;
  mediaUrl: string;
  mediaType: string;
  thumbnailUrl?: string;
  caption?: string;
  permalink?: string;
  likeCount: number;
  commentCount: number;
  isApproved: boolean;
  isDisplayed: boolean;
  postedAt: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TVIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IGIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M16.5 2h-9C5.015 2 2 5.015 2 7.5v9C2 18.985 5.015 22 7.5 22h9c2.485 0 4.5-2.015 4.5-4.5v-9C21 5.015 18.985 2 16.5 2zm-4.5 13a5 5 0 110-10 5 5 0 010 10zm5-8.5a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
      <circle cx="12" cy="12" r="10" fill="#3b82f6" />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3.5 h-3.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function InstagramPage() {
  const [library, setLibrary] = useState<LibraryPost[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [fetchedPosts, setFetchedPosts] = useState<IGFetchedPost[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram?limit=100');
      if (res.ok) {
        const d = await res.json();
        setLibrary(d.data ?? []);
      }
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  const libraryIds = new Set(library.map((p) => p.instagramId).filter(Boolean));

  async function handleSearch() {
    const u = usernameInput.trim().replace(/^@/, '');
    if (!u) { toast.error('Hesap adı girin'); return; }
    setSearching(true);
    setProfile(null);
    setFetchedPosts([]);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/instagram/fetch?username=${encodeURIComponent(u)}`);
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'Bir hata oluştu'); return; }
      setProfile(d.profile);
      setFetchedPosts(d.posts ?? []);
      if ((d.posts ?? []).length === 0) toast('Bu hesapta gösterilecek post bulunamadı');
    } finally {
      setSearching(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const available = fetchedPosts.filter((p) => !libraryIds.has(p.instagramId));
    setSelected(new Set(available.map((p) => p.instagramId)));
  }

  async function addSelected() {
    if (selected.size === 0) { toast.error('En az bir post seçin'); return; }
    const toAdd = fetchedPosts.filter((p) => selected.has(p.instagramId));
    setAdding(true);
    try {
      const res = await fetch('/api/instagram/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: toAdd }),
      });
      if (res.ok) {
        const d = await res.json();
        const newPosts = d.created ?? 0;
        const skipped = d.skipped ?? 0;
        if (newPosts > 0) {
          toast.success(`${newPosts} post eklendi` + (skipped > 0 ? ` · ${skipped} zaten vardı` : ''));
        } else {
          toast(`Seçilen ${skipped} post zaten kütüphanede`);
        }
        setSelected(new Set());
        loadLibrary();
      } else {
        toast.error('Eklenemedi');
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteFromLibrary(id: string) {
    await fetch(`/api/instagram?id=${id}`, { method: 'DELETE' });
    toast.success('Kütüphaneden kaldırıldı');
    loadLibrary();
  }

  async function broadcastInstagram() {
    await fetch('/api/sync/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'show_instagram', data: {} }),
    });
    toast.success('Tüm ekranlara gönderildi');
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Instagram Yönetimi
          </h1>
          <p className="text-tv-muted text-sm mt-1">{library.length} post kütüphanede</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              fetch('/api/sync/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'change_layout', data: { layoutType: 'instagram' } }),
              });
              toast.success('Instagram layout aktif');
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <IGIcon />
            </div>
            Instagram Layout
          </button>
          <button onClick={broadcastInstagram} className="btn-primary flex items-center gap-2">
            <TVIcon />
            Ekranlarda Göster
          </button>
        </div>
      </div>

      {/* Search Panel */}
      <div className="admin-card space-y-4">
        <div>
          <p className="text-sm font-semibold text-tv-text mb-0.5">Hesap Ara</p>
          <p className="text-xs text-tv-muted">
            Kullanıcı adını girin, son postları yükleyin ve yayınlamak istediklerinizi seçin
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-muted text-sm font-medium select-none">@</span>
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !searching && handleSearch()}
              placeholder="hesap.adi"
              className="input-field w-full pl-7"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="btn-primary min-w-[130px] flex items-center justify-center gap-2"
          >
            {searching ? <><SpinnerIcon /> Yükleniyor</> : 'Postları Getir'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {profile && (
            <motion.div
              key={profile.username}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]"
            >
              {profile.profilePicUrl ? (
                <img src={profile.profilePicUrl} alt={profile.username} className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-tv-text truncate">@{profile.username}</span>
                  {profile.isVerified && <VerifiedIcon />}
                </div>
                {profile.displayName && <p className="text-tv-muted text-sm truncate">{profile.displayName}</p>}
                <p className="text-tv-muted text-xs mt-1">
                  <span className="font-medium text-tv-text">{fmt(profile.followerCount)}</span> takipçi
                  {' '}·{' '}
                  <span className="font-medium text-tv-text">{fetchedPosts.length}</span> post yüklendi
                </p>
              </div>
              <a href={`https://www.instagram.com/${profile.username}/`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm flex-shrink-0">
                Profili Aç
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fetched Posts */}
      <AnimatePresence>
        {fetchedPosts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="admin-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-tv-text">Son {fetchedPosts.length} Paylaşım</p>
                {selected.size > 0 && <p className="text-xs text-blue-400 mt-0.5">{selected.size} post seçildi</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="btn-secondary text-xs px-3 py-1.5">Tümünü Seç</button>
                {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="btn-secondary text-xs px-3 py-1.5">Temizle</button>}
                {selected.size > 0 && (
                  <button onClick={addSelected} disabled={adding} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    {adding ? <><SpinnerIcon /> Ekleniyor…</> : `${selected.size} Postu Ekle`}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {fetchedPosts.map((post) => {
                const inLibrary = libraryIds.has(post.instagramId);
                const isSelected = selected.has(post.instagramId);
                return (
                  <motion.button
                    key={post.instagramId}
                    onClick={() => !inLibrary && toggleSelect(post.instagramId)}
                    whileTap={inLibrary ? undefined : { scale: 0.93 }}
                    className={`relative aspect-square rounded-xl overflow-hidden group ${inLibrary ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    title={post.caption ? post.caption.slice(0, 80) : undefined}
                  >
                    <img src={post.thumbnailUrl || post.mediaUrl} alt="" className="w-full h-full object-cover" />
                    {!inLibrary && (
                      <div className={`absolute inset-0 transition-all duration-150 ${isSelected ? 'bg-blue-500/25 ring-2 ring-inset ring-blue-400' : 'group-hover:bg-black/30'}`}>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow">
                            <CheckIcon />
                          </div>
                        )}
                        {!isSelected && (
                          <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/75 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex justify-center gap-2 text-[9px] text-white/80">
                              <span className="flex items-center gap-0.5"><HeartIcon />{fmt(post.likeCount)}</span>
                              <span className="flex items-center gap-0.5"><CommentIcon />{fmt(post.commentCount)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {inLibrary && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-[9px] text-white/80 bg-black/60 px-2 py-0.5 rounded font-medium">Eklendi</span>
                      </div>
                    )}
                    {post.mediaType === 'VIDEO' && !inLibrary && (
                      <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded bg-black/60 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><polygon points="5,3 19,12 5,21" /></svg>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-tv-text">
          Kütüphane
          {library.length > 0 && <span className="text-tv-muted font-normal ml-2">({library.length} post)</span>}
        </p>
        {libraryLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {[...Array(6)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : library.length === 0 ? (
          <div className="admin-card text-center py-14">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/15 to-purple-600/15 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-tv-muted">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
              </svg>
            </div>
            <p className="text-tv-text font-medium mb-1">Kütüphane boş</p>
            <p className="text-tv-muted text-sm">Yukarıdan bir hesap arayın, postları seçip kütüphaneye ekleyin</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {library.map((post) => (
              <motion.div key={post.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="group relative aspect-square rounded-xl overflow-hidden">
                {post.mediaType === 'VIDEO' ? (
                  <video src={post.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={post.mediaUrl} alt={post.caption ?? ''} className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-0 inset-x-0 pt-4 pb-1.5 px-1.5 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-white/60 text-[9px] truncate">@{post.username}</p>
                </div>
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <div className="flex gap-2 text-[9px] text-white/70">
                    <span className="flex items-center gap-0.5"><HeartIcon />{fmt(post.likeCount)}</span>
                    <span className="flex items-center gap-0.5"><CommentIcon />{fmt(post.commentCount)}</span>
                  </div>
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[9px] text-blue-300 underline">
                      Instagram&apos;da Aç
                    </a>
                  )}
                  <button onClick={() => deleteFromLibrary(post.id)} className="bg-red-500/80 text-white text-[9px] px-2.5 py-0.5 rounded-md mt-1">
                    Kaldır
                  </button>
                </div>
                {post.mediaType === 'VIDEO' && (
                  <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded bg-black/60 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><polygon points="5,3 19,12 5,21" /></svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
