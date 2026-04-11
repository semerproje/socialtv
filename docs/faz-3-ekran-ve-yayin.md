# Faz 3 — Display & Yayın Sistemi

> Süre: ~1-2 hafta  
> Öncelik: YÜKSEK  
> Etki: Son kullanıcının gördüğü ekran kalitesi — sektör farkı burada

---

## Neden Bu Faz Kritik?

Dijital tabela platformunda "sektör zirvesi" demek önce görsel kalite demek. Ziyaretçinin gördüğü ekran ne kadar pürüssüz, bilgilendirici ve estetik olursa platform o kadar değerlenir.

---

## 3.1 Mevcut Layout Değerlendirmesi

| Layout | Durum | Sorun |
|--------|-------|-------|
| `default` | ✅ Çalışıyor | AI Highlight bölümü boş kalabiliyor |
| `youtube` | ✅ Çalışıyor | Sidebar content feed dar ve kalabalık |
| `instagram` | ✅ Çalışıyor | Geçiş animasyonu kaba |
| `split_2` | ✅ Çalışıyor | Oranlar iyi ama cansız |
| `fullscreen` | ✅ Çalışıyor | — |
| `digital_signage` | ✅ Çalışıyor | Header çok yer kaplıyor |
| `social_wall` | ✅ Çalışıyor | Mosaic boş hücre gösteriyor |
| `ambient` | ✅ Çalışıyor | Saat/hava tasarımı minimal |
| `promo` | ⚠️ Orta | Geçiş yok, statik |
| `triple` | ✅ Çalışıyor | — |
| `news_focus` | ✅ Çalışıyor | Haber içerikleri statik |
| `portrait` | ⚠️ Orta | Tablet optimizasyonu eksik |
| `markets` | ✅ Güzel | Bloomberg tarzı ✅ |

---

## 3.2 Mevcut Layout İyileştirmeleri

### A. `default` Layout — AI Highlight Bakım

**Sorun:** `AIHighlight` bileşeni veri yokken boş beyaz kutu gösteriyor

**Düzeltme:**
```typescript
// AIHighlight.tsx — fallback state
if (!post) return (
  <div className="flex items-center justify-center h-full opacity-40">
    <div className="text-center">
      <div className="text-4xl mb-3">🎯</div>
      <p className="text-tv-muted text-sm">Öne çıkan içerik bekleniyor...</p>
    </div>
  </div>
);
```

**İyileştirme:** Post carousel (3-4 saniyede bir değişen)
```typescript
// Birden fazla highlight post varsa döndür
const [currentIndex, setCurrentIndex] = useState(0);
useEffect(() => {
  const t = setInterval(() => setCurrentIndex(i => (i+1) % posts.length), 4000);
  return () => clearInterval(t);
}, [posts.length]);
```

### B. `social_wall` Layout — Boş Hücre Yönetimi

**Sorun:** 3x2 grid'de 4 post varsa 2 hücre boş kalıyor gibi görünüyor

**Düzeltme:**
```typescript
// 6 slot için her zaman içerik doldur (döngü + blur fallback)
const slots = Array.from({ length: 6 }, (_, i) => posts[i % posts.length]);
```

**İyileştirme:** Her hücreye hover reveal efekti
```css
.social-wall-cell:hover .engagement-bar { opacity: 1; transform: translateY(0); }
```

### C. `ambient` Layout — Premium Saat/Hava

**Şu an:** ClockWidget + WeatherWidget yan yana

**Hedef:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│           Cumartesi, 11 Nisan 2026                      │
│                                                         │
│                    14:32                                 │
│                                                         │
│         ⛅  22°C  •  İstanbul  •  Rüzgarlı             │
│                                                         │
│    ──────────────────────────────────────────           │
│         Hafif Bulutlu · Nem: 45% · Güneş batışı 19:38 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
- Büyük font saat (200px+)
- Animasyonlu rakam geçişi (Framer Motion `AnimatePresence` + `key`)
- Arka plan: konum bazlı gradient (sabah turuncu, akşam mor)

### D. `promo` Layout — Döngüsel İçerik

**Şu an:** Statik tek içerik kutusu

**Hedef:** Tam ekran kayan carousel
```typescript
// İçerik listesinde sırayla geç, her biri 5 saniye
// Ken Burns efekti: scale(1.0) → scale(1.08), 5s
const kenBurns = {
  initial: { scale: 1.0, opacity: 0 },
  animate: { scale: 1.08, opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 5 }
};
```

