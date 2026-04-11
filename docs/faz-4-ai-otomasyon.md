# Faz 4 — AI & Otomasyon

> Süre: ~1 hafta  
> Öncelik: ORTA-YÜKSEK  
> Etki: Editörlerin dakikalar içinde yapabileceği işleri otomatikleştirir

---

## 4.1 AI Studio — Pro Seviye

### Şu Anki Durum
- Temel Gemini sohbeti
- Sistema context (reklam sayısı, içerik sayısı)
- Basit prompt girişi
- API key uyarısı

### Yeni Özellikler

#### A. Multi-Modal: Görsel Analizi
```typescript
// Kullanıcı bir görsel yükler veya URL girer
// Gemini Vision API ile analiz
interface ImageAnalysisRequest {
  imageUrl?: string;
  imageBase64?: string;
  prompt: string; // "Bu resim için reklam metni yaz"
}

// /api/ai/analyze/vision endpoint (yeni)
const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
const result = await model.generateContent([
  { inlineData: { mimeType: 'image/jpeg', data: base64 } },
  prompt,
]);
```

UI: Chat kutusuna görsel sürükle-bırak, önizleme göster, sonra gönder

#### B. Şablon Kütüphanesi
```typescript
// 20+ hazır prompt şablonu, kullanıcı seçer
const AI_TEMPLATES = [
  {
    category: 'Reklam',
    label: 'Hafta Sonu Promosyonu',
    prompt: 'Restoran için hafta sonu özel menü promosyonu yaz. Sıcak ve davetkar ton. Max 30 kelime başlık, 60 kelime açıklama.',
  },
  {
    category: 'İçerik',
    label: 'Etkinlik Duyurusu',
    prompt: 'Canlı müzik etkinliği için sosyal medya duyurusu yaz. Emoji kullan, heyecan yaratıcı.',
  },
  {
    category: 'Ticker',
    label: 'Günün Menüsü',
    prompt: 'Bugünün özel menüsü için kısa haber bandı mesajı yaz. Max 80 karakter.',
  },
  // ... daha fazla
];
```

UI: Sol panel'de kategorilere göre şablon listesi, tıklayınca chat'e yükler

#### C. Toplu İçerik Üretimi
```typescript
// "5 farklı reklam başlığı üret" modü
<BatchGenerateModal>
  <input placeholder="Ürün/hizmet açıklaması..." />
  <select>
    <option>5 reklam başlığı</option>
    <option>3 Instagram caption</option>
    <option>10 ticker mesajı</option>
  </select>
  <button>Üret</button>
</BatchGenerateModal>
// Sonuçlar liste halinde gösterilir, her biri tek tıkla ads/ticker'a eklenebilir
```

#### D. Chat Geçmişi
```typescript
// Firestore 'ai_sessions' collection'a kaydet
interface AISession {
  id: string;
  title: string;         // ilk mesajdan otomatik üretilir
  messages: AIChatMessage[];
  createdAt: Timestamp;
}
// Sol sidebar: son 10 sohbet, tıklanınca yüklenir
```

#### E. İçerik → Reklama Dönüştür
```typescript
// Content sayfasından direkt "AI ile Reklama Çevir" butonu
// Seçilen içerik AI'ya gönderilir, bir reklam draft'ı oluşturulur
// Kullanıcı onaylarsa direkt ads tablosuna eklenir
```

---

## 4.2 İçerik Skor & Öneri Motoru

### A. Otomatik Öneri Sistemi
```typescript
// Her gece (veya istek üzerine) çalışır
// Düşük performanslı içerikleri tespit et
// AI önerisi üret

interface ContentSuggestion {
  contentId: string;
  type: 'improve' | 'retire' | 'highlight' | 'reschedule';
  reason: string;       // "Bu içerik 7 gündür hiç gösterilmedi"
  action: string;       // "İçeriği pasife al"
  confidence: number;   // 0-1
}
```

UI: Analytics → İçerik tabında "AI Önerileri" paneli

### B. Trend Tespiti
```typescript
// Son 48 saatte en çok engagement alan içerikler
// "Trend: Bu 3 içerik bugün çok ilgi gördü 🔥"
// Dashboard'da göster
```

### C. Otomatik Moderasyon (Gelişmiş)
```typescript
// Şu an: toggle ile açık/kapalı
// Yeni: Moderasyon seviyesi
enum ModerationLevel {
  OFF = 0,
  BASIC = 1,     // sadece spam filtresi
  STANDARD = 2,  // negatif sentiment reddet
  STRICT = 3,    // custom keywords blacklist + negatif sentiment
}

// Blacklist keyword'ler settings'ten ayarlanabilir
```

