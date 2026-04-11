'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MediaItem {
  name: string;       // full storage path
  fileName: string;   // basename
  url: string;
  contentType: string;
  size: number;
  updatedAt: string | null;
}

type Tab = 'library' | 'upload' | 'youtube' | 'instagram';
type ViewMode = 'grid' | 'list';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fileIcon(ct: string) {
  if (ct.startsWith('image/')) return '🖼️';
  if (ct.startsWith('video/')) return '🎬';
  if (ct.startsWith('audio/')) return '🎵';
  if (ct.includes('pdf')) return '📄';
  return '📁';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Confirm-delete mini-dialog ───────────────────────────────────────────────
function ConfirmDelete({ fileName, onConfirm, onCancel }: {
  fileName: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <p className="text-tv-text font-semibold text-base mb-1">Dosyayı sil?</p>
        <p className="text-tv-muted text-sm mb-5 break-all">{fileName}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-tv-muted text-sm transition-all">İptal</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all">Sil</button>
        </div>
      </div>
    </div>
  );
}

// ─── Media Card (grid) ────────────────────────────────────────────────────────
function MediaCard({ item, onDelete }: { item: MediaItem; onDelete: (item: MediaItem) => void }) {
  const isImage = item.contentType.startsWith('image/');
  const isVideo = item.contentType.startsWith('video/');

  return (
    <div className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-indigo-500/40 hover:bg-white/[0.07] transition-all">
      {/* Thumbnail */}
      <div className="aspect-video bg-black/30 flex items-center justify-center overflow-hidden relative">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.fileName} className="w-full h-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <span className="text-4xl">{fileIcon(item.contentType)}</span>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => { navigator.clipboard.writeText(item.url); toast.success('URL kopyalandı'); }}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-all"
          >
            📋 Kopyala
          </button>
          <button
            onClick={() => onDelete(item)}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-all"
          >
            🗑️
          </button>
        </div>
      </div>
      {/* Info */}
      <div className="p-2.5 space-y-0.5">
        <p className="text-tv-text text-xs font-medium truncate" title={item.fileName}>{item.fileName}</p>
        <div className="flex items-center justify-between">
          <span className="text-tv-muted text-[10px]">{formatSize(item.size)}</span>
          <span className="text-tv-muted text-[10px]">{formatDate(item.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Media Row (list) ─────────────────────────────────────────────────────────
function MediaRow({ item, onDelete }: { item: MediaItem; onDelete: (item: MediaItem) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 hover:bg-white/[0.07] transition-all group">
      <span className="text-xl shrink-0">{fileIcon(item.contentType)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-tv-text text-sm font-medium truncate">{item.fileName}</p>
        <p className="text-tv-muted text-xs">{item.contentType} · {formatSize(item.size)} · {formatDate(item.updatedAt)}</p>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { navigator.clipboard.writeText(item.url); toast.success('URL kopyalandı'); }}
          className="px-2.5 py-1 rounded-lg bg-indigo-600/70 hover:bg-indigo-600 text-white text-xs transition-all"
        >
          📋
        </button>
        <a href={item.url} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-tv-text text-xs transition-all">🔗</a>
        <button
          onClick={() => onDelete(item)}
          className="px-2.5 py-1 rounded-lg bg-red-600/70 hover:bg-red-600 text-white text-xs transition-all"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────
function LibraryTab() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'other'>('all');
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/media?prefix=media/&limit=200');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media?path=${encodeURIComponent(deleteTarget.name)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Dosya silindi');
      setItems((prev) => prev.filter((i) => i.name !== deleteTarget.name));
    } catch {
      toast.error('Silme başarısız');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.fileName.toLowerCase().includes(search.toLowerCase());
    const matchType =
      filterType === 'all' ? true :
      filterType === 'image' ? item.contentType.startsWith('image/') :
      filterType === 'video' ? item.contentType.startsWith('video/') :
      !item.contentType.startsWith('image/') && !item.contentType.startsWith('video/');
    return matchSearch && matchType;
  });

  // Stats
  const totalSize = items.reduce((s, i) => s + i.size, 0);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-muted text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dosya ara…"
            className="input-field w-full pl-9 text-sm"
          />
        </div>
        {/* Type filter */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
          {(['all', 'image', 'video', 'other'] as const).map((f) => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filterType === f ? 'bg-tv-primary text-white' : 'text-tv-muted hover:text-tv-text'}`}
            >
              {f === 'all' ? 'Tümü' : f === 'image' ? '🖼️ Görsel' : f === 'video' ? '🎬 Video' : '📁 Diğer'}
            </button>
          ))}
        </div>
        {/* View toggle */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
          <button onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1 rounded-md text-xs transition-all ${viewMode === 'grid' ? 'bg-tv-primary text-white' : 'text-tv-muted hover:text-tv-text'}`}
          >▦</button>
          <button onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded-md text-xs transition-all ${viewMode === 'list' ? 'bg-tv-primary text-white' : 'text-tv-muted hover:text-tv-text'}`}
          >☰</button>
        </div>
        <button onClick={fetchMedia} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-tv-muted hover:text-tv-text text-sm transition-all disabled:opacity-40"
        >
          🔄
        </button>
      </div>

      {/* Stats bar */}
      {!loading && items.length > 0 && (
        <div className="flex gap-4 text-xs text-tv-muted">
          <span>{items.length} dosya</span>
          <span>·</span>
          <span>{formatSize(totalSize)} toplam</span>
          {search && <><span>·</span><span>{filtered.length} sonuç</span></>}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-tv-muted text-sm">Medya kütüphanesi yükleniyor…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16">
          <span className="text-4xl">⚠️</span>
          <p className="text-tv-text font-medium">Dosyalar yüklenemedi</p>
          <p className="text-tv-muted text-sm">{error}</p>
          <button onClick={fetchMedia} className="btn-primary">Tekrar Dene</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl">📭</span>
          <p className="text-tv-text font-medium">{search ? 'Sonuç bulunamadı' : 'Henüz medya yok'}</p>
          <p className="text-tv-muted text-sm">{search ? 'Farklı bir arama terimi deneyin' : 'Yükleme sekmesinden dosya ekleyin'}</p>
        </div>
      )}

      {/* Grid view */}
      {!loading && !error && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((item) => (
            <MediaCard key={item.name} item={item} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && !error && filtered.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {filtered.map((item) => (
            <MediaRow key={item.name} item={item} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && !deleting && (
        <ConfirmDelete
          fileName={deleteTarget.fileName}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 bg-[#1a1a2e] border border-white/10 rounded-2xl p-8">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            <p className="text-tv-muted text-sm">Siliniyor…</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload Tab ───────────────────────────────────────────────────────────────
function UploadTab({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const dropRef = useRef<HTMLLabelElement>(null);

  async function handleUpload() {
    if (!uploadFile || !storage) { toast.error('Firebase Storage bağlı değil'); return; }
    setLoading(true);
    const path = `media/${Date.now()}_${uploadFile.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, uploadFile);
    task.on('state_changed',
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => { toast.error('Yükleme başarısız'); setLoading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setUploadedUrl(url);
        setUploadProgress(100);
        setLoading(false);
        toast.success('Dosya yüklendi!');
        onUploadComplete();
      }
    );
  }

  return (
    <div className="admin-card space-y-5 max-w-xl">
      <div>
        <h2 className="font-semibold text-tv-text">Firebase Storage'a Yükle</h2>
        <p className="text-tv-muted text-sm mt-1">Görseller, videolar ve reklamlar için dosya yükleme</p>
      </div>

      {/* Drop zone */}
      <label ref={dropRef} className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10 rounded-xl p-10 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
        <span className="text-4xl">{uploadFile ? '📄' : '☁️'}</span>
        <div className="text-center">
          <p className="text-tv-text text-sm font-medium">
            {uploadFile ? uploadFile.name : 'Dosya seçmek için tıklayın veya sürükleyin'}
          </p>
          <p className="text-tv-muted text-xs mt-0.5">
            {uploadFile
              ? `${formatSize(uploadFile.size)} — ${uploadFile.type || 'bilinmeyen tür'}`
              : 'PNG, JPG, GIF, MP4, WebM, PDF desteklenir'}
          </p>
        </div>
        <input
          type="file"
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); setUploadedUrl(''); setUploadProgress(0); }}
        />
      </label>

      {/* Progress bar */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-tv-muted">
            <span>Yükleniyor…</span><span>{uploadProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Done */}
      {uploadedUrl && (
        <div className="space-y-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs font-medium text-emerald-400">✅ Yükleme tamamlandı</p>
          <div className="flex gap-2">
            <input readOnly value={uploadedUrl} className="input-field flex-1 text-xs" />
            <button
              onClick={() => { navigator.clipboard.writeText(uploadedUrl); toast.success('URL kopyalandı'); }}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-tv-text text-sm transition-all"
            >📋</button>
          </div>
          {uploadFile?.type.startsWith('image/') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={uploadedUrl} alt="preview" className="w-full max-h-48 object-contain rounded-lg bg-black/30" />
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          disabled={!uploadFile || loading}
          onClick={handleUpload}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Yükleniyor…' : '☁️ Firebase\'e Yükle'}
        </button>
        {(uploadFile || uploadedUrl) && !loading && (
          <button
            onClick={() => { setUploadFile(null); setUploadedUrl(''); setUploadProgress(0); }}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-tv-muted text-sm transition-all"
          >
            Temizle
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MediaPage() {
  const [tab, setTab] = useState<Tab>('library');

  // YouTube add form
  const [ytUrl, setYtUrl] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytLoading, setYtLoading] = useState(false);

  // Instagram add form
  const [igUsername, setIgUsername] = useState('');
  const [igMediaUrl, setIgMediaUrl] = useState('');
  const [igCaption, setIgCaption] = useState('');
  const [igType, setIgType] = useState('IMAGE');
  const [igLoading, setIgLoading] = useState(false);

  // Trigger library refresh after upload
  const [libraryKey, setLibraryKey] = useState(0);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'library', label: '📂 Kütüphane' },
    { id: 'upload', label: '☁️ Yükle' },
    { id: 'youtube', label: '📹 YouTube' },
    { id: 'instagram', label: '📸 Instagram' },
  ];

  async function handleAddYouTube() {
    if (!ytUrl) { toast.error('URL gerekli'); return; }
    setYtLoading(true);
    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: ytUrl, title: ytTitle || 'YouTube Video' }),
      });
      if (res.ok) { toast.success('YouTube eklendi'); setYtUrl(''); setYtTitle(''); }
      else { const e = await res.json(); toast.error(e.error ?? 'Ekleme başarısız'); }
    } finally { setYtLoading(false); }
  }

  async function handleAddInstagram() {
    if (!igUsername || !igMediaUrl) { toast.error('Kullanıcı adı ve URL gerekli'); return; }
    setIgLoading(true);
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: igUsername, mediaUrl: igMediaUrl, caption: igCaption, mediaType: igType }),
      });
      if (res.ok) { toast.success('Instagram eklendi'); setIgUsername(''); setIgMediaUrl(''); setIgCaption(''); }
      else { const e = await res.json(); toast.error(e.error ?? 'Ekleme başarısız'); }
    } finally { setIgLoading(false); }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Medya Kütüphanesi
        </h1>
        <p className="text-tv-muted text-sm mt-1">Görseller, videolar ve içerik yönetimi</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-tv-primary text-white shadow-sm' : 'text-tv-muted hover:text-tv-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Library */}
      {tab === 'library' && <LibraryTab key={`library-${libraryKey}`} />}

      {/* Upload */}
      {tab === 'upload' && (
        <UploadTab onUploadComplete={() => setLibraryKey((k) => k + 1)} />
      )}

      {/* YouTube */}
      {tab === 'youtube' && (
        <div className="admin-card space-y-4 max-w-xl">
          <h2 className="font-semibold text-tv-text">YouTube Video Ekle</h2>
          <p className="text-tv-muted text-sm">YouTube URL veya Video ID girin</p>
          <input
            placeholder="https://youtube.com/watch?v=... veya VIDEO_ID"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddYouTube(); }}
            className="input-field w-full"
          />
          <input
            placeholder="Video başlığı (opsiyonel)"
            value={ytTitle}
            onChange={(e) => setYtTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddYouTube(); }}
            className="input-field w-full"
          />
          <button onClick={handleAddYouTube} disabled={ytLoading || !ytUrl} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {ytLoading ? 'Ekleniyor...' : 'Ekle'}
          </button>
          <p className="text-tv-muted text-xs">Eklenen videolar YouTube Yönetimi sayfasında görünür</p>
        </div>
      )}

      {/* Instagram */}
      {tab === 'instagram' && (
        <div className="admin-card space-y-4 max-w-xl">
          <h2 className="font-semibold text-tv-text">Instagram Post Ekle</h2>
          <input placeholder="Kullanıcı adı *" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} className="input-field w-full" />
          <input placeholder="Görsel/Video URL *" value={igMediaUrl} onChange={(e) => setIgMediaUrl(e.target.value)} className="input-field w-full" />
          <select value={igType} onChange={(e) => setIgType(e.target.value)} className="input-field w-full">
            <option value="IMAGE">Görsel</option>
            <option value="VIDEO">Video</option>
          </select>
          <textarea
            placeholder="Açıklama (opsiyonel)"
            value={igCaption}
            onChange={(e) => setIgCaption(e.target.value)}
            className="input-field w-full h-20 resize-none"
          />
          <button onClick={handleAddInstagram} disabled={igLoading || !igUsername || !igMediaUrl} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {igLoading ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>
      )}
    </div>
  );
}

