'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { TickerMessage } from '@/types';
import { cn } from '@/lib/utils';

const EMOJIS = ['📢', '🎉', '🎵', '🍹', '⭐', '🔥', '📶', '📞', '🎊', '💡', '🎯', '🏆'];

const emptyForm = {
  text: '',
  emoji: '📢',
  isActive: true,
  priority: 5,
  color: '#f8fafc',
};

export default function TickerPage() {
  const [tickers, setTickers] = useState<TickerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchTickers = useCallback(async () => {
    try {
      const res = await fetch('/api/ticker');
      const data = await res.json();
      setTickers(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickers(); }, [fetchTickers]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingId ? `/api/ticker/${editingId}` : '/api/ticker';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(editingId ? 'Güncellendi' : 'Ticker eklendi');
        setShowForm(false);
        setForm(emptyForm);
        setEditingId(null);
        fetchTickers();
      } else {
        toast.error('Kayıt başarısız');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ticker: TickerMessage) => {
    const res = await fetch(`/api/ticker/${ticker.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !ticker.isActive }),
    });
    if (res.ok) { fetchTickers(); toast.success(ticker.isActive ? 'Durduruldu' : 'Yayına alındı'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Silmek istiyor musunuz?')) return;
    await fetch(`/api/ticker/${id}`, { method: 'DELETE' });
    toast.success('Silindi');
    fetchTickers();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ticker Mesajları
          </h1>
          <p className="text-tv-muted text-sm mt-1">Altta akan haberler ve duyurular</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="btn-primary">
          + Mesaj Ekle
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-white/10">
        <div className="bg-tv-surface px-4 py-2 text-xs text-tv-muted font-medium">Önizleme</div>
        <div className="px-6 py-3 bg-tv-bg overflow-hidden">
          <div className="ticker-wrapper">
            <div className="ticker-track" style={{ '--ticker-duration': '20s' } as React.CSSProperties}>
              {[...tickers, ...tickers].map((t, i) => (
                <span key={i} className="inline-flex items-center">
                  <span className="mr-2">{t.emoji}</span>
                  <span className="text-sm mr-8 whitespace-nowrap" style={{ color: t.color }}>{t.text}</span>
                  <span className="mr-8 text-tv-muted">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md admin-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-tv-text">Ticker Mesajı</h2>
              <button onClick={() => setShowForm(false)} className="text-tv-muted hover:text-tv-text text-xl">✕</button>
            </div>
            <div>
              <label className="text-xs text-tv-muted mb-1.5 block">Mesaj *</label>
              <input className="input-field" placeholder="Mesaj metni..." value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-tv-muted mb-1.5 block">Emoji</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                    className={cn('w-9 h-9 rounded-xl text-lg transition-all', form.emoji === e ? 'bg-tv-primary scale-110 ring-2 ring-tv-primary/40' : 'bg-white/5 hover:bg-white/10')}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-tv-muted mb-1.5 block">Metin Rengi</label>
                <input type="color" className="w-full h-10 rounded-xl cursor-pointer bg-transparent border border-white/10" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-tv-muted mb-1.5 block">Öncelik ({form.priority})</label>
                <input type="range" min={1} max={10} value={form.priority} className="w-full accent-indigo-500 mt-2" onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleSave} disabled={saving || !form.text} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? '⏳' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="admin-card animate-pulse h-16" />)}</div>
      ) : (
        <div className="space-y-3">
          {tickers.map((ticker) => (
            <div key={ticker.id} className="admin-card flex items-center gap-4 hover:border-white/20 transition-colors">
              <span className="text-2xl">{ticker.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-tv-text truncate" style={{ color: ticker.color }}>{ticker.text}</p>
                <p className="text-xs text-tv-muted">Öncelik: {ticker.priority}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleToggle(ticker)}
                  className={cn('text-xs px-2 py-1 rounded-lg transition-colors', ticker.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-tv-muted')}>
                  {ticker.isActive ? '● Aktif' : '○ Pasif'}
                </button>
                <button onClick={() => { setForm({ text: ticker.text, emoji: ticker.emoji ?? '📢', isActive: ticker.isActive, priority: ticker.priority, color: ticker.color ?? '#f8fafc' }); setEditingId(ticker.id); setShowForm(true); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-tv-muted text-sm">✏️</button>
                <button onClick={() => handleDelete(ticker.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-tv-muted hover:text-red-400 text-sm">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
