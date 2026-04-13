'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSwipeable } from 'react-swipeable';
import toast from 'react-hot-toast';
import type { Content } from '@/types';
import { cn, getPlatformColor, getPlatformIcon, formatNumber, formatRelative } from '@/lib/utils';

const PLATFORMS = ['all', 'custom', 'instagram', 'twitter', 'tiktok', 'announcement'];

// ─── Mobile swipe card wrapper ────────────────────────────────────────────────

function SwipeableContentCard({ onApprove, onReject, children }: {
  onApprove: () => void;
  onReject: () => void;
  children: React.ReactNode;
}) {
  const [hint, setHint] = useState<'approve' | 'reject' | null>(null);
  const handlers = useSwipeable({
    onSwipedRight: () => { onApprove(); setHint(null); },
    onSwipedLeft:  () => { onReject();  setHint(null); },
    onSwiping: ({ deltaX }) => setHint(deltaX > 50 ? 'approve' : deltaX < -50 ? 'reject' : null),
    onSwiped: () => setHint(null),
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 50,
  });
  return (
    <div {...handlers} className="relative">
      {hint === 'approve' && (
        <div className="absolute inset-0 z-10 flex items-center pl-5 rounded-xl pointer-events-none"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <span className="text-emerald-400 font-bold text-sm">✓ Onayla</span>
        </div>
      )}
      {hint === 'reject' && (
        <div className="absolute inset-0 z-10 flex items-center justify-end pr-5 rounded-xl pointer-events-none"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span className="text-red-400 font-bold text-sm">✕ Reddet</span>
        </div>
      )}
      {children}
    </div>
  );
}

const emptyForm = {
  platform: 'custom',
  author: '',
  authorHandle: '',
  authorAvatar: '',
  isVerified: false,
  text: '',
  mediaUrl: '',
  mediaType: '',
  likes: 0,
  comments: 0,
  shares: 0,
  views: 0,
  isApproved: false,
  isFeatured: false,
  scheduledFor: '',
  externalId: '',
};