### E. `news_focus` Layout — Canlı Haber

**Şu an:** Statik haber listesi

**Hedef:**
- Büyük öne çıkan haber: tam ekran hero
- Alt bant: 3-4 haber ın yatay scroll
- Her 30 saniyede "öne çıkan haber" değişir
- Kaynak logo (BBC, CNN Türk vb.) gösterilir (sadece adın yanında)

---

## 3.3 Yeni Layout: `breaking_news` — Acil Haber

```typescript
// Kullanım senaryosu: Önemli bir duyuru / acil haber bandı
'breaking_news': Kırmızı üst bant + büyük haber metni + alt ticker
```

**Tasarım:**
```
┌─────────────────────────────────────────────────────┐
│  🔴 BREAKING NEWS  ─────────────────────────────── │  ← kırmızı bant, atan animasyon
├─────────────────────────────────────────────────────┤
│                                                     │
│  Büyük Haber Başlığı                                │
│  ─────────────────                                  │
│  Kısa haber özeti metni burada gösterilir.          │
│  Kaynak: CNN Türk · 14:32                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│  📢  Alt Ticker mesajları kayıyor...               │  ← klasik ticker bant
└─────────────────────────────────────────────────────┘
```

LayoutManager'a `breaking_news` eklenir:
```typescript
export type LayoutType = ... | 'breaking_news';
```

---

## 3.4 Yeni Layout: `event_countdown` — Geri Sayım

```typescript
// Kullanım: Konser, etkinlik, promosyon bitiş tarihi
'event_countdown': Büyük geri sayım + etkinlik adı + arka plan görseli
```

**Tasarım:**
```
┌─────────────────────────────────────────────────────┐
│  [Arka plan görseli + koyu overlay]                 │
│                                                     │
│           YAZ FESTİVALİ'NE                         │
│                                                     │
│     02        14        33        07                │
│   GÜND       SAAT      DAK      SANİYE             │
│                                                     │
│         📅 25 Haziran 2026                          │
└─────────────────────────────────────────────────────┘
```

