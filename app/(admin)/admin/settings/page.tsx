'use client';

import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import type { AppSettings } from '@/types';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

const SETTING_GROUPS = [
  {
    title: '🏷️ Brand Kit',
    keys: [
      { key: 'accent_color', label: 'Vurgu Rengi', type: 'color' },
      { key: 'font_family', label: 'Yazı Tipi', type: 'select', options: ['Space Grotesk', 'Inter', 'Roboto', 'Montserrat', 'Poppins'] },
      { key: 'splash_image_url', label: 'Açılış Görseli URL', type: 'text', placeholder: 'https://…' },
      { key: 'favicon_url', label: 'Favicon URL', type: 'text', placeholder: 'https://…' },
      { key: 'footer_text', label: 'Footer Metni', type: 'text', placeholder: 'Powered by Social Lounge TV' },
    ],
  },
  {
    title: '📱 Uygulama',
    keys: [
      { key: 'app_name', label: 'Uygulama Adı', type: 'text', placeholder: 'Social Lounge TV' },
      { key: 'app_tagline', label: 'Alt Başlık', type: 'text', placeholder: 'Premium Lounge Experience' },
      { key: 'timezone', label: 'Saat Dilimi', type: 'timezone' },
    ],
  },
  {
    title: '🎨 Görünüm',
    keys: [
      { key: 'primary_color', label: 'Ana Renk', type: 'color' },
      { key: 'secondary_color', label: 'İkincil Renk', type: 'color' },
      { key: 'layout', label: 'Düzen', type: 'select', options: [
        'default', 'youtube', 'instagram', 'split_2', 'fullscreen',
        'digital_signage', 'social_wall', 'ambient', 'promo', 'triple',
        'news_focus', 'portrait', 'markets', 'breaking_news',
        'event_countdown', 'split_scoreboard',
      ] },
      { key: 'ticker_speed', label: 'Ticker Hızı (sn)', type: 'number', placeholder: '40' },
    ],
  },
  {
    title: '🌤️ Hava Durumu',
    keys: [
      { key: 'weather_city', label: 'Şehir Adı', type: 'text', placeholder: 'İstanbul' },
      { key: 'weather_lat', label: 'Enlem', type: 'text', placeholder: '41.0082' },
      { key: 'weather_lon', label: 'Boylam', type: 'text', placeholder: '28.9784' },
    ],
  },
  {
    title: '📱 QR Kodu',
    keys: [
      { key: 'show_qr_code', label: 'QR Kod Göster', type: 'boolean' },
      { key: 'qr_url', label: 'QR URL', type: 'text', placeholder: 'https://instagram.com/...' },
      { key: 'qr_label', label: 'QR Etiketi', type: 'text', placeholder: 'Bizi takip et!' },
    ],
  },
  {
    title: '📶 WiFi',
    keys: [
      { key: 'wifi_name', label: 'WiFi Adı', type: 'text', placeholder: 'SocialLounge_Guest' },
      { key: 'wifi_password', label: 'WiFi Şifresi', type: 'text', placeholder: '12345678' },
    ],
  },
  {
    title: '🤖 AI',
    keys: [
      { key: 'ai_auto_moderate', label: 'Otomatik Moderasyon', type: 'boolean' },
      { key: 'ai_auto_analyze', label: 'Otomatik Analiz', type: 'boolean' },
    ],
  },
  {
    title: '⚙️ Teknik',
    keys: [
      { key: 'content_refresh_ms', label: 'Veri Yenileme Süresi (ms)', type: 'number', placeholder: '30000' },
      { key: 'instagram_slide_ms', label: 'Instagram Geçiş Süresi (ms)', type: 'number', placeholder: '8000' },
    ],
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<AppSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const TIMEZONES = [
    'Europe/Istanbul', 'UTC', 'Europe/London', 'Europe/Berlin',
    'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai',
  ];

  const COLOR_SWATCHES = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#f59e0b', '#10b981', '#14b8a6', '#22d3ee', '#3b82f6',
  ];

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => { setSettings(d.data ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const sRef = storageRef(storage, `logos/${Date.now()}_${file.name}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      update('logo_url', url);
      toast.success('Logo yüklendi!');
    } catch {
      toast.error('Logo yükleme başarısız');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success('Ayarlar kaydedildi!');
      } else {
        toast.error('Kayıt başarısız');
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ayarlar
          </h1>
          <p className="text-tv-muted text-sm mt-1">Sistem ve görünüm ayarları</p>
        </div>
        <button onClick={handleSave} disabled={saving || loading} className="btn-primary disabled:opacity-50">
          {saving ? '⏳ Kaydediliyor…' : '💾 Kaydet'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="admin-card animate-pulse h-32" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {SETTING_GROUPS.map((group) => (
            <div key={group.title} className="admin-card space-y-4">
              <h2 className="font-semibold text-tv-text text-sm border-b border-white/[0.06] pb-3">
                {group.title}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {group.keys.map((field) => (
                  <div key={field.key} className={field.type === 'color' ? 'col-span-2 sm:col-span-1' : ''}>
                    <label className="text-xs font-medium text-tv-muted mb-1.5 block">
                      {field.label}
                    </label>

                    {field.type === 'boolean' ? (
                      <button
                        onClick={() => update(field.key, settings[field.key as keyof AppSettings] === 'true' ? 'false' : 'true')}
                        className={`w-11 h-6 rounded-full transition-colors relative ${settings[field.key as keyof AppSettings] === 'true' ? 'bg-emerald-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings[field.key as keyof AppSettings] === 'true' ? 'right-1' : 'left-1'}`} />
                      </button>
                    ) : field.type === 'timezone' ? (
                      <select
                        className="input-field"
                        value={settings[field.key as keyof AppSettings] ?? 'Europe/Istanbul'}
                        onChange={(e) => update(field.key, e.target.value)}
                      >
                        {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    ) : field.type === 'color' ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_SWATCHES.map((c) => (
                            <button
                              key={c}
                              onClick={() => update(field.key, c)}
                              className={`w-6 h-6 rounded-md transition-transform hover:scale-110 ${settings[field.key as keyof AppSettings] === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0f172a]' : ''}`}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings[field.key as keyof AppSettings] ?? '#6366f1'}
                            onChange={(e) => update(field.key, e.target.value)}
                            className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                          />
                          <input
                            type="text"
                            className="input-field flex-1"
                            value={settings[field.key as keyof AppSettings] ?? ''}
                            onChange={(e) => update(field.key, e.target.value)}
                          />
                        </div>
                      </div>
                    ) : field.type === 'select' ? (
                      <select
                        className="input-field"
                        value={settings[field.key as keyof AppSettings] ?? ''}
                        onChange={(e) => update(field.key, e.target.value)}
                      >
                        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        className="input-field"
                        placeholder={field.placeholder}
                        value={settings[field.key as keyof AppSettings] ?? ''}
                        onChange={(e) => update(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Logo Upload */}
          <div className="admin-card space-y-4">
            <h2 className="font-semibold text-tv-text text-sm border-b border-white/[0.06] pb-3">🖼️ Logo</h2>
            <div className="flex items-center gap-4">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-16 w-auto rounded-xl object-contain bg-white/5 p-2" />
              ) : (
                <div className="h-16 w-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-tv-muted text-xs">Logo yok</div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  className="input-field"
                  placeholder="https://... (logo URL)"
                  value={settings.logo_url ?? ''}
                  onChange={(e) => update('logo_url', e.target.value)}
                />
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary text-xs py-1.5 disabled:opacity-50"
                >
                  {uploading ? '⏳ Yükleniyor…' : '📤 Dosyadan Yükle'}
                </button>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="admin-card space-y-4">
            <h2 className="font-semibold text-tv-text text-sm border-b border-white/[0.06] pb-3">ℹ️ Sistem Bilgisi</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Firebase Proje', value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '—' },
                { label: 'Uygulama URL', value: process.env.NEXT_PUBLIC_APP_URL ?? window?.location?.origin ?? '—' },
                { label: 'Node Ortamı', value: process.env.NODE_ENV ?? '—' },
                { label: 'Build', value: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local' },
              ].map((row) => (
                <div key={row.label} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-tv-muted mb-0.5">{row.label}</p>
                  <p className="text-tv-text font-mono truncate">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
