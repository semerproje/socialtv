# Faz 5 — Sektör Liderliği

> Süre: ~2 hafta  
> Öncelik: ORTA  
> Etki: Rakip ürünlerden ayrışan, platformu "product-led" konuma taşıyan özellikler

---

## 5.1 Ekran Grubu Yönetimi

### Problem
Birden fazla ekranı olan mekanlar (zincir kafeler, büyük mekânlar) her ekrana ayrı ayrı komut göndermek zorunda.

### Çözüm: Screen Groups

```typescript
// Firestore: 'screen_groups' collection
interface ScreenGroup {
  id: string;
  name: string;           // "Giriş Katı", "Bar Bölümü", "Açık Alan"
  color: string;          // Etiket rengi
  screenIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Admin sayfasında:**
```
┌─ Ekran Grupları ─────────────────────────────────────────┐
│  🟩 Giriş Katı (3 ekran)  │  🟦 Bar (2 ekran)           │
│  🟧 Restoran (4 ekran)    │  + Yeni Grup Oluştur        │
└──────────────────────────────────────────────────────────┘
```

**Publish sayfasında:**
```typescript
// Hedef seçiminde "Gruba Gönder" eklenir
<TargetSelector>
  <option>Tüm Ekranlar</option>
  <optgroup label="Gruplar">
    <option>Giriş Katı (3)</option>
    <option>Bar (2)</option>
  </optgroup>
  <optgroup label="Bireysel Ekranlar">
    ...
  </optgroup>
</TargetSelector>
```

---

## 5.2 Mobil Admin Paneli

### Problem
Admin paneli masaüstü odaklı. Bar sahibi mobilden hızlı müdahale etmek istiyor.

### Çözüm: Mobile-First Responsive Redesign

**Sidebar → Bottom Tab Bar (mobilde):**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│     Mobile Admin İçerik Alanı                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  📊      🎬      🖥️      📺      ⚙️               │
│ Dash  Yayınla  Ekranlar  TV   Ayarlar              │
└─────────────────────────────────────────────────────┘
```

**Öncelikli mobil sayfalar:**
1. **Dashboard** — özet kartlar, ekran durumu, hızlı broadcast
2. **Publish** — tek ekrana tıkla-gönder
3. **Content** — hızlı onayla/reddet swipe jestleri
4. **Ticker** — hızlı mesaj ekle

**Swipe Jestleri (Content sayfası):**
```typescript
// react-swipeable ile
// Sola kaydır = Reddet (kırmızı arka plan animasyonu)
// Sağa kaydır = Onayla (yeşil arka plan animasyonu)
```

**Bottom Sheet Modal:**
```typescript
// Mobilde formlar dialog yerine bottom sheet'te açılır
// Framer Motion ile yukarı yükselen panel
```

---

## 5.3 Bildirim Sistemi

### Problem
Ekran offline olduğunda, kanal sağlığı bozulduğunda veya önemli bir olay olduğunda hiçbir uyarı gelmiyor.

### Çözüm A: In-App Notification Center

```typescript
// Firestore: 'notifications' collection
interface AppNotification {
  id: string;
  type: 'screen_offline' | 'channel_unhealthy' | 'content_pending' | 'system_error';
  title: string;            // "Ekran A bağlantısı kesildi"
  body: string;
  severity: 'info' | 'warning' | 'error';
  isRead: boolean;
  targetUserId?: string;    // null → tüm opadmins
  createdAt: Timestamp;
  metadata: Record<string, unknown>;
}
```

**Sidebar'a bildirim bell icon:**
```typescript
// Sidebar'da sağ üste: 🔔 (3) — okunmamış bildirim sayısı
// Tıklanınca dropdown panel açılır
<NotificationBell unreadCount={unreadCount}>
  {notifications.map(n => <NotificationItem key={n.id} {...n} />)}
</NotificationBell>
```

**Bildirim Kuralları:**
```typescript
const NOTIFICATION_RULES = {
  // Ekran 5 dakika boyunca ping atmadıysa
  screen_offline: { threshold: 5 * 60_000 },
  
  // Kanal health check 3 ardışık başarısız olursa
  channel_unhealthy: { threshold: 3 },
  
  // 10+ bekleyen içerik varsa
  content_pending: { threshold: 10 },
}
```

