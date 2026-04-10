'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Content } from '@/types';
import { cn, getPlatformColor, getPlatformIcon, formatNumber, formatRelative } from '@/lib/utils';

const PLATFORMS = ['all', 'custom', 'instagram', 'twitter', 'tiktok', 'announcement'];

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

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
              filter === p
                ? 'bg-tv-primary text-white border-tv-primary'
                : 'border-white/10 text-tv-muted hover:text-tv-text hover:border-white/20',
            )}
          >
            {p === 'all' ? '🌐 Tümü' : `${getPlatformIcon(p)} ${p}`}
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
              <button onClick={() => setShowForm(false)} className="text-tv-muted hover:text-tv-text text-xl">✕</button>
            </div>
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
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">İptal</button>
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
            <div key={item.id} className="admin-card flex items-start gap-4 hover:border-white/20 transition-colors">
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
                  {sentimentBadge(item.sentiment ?? undefined)}
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
                >
                  {aiAnalyzing === item.id ? '⏳' : '🤖'}
                </button>
                <button onClick={() => handleDelete(item.id)} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-tv-muted hover:bg-red-500/10 hover:text-red-400 transition-colors">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
