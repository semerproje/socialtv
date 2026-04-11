# Faz 1 — Temel Güçlendirme

> Süre: ~1-2 hafta  
> Öncelik: KRİTİK  
> Etki: Tüm admin kullanıcılarını direkt etkiler

---

## 1.1 Dashboard 2.0

### Şu anki sorunlar
- Sadece toplam istatistik, zaman dilimi filtresi yok
- Ekranların online/offline durumu gösterilmiyor
- Son broadcast komutları görünmüyor
- Grafik tek boyutlu (sadece bar chart)
- Quick action butonları statik linkler

### Hedef tasarım: 3 satır layout

```
┌─────────────────────────────────────────────────────────┐
│ Stat Cards (5 adet): Gösterim · Ekran · İçerik · AI · QR│
├──────────────────────────┬──────────────────────────────┤
│ Aktivite Grafiği (7 gün) │ Canlı Ekran Durumu          │
│ Bar + Line chart         │ Ekran kart listesi (online)  │
├──────────────────────────┴──────────────────────────────┤
│ Top Reklamlar │ Son Yayın Geçmişi │ Hızlı Aksiyon Panel │
└─────────────────────────────────────────────────────────┘
```

### Yapılacaklar

#### A. Yeni Stat Kartları
```typescript
// 5. kart ekle: Online Ekran Sayısı
{
  title: 'Aktif Ekranlar',
  value: `${onlineCount}/${totalCount}`,
  icon: '🖥️',
  color: '#22d3ee',
  sub: 'Şu anda yayında',
  trend: '+2 son saatte',  // yeni: trend badge
}
```

**Her kart:**
- Sağ üste sparkline trend çizgisi (mini Recharts LineChart)
- Renk: değer artışta yeşil ok, düşüşte kırmızı ok
- Tıklanabilir → ilgili detay sayfasına yönlendirir

#### B. Canlı Ekran Durumu Paneli
```typescript
// /api/screens'den çek, 30s interval ile güncelle
// Her ekran için:
interface ScreenCard {
  id, name, layout,
  isOnline: boolean,   // lastSeen < 90s ise online
  lastSeen: string,    // "2 dk önce"
  uptime: number,      // son 24 saatte kaç dakika online
}
```
- Online ekranlar yeşil badge, offline gri
- Layout adı (Default, Markets, YouTube vb.)
- Son görülme zamanı
- "Tüm ekranlara komut gönder" hızlı butonu

#### C. Son Yayın Geçmişi
```typescript
// Firestore 'broadcast_logs' collection'ına son 10 komutu al
// Her satır: zaman · hedef ekran · komut tipi · sonuç
type BroadcastLog = {
  sentAt: Timestamp,
  command: string,      // "change_layout", "reload" vb.
  targetCount: number,  // kaç ekrana gönderildi
  screenNames: string[],
}
```

#### D. Grafik Yükseltme
- Mevcut bar chart yanına **line chart** ekle (ComposedChart)
- Tooltip formatı geliştirilecek
- Zaman aralığı toggle: **Bu hafta / Bu ay** butonu
- Y ekseni auto-scale

#### E. Hızlı Broadcast Paneli
- Direkt dashboard'dan layout seçip tüm ekranlara gönder
- 4 hızlı buton: "Varsayılan · Markets · News · Social Wall"

---

## 1.2 Ads Sayfası — Pro Seviye

### Şu anki eksikler
- Zaman hedefleme yok (tüm gün gösterilir)
- Frekans sınırlama yok
- Toplu işlem yok
- Reklam performans grafikleri yok
- Drag-to-reorder yok

### Yeni özellikler

#### A. Zaman Hedefleme (Ad Scheduling)
```typescript
interface AdScheduleSlot {
  days: number[];       // [1,2,3,4,5] = hafta içi
  startHour: number;   // 8
  endHour: number;     // 12
  label: string;       // "Sabah Kuşağı"
}
```
UI: Gün checkbox'ları + saat aralığı slider (Radix Slider)  
Backend: `ad-scheduler.ts` zaten var, `scheduleJson` alanına yaz

#### B. Frekans Sınırlama
```typescript
interface FrequencyCap {
  maxPerHour: number;   // saatte maksimum X kez
  maxPerDay: number;    // günde maksimum Y kez
  cooldownSeconds: number; // aynı ekranda ardışık aradan önce bekleme
}
```

#### C. Impression Budget
```typescript
// Reklam formuna ekle
targetImpressions?: number;  // 1000 gösterime ulaşınca otomatik pasife al
// display ekranında: impressions >= targetImpressions → isActive = false
```

#### D. Performans Kartları (Her Reklam İçin)
```
┌─────────────────────────────────┐
│ 📺 Yaz İndirimi                 │
│ ████████░░  82% tamamlanma      │
│ 1,247 gösterim · 3.2 saat toplam│
│ 📈 Dün: 89 · Bu hafta: 521      │
│ [Düzenle] [Kopyala] [P: 8/10]   │
└─────────────────────────────────┘
```

#### E. Toplu İşlem Toolbar
```
[✓] 3 seçili  |  [Aktifleştir] [Pasifleştir] [Sil] [Öncelik Değiştir]
```

#### F. Drag-to-Reorder Priority
- `@dnd-kit/core` ile sürükle-bırak priority sıralaması
- Renk şeridi sürükleme sırasında canlı güncellenir

---