**Backend Job (kronjob):**
```typescript
// /api/monitoring/check-alerts (her 5 dakikada bir çağrılır)
// Cloud Scheduler veya firebase cronjob ile
```

### Çözüm B: Email Bildirimleri (Faz 5+)

```typescript
// Firebase Extensions: "Send Email with Nodemailer"
// SMTP config settings'ten alınır
// Özet email: her gün sabah 08:00'de durumu raporla
```

---

## 5.4 White-Label Hazırlığı

### Problem
Platform tek bir müşteri için yazıldı. Birden fazla müşteriye satılabilmesi için white-label özellikler gerekli.

### Tenant Modeli (Basit)

```typescript
// Firestore: 'tenants' collection (gelecek)
// Şimdilik: single-tenant ama brand kit ayarları ile
// Settings'ten her şeyi özelleştirilebilir:
```

**Brand Kit tam kapsamı:**
```typescript
interface BrandKit {
  appName: string;
  tagline: string;
  logoUrl: string;        // Firebase Storage
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;     // "Space Grotesk" | "Inter" | "Roboto" | custom
  splashImageUrl: string; // Display ekranı açılış görseli
  footerText?: string;    // "Powered by Social Lounge TV"
  customCssUrl?: string;  // Gelişmiş özelleştirme için
}
```

**Display ekrana yansıma:**
```typescript
// /api/settings → brandKit alanlarını getir
// HeaderBar, LogoWidget ve tüm branded elementler dinlemik renk/logo kullanır
// CSS variables:
// --brand-primary: ${settings.primaryColor}
// --brand-secondary: ${settings.secondaryColor}
```

---

## 5.5 Sahne / Preset Sistemi (Scene System)

### Problem
"Sabah açılışı", "Happy Hour", "Konser gecesi" için her seferinde aynı ayarları manuel yapmak zorunda.

### Çözüm: Scene Presets

```typescript
// Firestore: 'scenes' collection
interface Scene {
  id: string;
  name: string;            // "Happy Hour"
  icon: string;            // "🍸"
  color: string;
  layout: LayoutType;
  ticker: { active: boolean; priority?: number };  // belirli ticker ID'leri
  ads: { mode: 'normal' | 'heavy' | 'off' };       // reklam yoğunluğu
  youtubePlaylistId?: string;    // oynatılacak playlist
  broadcastToGroups: string[];   // hangi gruplara uygulansın
  createdAt: Timestamp;
}
```

**Publish sayfasında Scene Butonu:**
```
┌─ SAHNELER ─────────────────────────────────────────┐
│  🌅 Sabah Modu    🍸 Happy Hour    🎵 Konser       │
│  🌙 Gece Modu     📺 Maç Akşamı    + Yeni Sahne   │
└────────────────────────────────────────────────────┘
```
- Tek tıkla sahne aktif edilir
- Sahne: layout + playlist + ticker + reklam modunu set eder
- "Aktif Sahne" badge gösterilir

---

## 5.6 Medya Kütüphanesi Gelişmiş

### Şu Anki Eksikler
- Arama / filtreleme yok
- Klasör yapısı yok
- Metadata yönetimi yok
- Toplu silme yok

### Yeni Özellikler

#### A. Klasör Yapısı
```typescript
// Firebase Storage: /media/{klasör}/{dosya}
// Admin'de: "Yeni Klasör" butonu, klasörler sol panel
interface MediaFolder {
  path: string;           // "reklamlar/2026-nisan"
  name: string;           // "Nisan 2026"
  fileCount: number;
}
```

#### B. Arama & Filtre
```typescript
// Dosya adına göre arama
// Türe göre: Resim / Video / Hepsi
// Tarihe göre sıralama
```

#### C. Metadata Yönetimi
```typescript
// Firebase Storage custom metadata
interface MediaMetadata {
  title: string;
  tags: string[];
  uploadedBy: string;
  usedInAds: string[];    // hangi reklamlarda kullanıldığı
  usedInContent: string[];
}
```