---

## 4.3 Schedule AI — Yayın Takvimi Optimizasyonu

### A. Prime Time Önerisi
```typescript
// Analytics verisinden "en iyi yayın saatleri" çıkar
// Schedule oluştururken göster:
// "📈 Önerilir: 19:00-22:00 arası en yüksek izlenme"
interface PrimeTimeSlot {
  hour: number;
  score: number;   // 0-100
  label: string;   // "Akşam Üstü"
}
```

### B. Çakışma Çözümü
```typescript
// Şu an: çakışma tespiti var, çözüm önerisi yok
// Yeni: AI çakışan eventleri analiz eder, yeniden düzenleme önerir
// "15:00'de 2 event çakışıyor. Birini 15:30'a taşıyabilirsiniz."
```

### C. Otomatik Template
```typescript
// "Haftalık Program Oluştur" butonu
// Kafe/bar için hazır haftalık yayın şablonu:
// Sabah: ambient / haber
// Öğle: sosyal içerik + market
// Akşam: youtube + instagram + reklam ağırlıklı
// Gece: ambient / müzik
```

---

## 4.4 Instagram API Çözümü

### Seçenek A: Meta Graph API (Uzun Vadeli Doğru Çözüm)

**Gereksinimler:**
- Meta Business hesabı
- Instagram Professional hesabı
- Meta App oluşturma (developers.facebook.com)
- `instagram_basic` ve `instagram_content_publish` permissions

**Akış:**
```typescript
// 1. OAuth: kullanıcı Meta'ya login
// 2. Access token al (60 gün geçerli, refresh edilebilir)
// 3. GET https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&access_token={token}
```

**Admin sayfası değişikliği:**
```typescript
// instagram/page.tsx'ye "Bağlı Hesap" bölümü ekle
// Token süresi dolmak üzereyse uyarı göster
<InstagramAccountConnect
  accessToken={settings.instagramToken}
  tokenExpiry={settings.instagramTokenExpiry}
  onRefresh={handleTokenRefresh}
/>
```

### Seçenek B: Manuel Kütüphane (Kısa Vadeli Hızlı Çözüm)

**Mevcut Instagram sayfasını curation aracına çevir:**
- Fetch özelliğini kaldır veya gizle
- "Manuel Ekle" arayüzü güçlendir: URL + caption + engagement sayıları
- Toplu import: JSON formatı
- Zamanlanmış görüntüleme

**→ Şimdilik Seçenek B ile devam, API key gelince Seçenek A'ya geç**

---

## 4.5 YouTube API Entegrasyonu

### A. Kanal Auto-Import
```typescript
// YouTube Data API v3
// GET /youtube/v3/search?channelId={id}&order=date&maxResults=10
// Yeni videoları otomatik çek ve kütüphaneye ekle
```

**Settings sayfası:**
```typescript
// "YouTube Kanalları" bölümü
// Her kanal için: kanal ID + auto-import toggle + son import tarihi
```

### B. Live Stream Otomatik Tespiti
```typescript
// Kanal canlı yayına geçince otomatik algıla
// Push notification veya dashboard uyarısı
// Tek tıkla "Tüm ekranlara yayınla"
```

---

## 4.6 Yeni API Endpointleri

| Endpoint | Method | Amaç |
|----------|--------|------|
| `/api/ai/vision` | POST | Görsel analizi (Gemini Vision) |
| `/api/ai/batch-generate` | POST | Toplu içerik üretimi |
| `/api/ai/sessions` | GET/POST | Chat geçmişi yönetimi |
| `/api/ai/suggestions` | GET | İçerik önerileri |
| `/api/youtube/import` | POST | Kanal auto-import |

---

## Faz 4 Uygulama Sırası

```
1. AI Studio — şablon kütüphanesi
2. AI Studio — toplu üretim modal
3. AI Studio — chat geçmişi
4. İçerik skor + öneri sistemi
5. Otomatik moderasyon seviyesi
6. Instagram manual curation güçlendirme
7. /api/ai/vision endpoint
8. Schedule AI — prime time öneri
```

## Etkilenen Dosyalar

```
app/(admin)/admin/ai-studio/page.tsx     ← TAM YENİDEN YAZ
app/(admin)/admin/instagram/page.tsx     ← Fetch kaldır, curation güçlendir
app/(admin)/admin/schedule/page.tsx      ← Prime time öneri eklentisi
app/api/ai/vision/route.ts               ← YENİ
app/api/ai/batch-generate/route.ts       ← YENİ
app/api/ai/sessions/route.ts             ← YENİ
lib/ai-engine.ts                         ← vision + batch fonksiyonları
```
