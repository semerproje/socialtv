'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { AppSettings } from '@/types';

const SETTING_GROUPS = [
  {
    title: '📱 Uygulama',
    keys: [
      { key: 'app_name', label: 'Uygulama Adı', type: 'text', placeholder: 'Social Lounge TV' },
      { key: 'app_tagline', label: 'Alt Başlık', type: 'text', placeholder: 'Premium Lounge Experience' },
    ],
  },
  {
    title: '🎨 Görünüm',
    keys: [
      { key: 'primary_color', label: 'Ana Renk', type: 'color' },
      { key: 'secondary_color', label: 'İkincil Renk', type: 'color' },
      { key: 'layout', label: 'Düzen', type: 'select', options: ['default', 'portrait', 'minimal'] },
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

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => { setSettings(d.data ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
                  <div key={field.key}>
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
                    ) : field.type === 'color' ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings[field.key as keyof AppSettings] ?? '#6366f1'}
                          onChange={(e) => update(field.key, e.target.value)}
                          className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-white/10"
                        />
                        <input
                          type="text"
                          className="input-field flex-1"
                          value={settings[field.key as keyof AppSettings] ?? ''}
                          onChange={(e) => update(field.key, e.target.value)}
                        />
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
        </div>
      )}
    </div>
  );
}