#### D. Toplu İşlemler
```typescript
// Multi-select + toplu sil / taşı
// "Kullanılmayan medyaları bul" analizi
```

---

## 5.7 Gelişmiş Yayın Takvimi

### Şu Anki Eksikler
- Drag-to-resize event yok
- Template olmadan her şey manuel
- Multi-screen targeting yok

### Yeni Özellikler

#### A. Drag-to-Resize
```typescript
// react-beautiful-dnd veya @dnd-kit/core
// Event kutularını sürükle-bırak ile yeniden konumlandır
// Alt kenardan sürükleyerek süreyi değiştir
```

#### B. Haftalık Program Şablonu
```typescript
interface WeeklyTemplate {
  id: string;
  name: string;             // "Standart Haftalık Program"
  slots: {
    day: number;            // 0=Pazar...6=Cumartesi
    startHour: number;
    endHour: number;
    event: Partial<ScheduleEvent>;
  }[];
}
// "Şablonu Uygula" → template'deki tüm eventleri bu haftaya ekle
```

#### C. Event Kopyalama
```typescript
// Event'e sağ tık → "Haftaya Kopyala" / "Tekrar Et"
// Shift+tıkla → çoklu seçim
```

---

## 5.8 TV Monitoring İyileştirme

### Yeni Özellikler

#### A. Otomatik Health Check Schedule
```typescript
// Şu an: manuel "Kontrol Et" butonu
// Yeni: Her 15 dakikada otomatik kontrol (Cloud Scheduler)
// Settings'ten interval ayarlanabilir: 5 / 15 / 30 / 60 dakika
```

#### B. Otomatik Failover
```typescript
// Birincil kanal unreachable → backup kanala geç
interface LiveChannel {
  // ... mevcut alanlar
  backupChannelId?: string;  // yedek kanal ID
  autoFailover: boolean;
}
// channel-health.ts: kanal unreachable tespit edilirse broadcast komutu gönder
```

#### C. EPG (Electronic Program Guide)
```typescript
// Kanallar için günlük program girişi
interface EPGEntry {
  channelId: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
}
// Display ekranda TV layoutunda EPG gösterilir
```

---

## 5.9 Kullanıcı Yönetimi

### Şu Anki Durum
- `ADMIN_OPS_EMAILS` env değişkeni ile tanımlı
- Roller: viewer, editor, ops
- Yeni kullanıcı eklemek için env değiştirip deploy gerekiyor

### Yeni Kullanıcı Yönetim Sayfası

```typescript
// /admin/users (ops only)
// Firebase Auth kullanıcılarını listele
// Custom claims ile rol ata
interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  lastLogin: string;
  createdAt: string;
}
```

**Sayfa özellikleri:**
- Kullanıcı davet et (email ile link gönder)
- Rol değiştir (dropdown)
- Kullanıcıyı deaktive et
- Son giriş zamanı

---

## Faz 5 Uygulama Sırası

```
1. Screen Groups (Firestore model + API + UI)
2. Scene / Preset sistemi
3. Bildirim merkezi (in-app)
4. Sidebar responsive + bottom tab bar (mobil)
5. Content sayfası swipe jestleri
6. Media kütüphanesi — arama + klasör
7. Kullanıcı yönetim sayfası
8. TV auto-failover
9. Brand Kit tam kapsamı
10. Haftalık schedule şablonları
```

## Yeni Sayfalar / Dosyalar

```
app/(admin)/admin/users/page.tsx         ← YENİ (ops only)
app/api/notifications/route.ts           ← YENİ
app/api/monitoring/check-alerts/route.ts ← YENİ
app/api/scenes/route.ts                  ← YENİ
app/api/screen-groups/route.ts           ← YENİ
components/admin/NotificationBell.tsx    ← YENİ
components/admin/SceneSelector.tsx       ← YENİ
components/admin/BottomTabBar.tsx        ← YENİ (mobil)
app/(admin)/admin/ticker/page.tsx        ← schedule eklentisi
app/(admin)/admin/tv/page.tsx            ← failover + EPG
```