## 1.3 Content Sayfası — İçerik Zekası

### Şu anki eksikler
- Toplu onayla / reddet yok
- İçerik skor sistemi yok
- Duplicate tespiti yok
- Zamanlama yok

### Yeni özellikler

#### A. İçerik Skor Sistemi
```typescript
function calcContentScore(content: Content): number {
  const engagementScore = Math.min(100, (content.likes + content.comments * 2) / 10);
  const aiScore = content.sentimentScore ? (content.sentimentScore + 1) * 50 : 50;
  const featuredBonus = content.isFeatured ? 20 : 0;
  return Math.round((engagementScore * 0.5) + (aiScore * 0.3) + featuredBonus);
}
```
- Her içerik kartında **0-100 skor badge**
- Sıralama: "Skora Göre" seçeneği eklenir
- Yüksek skorlu içerikler otomatik highlight önerilebilir

#### B. Toplu İşlem
```
┌─ Filtreler ─────────────────┬─ Toplu İşlem ─────────────────┐
│ Platform · Durum · Skor     │ Seçildi: 12 · [Onayla] [Yayına]│
└─────────────────────────────┴────────────────────────────────┘
```

#### C. Duplicate Tespiti
```typescript
// Text benzerliği: Levenshtein distance < 15 ise "benzer içerik" uyarısı
// ExternalId eşleşmesi: aynı IG post ID tekrar eklenmemeli
```

#### D. İçerik Zamanlama
```typescript
// "Bu içeriği saat kaçta yayınla" seçeneği
scheduledFor?: string; // ISO date string
// MainScreen display mantığı: scheduledFor varsa saati bekle
```

#### E. Platform Gruplu Görünüm
- Mevcut: liste filter (`tab`)
- Yeni: Her platform için mini sayaç badge

---

## 1.4 Settings Sayfası — Pro Konfigürasyon

### Şu anki eksikler
- Logo yükleme yok (sadece /logo/logo.png statik)
- Tema renkleri sadece hex text input
- Timezone seçimi yok
- API anahtar yönetimi yok

### Yeni özellikler

#### A. Brand Kit Bölümü
```typescript
// Yeni settings group: "Marka"
{
  logoUrl: string;      // Firebase Storage'a yüklenen logo URL
  faviconUrl: string;   // 32x32 favicon
  appName: string;      // Header'da görünen isim
  tagline: string;      // Alt başlık
}
```
- Logo drag-and-drop upload → Firebase Storage → URL ayara kaydedilir
- Display ekranı `/api/settings`'den logoUrl okur → dinamik logo

#### B. Renk Picker
- `<input type="color">` yerine mini swatches + custom hex input
- Anlık önizleme: "Bu renk tüm header ve accent elementlere uygulanır"

#### C. Timezone Kontrolü
```typescript
// Türkiye zaman dilimleri + UTC
timezone: 'Europe/Istanbul' | 'UTC' | ...
// ClockWidget bunu kullanır
```

#### D. Bildirim Ayarları (Faz 5 için hazırlık)
```typescript
notifications: {
  emailOnScreenOffline: boolean;
  emailOnChannelUnhealthy: boolean;
  adminEmail: string;
}
```

#### E. Sistem Bilgisi Bölümü
- Mevcut commit hash (BUILD_ID)
- Uygulama versiyonu
- Firebase project ID
- Son deploy tarihi

---

## 1.5 Ticker Sayfası — Gelişmiş Mesaj Bandı

### Yeni özellikler
- **Zaman bazlı aktifleştirme**: "Sadece 20:00-23:00 arası göster"
- **Kategori tag'leri**: Spor, Haber, Promosyon, Duyuru
- **Toplu import**: CSV'den birden fazla mesaj yükle
- **Canlı önizleme** büyütülmüş — tam ekran genişliğinde
- **Süreye göre sıralama**: Kısa mesajlar vs uzun mesajlar

---

## Faz 1 Uygulama Sırası

```
1. Dashboard 2.0 yeniden yaz           → app/(admin)/admin/dashboard/page.tsx
2. Ads Pro (zaman hedefleme + bulk)    → app/(admin)/admin/ads/page.tsx
3. Content (skor + bulk + zamanlama)   → app/(admin)/admin/content/page.tsx
4. Settings (logo upload + timezone)   → app/(admin)/admin/settings/page.tsx
5. Ticker (zaman bazlı + önizleme)    → app/(admin)/admin/ticker/page.tsx
```

## Yeni API Endpoint'leri

| Endpoint | Method | Amaç |
|----------|--------|------|
| `/api/broadcast-log` | GET | Son 10 broadcast komutunu getir |
| `/api/screens/summary` | GET | Online/offline sayısı, hızlı özet |
| `/api/ads/[id]/performance` | GET | Tek reklam performance verisi |

## Etkilenen Dosyalar

```
app/(admin)/admin/dashboard/page.tsx    ← TAM YENİDEN YAZ
app/(admin)/admin/ads/page.tsx          ← BÜYÜK GÜNCELLEME
app/(admin)/admin/content/page.tsx      ← ORTA GÜNCELLEME  
app/(admin)/admin/settings/page.tsx     ← ORTA GÜNCELLEME
app/(admin)/admin/ticker/page.tsx       ← KÜÇÜK GÜNCELLEME
app/api/screens/route.ts                ← summary endpoint
lib/ad-scheduler.ts                     ← frequency cap mantığı
```