**Ayarlar (publish veya settings'den):**
```typescript
countdownTarget: string; // ISO date "2026-06-25T20:00:00"
countdownTitle: string;  // "Yaz Festivali'ne"
countdownBgUrl: string;  // Arka plan görseli
```

---

## 3.5 Yeni Layout: `split_scoreboard` — Çift Skorbord

```typescript
// Kullanım: Spor barı / kafede skorları göster
'split_scoreboard': Sol panel skor tablosu + sağ panel sosyal feed
```

**Tasarım:**
```
┌───────────────────┬─────────────────────────┐
│  MAÇLAR           │   Sosyal Feed           │
│  ─────────────    │                         │
│  Bayern  3-1  BVB │  @kullanici             │
│  Chelsea 2-0  MCI │  İçerik metni burada    │
│  GS      1-1  FB  │  ❤️ 234  💬 45          │
│  BJK     2-3  TS  │                         │
│                   │  @kullanici2            │
│  [Canlı]  14:32   │  ...                   │
└───────────────────┴─────────────────────────┘
```

Skor verileri: Ticker API veya manuel giriş (publish sayfasından)

---

## 3.6 Widget Yükseltmeleri

### ClockWidget — Premium Saat
```typescript
// Mevcut: sadece saat gösterimi
// Yeni: saniye çizgisi animasyonu + tarih + namaz vakitleri (opsiyonel)
interface ClockWidgetProps {
  showSeconds?: boolean;
  showDate?: boolean;
  showPrayerTimes?: boolean; // Türkiye namaz vakitleri API
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: 'digital' | 'minimal' | 'bold';
}
```

### WeatherWidget — Gelişmiş Hava Durumu
```typescript
// Mevcut: İkon + sıcaklık + şehir
// Yeni: 3 günlük tahmin + hissedilen sıcaklık + nem + rüzgar
interface WeatherWidgetProps {
  compact?: boolean; // header bar için küçük mod
  showForecast?: boolean; // 3 günlük tahmin
  showDetails?: boolean;  // nem, rüzgar, hissedilen
}
```

Hava API'si: `wttr.in/{city}?format=j1` (ücretsiz, API key gerektirmez)

### MarketWidget — Gerçek Zamanlı
```typescript
// Mevcut: Anlık veriler, yenilenmiyor
// Yeni: 30s interval ile auto-refresh + mini sparkline her kur için
// Değişim oranı renk kodlaması: yeşil/kırmızı animasyonlu flash
```

### NewsTicker — Gelişmiş Haber Bandı
```typescript
// Mevcut: Statik ticker
// Yeni: Emoji render + renk kodlaması + pause on hover
// Önceliğe göre sıralama (priority: 10 olanlar öne)
```

### QRWidget — Dinamik QR
```typescript
// Mevcut: Statik URL
// Yeni: URL ve label değiştirilebilir, renk özelleştirilebilir
// Boyut: widget alanına göre otomatik scale
```

---

## 3.7 Layout Geçiş Animasyonları

**Şu an:** AnimatePresence ile basit opacity geçişi

**Hedef:** Her layout değişimine özgü sinematik geçiş
```typescript
const LAYOUT_TRANSITIONS: Record<LayoutType, Variants> = {
  markets: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  },
  breaking_news: {
    initial: { scaleY: 0, originY: 0 },
    animate: { scaleY: 1, transition: { duration: 0.4, ease: 'backOut' } },
    exit: { opacity: 0 },
  },
  ambient: {
    initial: { opacity: 0, filter: 'blur(20px)' },
    animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 1.2 } },
    exit: { opacity: 0, filter: 'blur(20px)' },
  },
  // ... diğerleri
};
```

---

## 3.8 Publish Sayfası Geliştirmeleri

### Şu anki durum: Mission Control (1064 satır) — güçlü temel

### Eklenecekler:

#### Broadcast Geçmişi Paneli
```typescript
// Sayfanın altında: "Son 10 komut" log
<BroadcastHistory commands={recentCommands} />
// Her satır: zaman · komut · hedef ekran · durum
```

#### Ekran Önizleme Miniatür
```typescript
// Ekran kartının üzerine hover edince:
// Mini iframe veya screenshot önizleme
// (remote screenshot Faz 5'e bırakıldı, şimdilik layout adı badge)
```

#### Countdown Layout Widget
```typescript
// "Geri sayım" sekmesi eklenir:
// Hedef tarih + başlık + arka plan → doğrudan seçili ekranlara gönder
<CountdownBroadcastForm onSubmit={sendCountdown} />
```

#### Grup Yönetimi
```typescript
// "Ekran Grubu Seç" dropdown
// Mevcut: ekranları tek tek seç
// Yeni: "Tüm Barlar" / "Restoran" / "Giriş" gibi gruplara gönder
```

---

## 3.9 Screens Sayfası Yükseltmeleri

### A. Ekran Durumu Gerçek Zamanlı
```typescript
// Her 15s API poll veya Firestore listener ile canlı güncelle
// Kartlarda animasyonlu online/offline geçişi (ring pulse)
```

### B. Ekran Kartı Yeni Alanlar
```typescript
// Şu an: online/offline + layout + gruppe
// Yeni:
interface ScreenCardExtra {
  layout: LayoutType;
  currentContent: string;   // "YouTube: Yaz Mix" / "Instagram Feed"
  uptime24h: number;        // son 24 saatte % uptime
  lastCommand: string;      // son gönderilen komut
  resolution?: string;      // "1920x1080" (ekran kendini raporlar)
}
```

### C. Toplu Ön Ayarlar
```typescript
// "Sabah Modu", "Akşam Modu", "Hafta Sonu" gibi preset yükleme
interface ScreenPreset {
  name: string;
  layout: LayoutType;
  commands: BroadcastCommand[];
}
```

---

## Faz 3 Uygulama Sırası

```
1. LayoutManager'a breaking_news + event_countdown + split_scoreboard ekle
2. ClockWidget, WeatherWidget, MarketWidget geliştir
3. ambient, promo, news_focus layout iyileştirmeleri
4. Layout geçiş animasyonları
5. AIHighlight carousel
6. social_wall boş hücre fix
7. Publish sayfasına Broadcast History + Countdown widget
8. Screens sayfasına real-time poll + ekstra kart bilgileri
```

## Etkilenen Dosyalar

```
components/display/LayoutManager.tsx     ← 3 yeni layout + iyileştirmeler
components/display/ClockWidget.tsx       ← GÜNCELLEME
components/display/WeatherWidget.tsx     ← GÜNCELLEME
components/display/MarketWidget.tsx      ← auto-refresh
components/display/NewsTicker.tsx        ← öncelik sıralama
components/display/AIHighlight.tsx       ← carousel
components/display/MainScreen.tsx        ← countdown state
app/(admin)/admin/publish/page.tsx       ← broadcast log + countdown
app/(admin)/admin/screens/page.tsx       ← real-time + preset
```