export default function ContentPage() {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [approved, setApproved] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState<string | null>(null);
  const [aiToAdId, setAiToAdId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [similarMatches, setSimilarMatches] = useState<Array<{ id: string; author: string; text: string; distance: number }>>([]);
  const router = useRouter();

  const fetchContent = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('platform', filter);
      if (approved !== null) params.set('approved', String(approved));
      params.set('pageSize', '50');
      const res = await fetch(`/api/content?${params}`);
      const data = await res.json();
      setContent(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter, approved]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const handleApprove = async (id: string, value: boolean) => {
    const res = await fetch(`/api/content/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: value }),
    });
    if (res.ok) {
      toast.success(value ? 'İçerik onaylandı' : 'İçerik reddedildi');
      fetchContent();
    }
  };

  const handleFeature = async (id: string, value: boolean) => {
    await fetch(`/api/content/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFeatured: value }),
    });
    fetchContent();
    toast.success(value ? 'Öne çıkarıldı' : 'Öne çıkarma kaldırıldı');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu içeriği silmek istiyor musunuz?')) return;
    await fetch(`/api/content/${id}`, { method: 'DELETE' });
    toast.success('İçerik silindi');
    fetchContent();
  };

  const handleAIAnalyze = async (id: string, text: string) => {
    setAiAnalyzing(id);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        await fetch(`/api/content/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentiment: data.data.sentiment,
            sentimentScore: data.data.sentimentScore,
            aiSummary: data.data.summary,
            aiTags: JSON.stringify(data.data.tags),
          }),
        });
        toast.success('AI analizi tamamlandı');
        fetchContent();
      } else {
        toast.error(data.error ?? 'AI hatası');
      }
    } finally {
      setAiAnalyzing(null);
    }
  };

  const handleConvertToAd = async (item: Content) => {
    setAiToAdId(item.id);
    try {
      // 1. Generate ad copy via AI
      const aiRes = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ad_copy',
          offer: item.text.slice(0, 300),
          business: item.author ?? 'Social Lounge',
          tone: 'enerjik ve davetkar',
        }),
      });
      const aiData = await aiRes.json();
      if (!aiData.success) throw new Error(aiData.error ?? 'AI hatası');

      const copy = aiData.data as {
        headline?: string; subheadline?: string; body?: string; cta?: string; badge?: string;
      };

      // 2. Determine ad type and content
      const adType = item.mediaUrl ? (item.mediaType === 'video' ? 'video' : 'image') : 'text';
      const adContent = item.mediaUrl ?? copy.body ?? item.text.slice(0, 120);
      const adTitle = copy.headline ?? item.author ?? 'AI Reklamı';
      const adDescription = [copy.subheadline, copy.body, copy.cta].filter(Boolean).join(' · ');

      // 3. Create ad draft (inactive)
      const adRes = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: adTitle,
          description: adDescription,
          type: adType,
          content: adContent,
          thumbnailUrl: item.mediaUrl ?? undefined,
          isActive: false,
          aiGenerated: true,
          aiPrompt: item.text.slice(0, 500),
        }),
      });
      const adData = await adRes.json();
      if (!adData.success) throw new Error(adData.error ?? 'Reklam oluşturulamadı');

      toast.success(
        (t) => (
          <span>
            Reklam taslağı oluşturuldu!{' '}
            <button
              className="underline font-semibold"
              onClick={() => { toast.dismiss(t.id); router.push('/admin/ads'); }}
            >
              Reklamlara git →
            </button>
          </span>
        ),
        { duration: 6000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dönüştürme başarısız');
    } finally {
      setAiToAdId(null);
    }
  };

  const handleAIGenerate = async () => {
    if (!form.text.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'content', context: form.text }),
      });
      const data = await res.json();
      if (data.success) {
        setForm((f) => ({ ...f, text: data.data.text }));
        toast.success('AI içerik oluşturuldu!');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      setSimilarMatches([]);
      const url = editingId ? `/api/content/${editingId}` : '/api/content';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, autoAnalyze: true }),
      });
      if (res.ok) {
        toast.success(editingId ? 'Güncellendi' : 'İçerik eklendi');
        setShowForm(false);
        fetchContent();
      } else {
        const err = await res.json();
        if (res.status === 409 && Array.isArray(err.similar)) {
          setSimilarMatches(err.similar);
        }
        toast.error(err.error ?? 'Hata');
      }
    } finally {
      setSaving(false);
    }
  };

  const sentimentBadge = (sentiment?: string) => {
    if (sentiment === 'positive') return <span className="badge badge-success">😊 Pozitif</span>;
    if (sentiment === 'negative') return <span className="badge badge-danger">😞 Negatif</span>;
    if (sentiment === 'neutral') return <span className="badge badge-muted">😐 Nötr</span>;
    return null;
  };

  const calcScore = (item: Content): number => {
    const eng = Math.min(60, ((item.likes ?? 0) + (item.comments ?? 0) * 2 + (item.shares ?? 0) * 3) / 10);
    const featBonus = item.isFeatured ? 20 : 0;
    const aiBonus = item.isHighlight ? 10 : 0;
    const appBonus = item.isApproved ? 10 : 0;
    return Math.min(100, Math.round(eng + featBonus + aiBonus + appBonus));
  };

  const scoreColor = (s: number) => {
    if (s >= 70) return '#10b981';
    if (s >= 40) return '#f59e0b';
    return '#64748b';
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const platformCounts = PLATFORMS.reduce<Record<string, number>>((acc, p) => {
    acc[p] = p === 'all' ? content.length : content.filter((c) => c.platform === p).length;
    return acc;
  }, {});

  const bulkApprove = async (value: boolean) => {
    await Promise.all([...selectedIds].map((id) =>
      fetch(`/api/content/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isApproved: value }) }),
    ));
    toast.success(value ? `${selectedIds.size} içerik onaylandı` : `${selectedIds.size} içerik reddedildi`);
    setSelectedIds(new Set());
    fetchContent();
  };

  const bulkDelete = async () => {
    if (!confirm(`${selectedIds.size} içeriği silmek istiyor musunuz?`)) return;
    await Promise.all([...selectedIds].map((id) => fetch(`/api/content/${id}`, { method: 'DELETE' })));
    toast.success(`${selectedIds.size} içerik silindi`);
    setSelectedIds(new Set());
    fetchContent();
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            İçerik Yönetimi
          </h1>
          <p className="text-tv-muted text-sm mt-1">{content.length} içerik</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="btn-primary">
          + İçerik Ekle
        </button>
      </div>

      {/* Bulk Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
          <span className="text-sm text-indigo-300 font-medium">{selectedIds.size} seçildi</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkApprove(true)} className="btn-secondary text-xs py-1.5 px-3 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
              ✓ Onayla
            </button>
            <button onClick={() => bulkApprove(false)} className="btn-secondary text-xs py-1.5 px-3">
              ✕ Reddet
            </button>
            <button onClick={bulkDelete} className="btn-secondary text-xs py-1.5 px-3 text-red-400 border-red-500/30 hover:bg-red-500/10">
              🗑 Sil
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-tv-muted hover:text-tv-text px-2">✕</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5',
              filter === p
                ? 'bg-tv-primary text-white border-tv-primary'
                : 'border-white/10 text-tv-muted hover:text-tv-text hover:border-white/20',
            )}
          >
            {p === 'all' ? '🌐 Tümü' : `${getPlatformIcon(p)} ${p}`}
            {platformCounts[p] > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                filter === p ? 'bg-white/20 text-white' : 'bg-white/10 text-tv-muted',
              )}>
                {platformCounts[p]}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {[
            { label: 'Tümü', val: null },
            { label: '✅ Onaylı', val: true },
            { label: '⏳ Bekleyen', val: false },
          ].map((o) => (
            <button
              key={String(o.val)}
              onClick={() => setApproved(o.val)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                approved === o.val
                  ? 'bg-white/10 text-tv-text border-white/20'
                  : 'border-white/10 text-tv-muted hover:text-tv-text',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto admin-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-tv-text">İçerik Ekle</h2>
              <button onClick={() => { setShowForm(false); setSimilarMatches([]); }} className="text-tv-muted hover:text-tv-text text-xl">✕</button>
            </div>
            {similarMatches.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold text-amber-300 mb-2">Benzer içerik bulundu</p>
                <div className="space-y-1.5">
                  {similarMatches.slice(0, 3).map((m) => (
                    <div key={m.id} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                      <p className="text-xs text-tv-text/90">{m.author} · Mesafe: {m.distance}</p>
                      <p className="text-[11px] text-tv-muted line-clamp-2 mt-0.5">{m.text}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-tv-muted mt-2">Var olan kaydı güncelleyin veya metni farklılaştırarak tekrar deneyin.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-tv-muted mb-1 block">Platform</label>
                <select className="input-field" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                  {['custom', 'instagram', 'twitter', 'tiktok', 'announcement'].map((p) => (
                    <option key={p} value={p}>{getPlatformIcon(p)} {p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1 block">Yazar *</label>
                <input className="input-field" placeholder="Adı Soyadı" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1 block">Kullanıcı Adı</label>
                <input className="input-field" placeholder="@kullanici" value={form.authorHandle} onChange={(e) => setForm({ ...form, authorHandle: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1 block">Avatar URL</label>
                <input className="input-field" placeholder="https://..." value={form.authorAvatar} onChange={(e) => setForm({ ...form, authorAvatar: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-tv-muted mb-1 block">İçerik Metni *</label>
                <div className="relative">
                  <textarea
                    className="input-field h-24 resize-none"
                    placeholder="Gönderi içeriğini yazın..."
                    value={form.text}
                    onChange={(e) => setForm({ ...form, text: e.target.value })}
                  />
                  <button
                    onClick={handleAIGenerate}
                    disabled={aiLoading || !form.text.trim()}
                    className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-40"
                  >
                    {aiLoading ? '⏳' : '✨ AI İyileştir'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1 block">Medya URL</label>
                <input className="input-field" placeholder="https://... (isteğe bağlı)" value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1 block">Medya Türü</label>
                <select className="input-field" value={form.mediaType} onChange={(e) => setForm({ ...form, mediaType: e.target.value })}>
                  <option value="">—</option>
                  <option value="image">Görsel</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1 block">⏰ Yayın Zamanı</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={form.scheduledFor}
                  onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                />
                <p className="text-[10px] text-tv-muted mt-1">Boş bırakılırsa hemen yayına girer</p>
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1 block">External ID</label>
                <input className="input-field" placeholder="IG post ID, tweet ID..." value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
              </div>
              <div className="col-span-2 flex gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isApproved" checked={form.isApproved} onChange={(e) => setForm({ ...form, isApproved: e.target.checked })} className="accent-indigo-500" />
                  <label htmlFor="isApproved" className="text-sm text-tv-text">Otomatik Onayla</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isFeatured" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="accent-amber-500" />
                  <label htmlFor="isFeatured" className="text-sm text-tv-text">Öne Çıkar</label>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowForm(false); setSimilarMatches([]); }} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleSave} disabled={saving || !form.author || !form.text} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? '⏳' : editingId ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="admin-card animate-pulse h-20" />)}
        </div>
      ) : content.length === 0 ? (
        <div className="admin-card text-center py-16">
          <p className="text-5xl mb-4">🖼️</p>
          <p className="text-tv-text font-semibold">Henüz içerik yok</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4">+ İçerik Ekle</button>
        </div>
      ) : (
        <div className="space-y-3">
          {content.map((item) => (
            <SwipeableContentCard
              key={item.id}
              onApprove={() => handleApprove(item.id, true)}
              onReject={() => handleApprove(item.id, false)}
            >
            <div className={cn('admin-card flex items-start gap-4 hover:border-white/20 transition-colors', selectedIds.has(item.id) && 'border-indigo-500/40 bg-indigo-500/[0.05]')}>
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                className="mt-1 accent-indigo-500 flex-shrink-0 cursor-pointer"
              />
              {/* Platform icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${getPlatformColor(item.platform)}15`, border: `1px solid ${getPlatformColor(item.platform)}25` }}
              >
                {getPlatformIcon(item.platform)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-tv-text text-sm">{item.author}</span>
                  {item.authorHandle && <span className="text-tv-muted text-xs">{item.authorHandle}</span>}
                  {item.isFeatured && <span className="badge badge-warning">⭐ Öne Çıkan</span>}
                  {item.isHighlight && <span className="badge badge-primary">🤖 AI</span>}
                  {item.scheduledFor && new Date(item.scheduledFor as string) > new Date() && (
                    <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>⏰ Planlandı</span>
                  )}
                  {sentimentBadge(item.sentiment ?? undefined)}
                  {/* Score badge */}
                  {(() => { const s = calcScore(item); return s > 0 ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: `${scoreColor(s)}20`, color: scoreColor(s), border: `1px solid ${scoreColor(s)}30` }}>
                      {s}
                    </span>
                  ) : null; })()}
                </div>
                <p className="text-sm text-tv-text/80 line-clamp-2">{item.text}</p>
                {item.aiSummary && (
                  <p className="text-xs text-tv-muted mt-1 line-clamp-1">AI: {item.aiSummary}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-tv-muted">
                  {item.likes > 0 && <span>❤️ {formatNumber(item.likes)}</span>}
                  {item.comments > 0 && <span>💬 {formatNumber(item.comments)}</span>}
                  <span>{formatRelative(item.createdAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!item.isApproved && (
                  <button onClick={() => handleApprove(item.id, true)} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                    ✓ Onayla
                  </button>
                )}
                {item.isApproved && (
                  <button onClick={() => handleApprove(item.id, false)} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-tv-muted hover:bg-white/10 transition-colors">
                    Geri Al
                  </button>
                )}
                <button
                  onClick={() => handleFeature(item.id, !item.isFeatured)}
                  className={cn(
                    'text-xs px-2 py-1 rounded-lg transition-colors',
                    item.isFeatured
                      ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                      : 'bg-white/5 text-tv-muted hover:bg-white/10',
                  )}
                >
                  {item.isFeatured ? '⭐' : '☆'}
                </button>
                <button
                  onClick={() => handleAIAnalyze(item.id, item.text)}
                  disabled={aiAnalyzing === item.id}
                  className="text-xs px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                  title="AI Analiz"
                >
                  {aiAnalyzing === item.id ? '⏳' : '🤖'}
                </button>
                <button
                  onClick={() => handleConvertToAd(item)}
                  disabled={aiToAdId === item.id}
                  className="text-xs px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  title="AI ile Reklama Dönüştür"
                >
                  {aiToAdId === item.id ? '⏳' : '🎯'}
                </button>
                <button onClick={() => handleDelete(item.id)} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-tv-muted hover:bg-red-500/10 hover:text-red-400 transition-colors">
                  🗑️
                </button>
              </div>
            </div>
            </SwipeableContentCard>
          ))}
        </div>
      )}
    </div>
  );
}
