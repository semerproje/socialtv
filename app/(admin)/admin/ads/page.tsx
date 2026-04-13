'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Advertisement, TextAdContent } from '@/types';
import { formatNumber, formatDate, formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';

const AD_TYPES = [
  { value: 'text', label: '📝 Metin Reklam', desc: 'Başlık, alt başlık, CTA ile reklam' },
  { value: 'image', label: '🖼️ Görsel Reklam', desc: 'Görsel URL ile tam ekran reklam' },
  { value: 'video', label: '🎬 Video Reklam', desc: 'Video URL ile reklam' },
  { value: 'html', label: '💻 HTML Reklam', desc: 'Özel HTML/CSS ile reklam' },
];

const ACCENT_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16',
];

const emptyTextContent: TextAdContent = {
  headline: '',
  subheadline: '',
  body: '',
  cta: '',
  badge: '',
};

const emptyForm = {
  title: '',
  description: '',
  type: 'text',
  content: JSON.stringify(emptyTextContent),
  duration: 15,
  priority: 5,
  isActive: true,
  backgroundColor: '#0f172a',
  textColor: '#ffffff',
  accentColor: '#6366f1',
  startDate: '',
  endDate: '',
};

export default function AdsPage() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [textContent, setTextContent] = useState<TextAdContent>(emptyTextContent);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleStartHour, setScheduleStartHour] = useState(9);
  const [scheduleEndHour, setScheduleEndHour] = useState(22);
  const [targetImpressions, setTargetImpressions] = useState<number | ''>('');
  const [maxPerHour, setMaxPerHour] = useState<number | ''>('');
  const [maxPerDay, setMaxPerDay] = useState<number | ''>('');
  const [cooldownSeconds, setCooldownSeconds] = useState<number | ''>('');

  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch('/api/ads');
      const data = await res.json();
      setAds(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const openNew = () => {
    setForm(emptyForm);
    setTextContent(emptyTextContent);
    setEditingId(null);
    setScheduleEnabled(false);
    setScheduleDays([]);
    setScheduleStartHour(9);
    setScheduleEndHour(22);
    setTargetImpressions('');
    setMaxPerHour('');
    setMaxPerDay('');
    setCooldownSeconds('');
    setShowForm(true);
  };

  const openEdit = (ad: Advertisement) => {
    let tc = emptyTextContent;
    if (ad.type === 'text') {
      try { tc = JSON.parse(ad.content) as TextAdContent; } catch { /**/ }
    }
    // Parse schedule
    if (ad.scheduleJson) {
      try {
        const s = JSON.parse(ad.scheduleJson);
        setScheduleEnabled(true);
        setScheduleDays(s.days ?? []);
        setScheduleStartHour(s.startHour ?? 9);
        setScheduleEndHour(s.endHour ?? 22);
      } catch { setScheduleEnabled(false); }
    } else {
      setScheduleEnabled(false);
      setScheduleDays([]);
    }
    setTextContent(tc);
    setTargetImpressions(ad.targetImpressions ?? '');
    setMaxPerHour(ad.maxPerHour ?? '');
    setMaxPerDay(ad.maxPerDay ?? '');
    setCooldownSeconds(ad.cooldownSeconds ?? '');
    setForm({
      title: ad.title,
      description: ad.description ?? '',
      type: ad.type,
      content: ad.content,
      duration: ad.duration,
      priority: ad.priority,
      isActive: ad.isActive,
      backgroundColor: ad.backgroundColor ?? '#0f172a',
      textColor: ad.textColor ?? '#ffffff',
      accentColor: ad.accentColor ?? '#6366f1',
      startDate: '',
      endDate: '',
    });
    setEditingId(ad.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu reklamı silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/ads/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Reklam silindi');
      fetchAds();
    } else {
      toast.error('Silme başarısız');
    }
  };

  const handleToggle = async (ad: Advertisement) => {
    const res = await fetch(`/api/ads/${ad.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !ad.isActive }),
    });
    if (res.ok) {
      fetchAds();
      toast.success(ad.isActive ? 'Reklam durduruldu' : 'Reklam yayına alındı');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalContent = form.type === 'text' ? JSON.stringify(textContent) : form.content;
      const scheduleJson = scheduleEnabled && scheduleDays.length > 0
        ? JSON.stringify({ days: scheduleDays, startHour: scheduleStartHour, endHour: scheduleEndHour })
        : null;
      const body = {
        ...form, content: finalContent, scheduleJson,
        targetImpressions: targetImpressions !== '' ? Number(targetImpressions) : null,
        maxPerHour: maxPerHour !== '' ? Number(maxPerHour) : null,
        maxPerDay: maxPerDay !== '' ? Number(maxPerDay) : null,
        cooldownSeconds: cooldownSeconds !== '' ? Number(cooldownSeconds) : null,
      };

      const url = editingId ? `/api/ads/${editingId}` : '/api/ads';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editingId ? 'Reklam güncellendi' : 'Reklam oluşturuldu');
        setShowForm(false);
        fetchAds();
      } else {
        const err = await res.json();
        toast.error(err.error ?? 'Kayıt başarısız');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ad_copy',
          offer: aiPrompt,
          business: 'Social Lounge',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTextContent(data.data as TextAdContent);
        setForm((f) => ({ ...f, type: 'text', aiGenerated: true } as typeof f));
        toast.success('AI reklam metni oluşturuldu!');
      } else {
        toast.error(data.error ?? 'AI hatası');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const bulkSetActive = async (isActive: boolean) => {
    await Promise.all(
      [...selectedIds].map((id) =>
        fetch(`/api/ads/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive }),
        }),
      ),
    );
    toast.success(isActive ? `${selectedIds.size} reklam yayına alındı` : `${selectedIds.size} reklam durduruldu`);
    setSelectedIds(new Set());
    fetchAds();
  };

  const bulkDelete = async () => {
    if (!confirm(`${selectedIds.size} reklamı silmek istediğinize emin misiniz?`)) return;
    await Promise.all([...selectedIds].map((id) => fetch(`/api/ads/${id}`, { method: 'DELETE' })));
    toast.success(`${selectedIds.size} reklam silindi`);
    setSelectedIds(new Set());
    fetchAds();
  };

  const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Reklam Yönetimi
          </h1>
          <p className="text-tv-muted text-sm mt-1">{ads.length} reklam · {ads.filter((a) => a.isActive).length} aktif</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          + Yeni Reklam
        </button>
      </div>

      {/* Bulk Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
          <span className="text-sm text-indigo-300 font-medium">{selectedIds.size} seçildi</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkSetActive(true)} className="btn-secondary text-xs py-1.5 px-3 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
              ▶ Aktifleştir
            </button>
            <button onClick={() => bulkSetActive(false)} className="btn-secondary text-xs py-1.5 px-3">
              ⏸ Pasifleştir
            </button>
            <button onClick={bulkDelete} className="btn-secondary text-xs py-1.5 px-3 text-red-400 border-red-500/30 hover:bg-red-500/10">
              🗑 Sil
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-tv-muted hover:text-tv-text px-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto admin-card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-tv-text">
                {editingId ? 'Reklamı Düzenle' : 'Yeni Reklam'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-tv-muted hover:text-tv-text text-xl">✕</button>
            </div>

            {/* AI Generator */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                🤖 AI Reklam Üretici
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="Reklamınızı tarif edin... (örn: 'happy hour %30 indirim')"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {aiLoading ? '⏳' : '✨ Üret'}
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-tv-muted mb-1.5 block">Reklam Başlığı *</label>
                <input
                  className="input-field"
                  placeholder="Reklam adı (admin için)"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-tv-muted mb-1.5 block">Tür *</label>
                <select
                  className="input-field"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {AD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-tv-muted mb-1.5 block">Süre (saniye)</label>
                <input
                  type="number"
                  className="input-field"
                  min={5} max={120}
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-tv-muted mb-1.5 block">Öncelik (1–10)</label>
                <input
                  type="range"
                  min={1} max={10}
                  value={form.priority}
                  className="w-full accent-indigo-500"
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                />
                <div className="flex justify-between text-xs text-tv-muted mt-1">
                  <span>Düşük</span>
                  <span className="font-bold text-indigo-400">{form.priority}</span>
                  <span>Yüksek</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-tv-muted mb-1.5 block">Aktif</label>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative',
                      form.isActive ? 'bg-emerald-500' : 'bg-white/10',
                    )}
                  >
                    <div className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                      form.isActive ? 'right-1' : 'left-1',
                    )} />
                  </button>
                  <span className="text-sm text-tv-text">{form.isActive ? 'Yayında' : 'Durduruldu'}</span>
                </div>
              </div>
            </div>

            {/* Text Ad Fields */}
            {form.type === 'text' && (
              <div className="space-y-4">
                <div className="divider-line" />
                <p className="text-sm font-semibold text-tv-text">Metin İçeriği</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-tv-muted mb-1.5 block">Ana Başlık *</label>
                    <input
                      className="input-field"
                      placeholder="MUTLU SAATLER"
                      value={textContent.headline}
                      onChange={(e) => setTextContent({ ...textContent, headline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-tv-muted mb-1.5 block">Alt Başlık</label>
                    <input
                      className="input-field"
                      placeholder="Her gün 17:00 - 20:00"
                      value={textContent.subheadline ?? ''}
                      onChange={(e) => setTextContent({ ...textContent, subheadline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-tv-muted mb-1.5 block">Açıklama</label>
                    <input
                      className="input-field"
                      placeholder="Tüm içeceklerde %30 indirim"
                      value={textContent.body ?? ''}
                      onChange={(e) => setTextContent({ ...textContent, body: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-tv-muted mb-1.5 block">Eylem Çağrısı (CTA)</label>
                    <input
                      className="input-field"
                      placeholder="Hemen sipariş ver!"
                      value={textContent.cta ?? ''}
                      onChange={(e) => setTextContent({ ...textContent, cta: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-tv-muted mb-1.5 block">Rozet</label>
                    <input
                      className="input-field"
                      placeholder="BUGÜN, ÖZEL, YENİ..."
                      value={textContent.badge ?? ''}
                      onChange={(e) => setTextContent({ ...textContent, badge: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-tv-muted mb-1.5 block">Vurgu Rengi</label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {ACCENT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setForm({ ...form, accentColor: c })}
                          className={cn(
                            'w-7 h-7 rounded-lg transition-transform hover:scale-110',
                            form.accentColor === c && 'ring-2 ring-white ring-offset-2 ring-offset-tv-card',
                          )}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image/Video URL */}
            {(form.type === 'image' || form.type === 'video') && (
              <div>
                <label className="text-xs font-medium text-tv-muted mb-1.5 block">
                  {form.type === 'image' ? 'Görsel URL' : 'Video URL'} *
                </label>
                <input
                  className="input-field"
                  placeholder={form.type === 'image' ? 'https://... .jpg/.png' : 'https://... .mp4'}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
            )}

            {/* HTML Content */}
            {form.type === 'html' && (
              <div>
                <label className="text-xs font-medium text-tv-muted mb-1.5 block">HTML İçerik *</label>
                <textarea
                  className="input-field font-mono text-xs h-32 resize-none"
                  placeholder="<div class='...'> ... </div>"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
            )}

            {/* Time Scheduling */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-tv-text flex items-center gap-2">🕐 Zaman Planlaması</p>
                <button
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={cn('w-10 h-5 rounded-full transition-colors relative', scheduleEnabled ? 'bg-indigo-500' : 'bg-white/10')}
                >
                  <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', scheduleEnabled ? 'right-0.5' : 'left-0.5')} />
                </button>
              </div>
              {scheduleEnabled && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-tv-muted mb-2">Yayın Günleri</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAY_NAMES.map((day, i) => (
                        <button
                          key={i}
                          onClick={() => setScheduleDays((prev) => prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i])}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                            scheduleDays.includes(i) ? 'bg-indigo-500 text-white' : 'bg-white/5 text-tv-muted hover:bg-white/10',
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-tv-muted mb-1 block">Başlangıç Saati</label>
                      <input
                        type="number" min={0} max={23}
                        className="input-field"
                        value={scheduleStartHour}
                        onChange={(e) => setScheduleStartHour(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-tv-muted mb-1 block">Bitiş Saati</label>
                      <input
                        type="number" min={0} max={23}
                        className="input-field"
                        value={scheduleEndHour}
                        onChange={(e) => setScheduleEndHour(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-tv-muted">
                    {scheduleDays.length > 0
                      ? `${scheduleDays.map((d) => DAY_NAMES[d]).join(', ')} · ${scheduleStartHour}:00 – ${scheduleEndHour}:00`
                      : 'Gün seçilmedi — tüm günler gösterilir'}
                  </p>
                </div>
              )}
            </div>

            {/* Impression Budget */}
            <div>
              <label className="text-xs font-medium text-tv-muted mb-1.5 block">
                🎯 Gösterim Bütçesi <span className="text-white/20">(opsiyonel)</span>
              </label>
              <input
                type="number"
                min={1}
                className="input-field"
                placeholder="Örn: 500 — limite ulaşınca otomatik durdurulur"
                value={targetImpressions}
                onChange={(e) => setTargetImpressions(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            {/* Frequency Cap */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-tv-text">⏱️ Frekans Sınırlama</span>
                <span className="text-[10px] text-tv-muted">(opsiyonel)</span>
              </div>
              <p className="text-[11px] text-tv-muted mb-3">Aynı reklamın çok sık gösterilmesini önler</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-tv-muted mb-1 block">Saatte Maks.</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    placeholder="Örn: 3"
                    value={maxPerHour}
                    onChange={(e) => setMaxPerHour(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-tv-muted mb-1 block">Günde Maks.</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    placeholder="Örn: 20"
                    value={maxPerDay}
                    onChange={(e) => setMaxPerDay(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-tv-muted mb-1 block">Soğuma (sn)</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    placeholder="Örn: 300"
                    value={cooldownSeconds}
                    onChange={(e) => setCooldownSeconds(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? '⏳ Kaydediliyor…' : editingId ? '✓ Güncelle' : '+ Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ads List */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-card animate-pulse">
              <div className="h-5 bg-white/10 rounded mb-3 w-3/4" />
              <div className="h-4 bg-white/5 rounded mb-2 w-1/2" />
              <div className="h-4 bg-white/5 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="admin-card text-center py-16">
          <p className="text-5xl mb-4">📺</p>
          <p className="text-tv-text font-semibold text-lg">Henüz reklam yok</p>
          <p className="text-tv-muted text-sm mt-2">İlk reklamınızı oluşturun!</p>
          <button onClick={openNew} className="btn-primary mt-6">+ İlk Reklamı Oluştur</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className={cn(
                'admin-card relative overflow-hidden hover:border-white/20 transition-colors',
                selectedIds.has(ad.id) && 'border-indigo-500/40 bg-indigo-500/[0.05]',
              )}
            >
              {/* Priority stripe */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: `hsl(${ad.priority * 24}, 70%, 50%)` }}
              />

              <div className="ml-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(ad.id)}
                      onChange={() => toggleSelect(ad.id)}
                      className="mt-0.5 accent-indigo-500 flex-shrink-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-tv-text truncate">{ad.title}</h3>
                        {ad.aiGenerated && (
                          <span className="badge badge-primary text-[10px] flex-shrink-0">AI</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-muted capitalize">{ad.type}</span>
                        <span className={cn('badge', ad.isActive ? 'badge-success' : 'badge-danger')}>
                          {ad.isActive ? 'Aktif' : 'Durduruldu'}
                        </span>
                        {ad.scheduleJson && (
                          <span className="badge badge-muted">🕐 Planlı</span>
                        )}
                        {ad.targetImpressions && (
                          <span className="badge badge-muted">🎯 {formatNumber(ad.targetImpressions)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(ad)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-tv-muted hover:text-tv-text transition-colors text-sm"
                      title={ad.isActive ? 'Durdur' : 'Yayına Al'}
                    >
                      {ad.isActive ? '⏸' : '▶️'}
                    </button>
                    <button
                      onClick={() => openEdit(ad)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-tv-muted hover:text-tv-text transition-colors text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(ad.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-tv-muted hover:text-red-400 transition-colors text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Performance bar */}
                {ad.impressions > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-tv-muted mb-1">
                      <span>{formatNumber(ad.impressions)} gösterim{ad.targetImpressions ? ` / ${formatNumber(ad.targetImpressions)}` : ''}</span>
                      <span>%{Math.round((ad.completions / ad.impressions) * 100)} tamamlanma</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: ad.targetImpressions
                            ? `${Math.min(100, Math.round((ad.impressions / ad.targetImpressions) * 100))}%`
                            : `${Math.min(100, Math.round((ad.completions / ad.impressions) * 100))}%`,
                          background: ad.targetImpressions && ad.impressions >= ad.targetImpressions
                            ? '#ef4444'
                            : '#6366f1',
                        }}
                      />
                    </div>
                    {ad.targetImpressions && (
                      <p className="text-[10px] text-tv-muted mt-0.5 text-right">
                        {Math.min(100, Math.round((ad.impressions / ad.targetImpressions) * 100))}% bütçe kullanıldı
                      </p>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/[0.05]">
                  <div className="text-center">
                    <p className="text-base font-bold text-tv-text">{formatNumber(ad.impressions)}</p>
                    <p className="text-[11px] text-tv-muted">Gösterim</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-tv-text">{ad.duration}s</p>
                    <p className="text-[11px] text-tv-muted">Süre</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-tv-text">{ad.priority}/10</p>
                    <p className="text-[11px] text-tv-muted">Öncelik</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
