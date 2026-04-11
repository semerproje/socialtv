# Social Lounge TV — Sorun Tespiti & Çözüm Planı

> Tarih: 11 Nisan 2026  
> Ortam: Firebase App Hosting · europe-west4 · Cloud Run  
> URL: https://socialtv--social-web-tv.europe-west4.hosted.app

---

## 1. KRİTİK SORUNLAR (Üretim Ortamını Kırıyor)

### 1.1 `NEXT_PUBLIC_APP_URL` Tanımsız → `/api/display` Production'da Localhost'a Bağlanıyor
**Dosya:** `app/api/display/route.ts` satır 37, 47  
**Sorun:** `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'` — Bu env değişkeni `apphosting.yaml`'a eklenmemiş. Production'da `/api/markets` ve `/api/news` çağrıları `http://localhost:3000/...` adresine yapılıyor → yanıt gelmiyor → yayın ekranında piyasa/haber verisi gösterilmiyor.  
**Etki:** Tüm DisplayLayout'larda markets, news verisi boş.  
**Düzeltme:** `apphosting.yaml`'a `NEXT_PUBLIC_APP_URL: https://socialtv--social-web-tv.europe-west4.hosted.app` ekle.

---

### 1.2 `lib/ai-engine.ts` + `app/api/ai/chat/route.ts` → Prisma Kullanıyor
**Dosyalar:** `lib/ai-engine.ts` satır 2, `app/api/ai/chat/route.ts` satır 3  
**Sorun:** Her iki dosya da `@/lib/prisma` (SQLite/PrismaClient) import ediyor. Production'da `DATABASE_URL` yok, Prisma konneksiyon hatası veriyor.  
- `lib/ai-engine.ts`: `logAIRequest()` fonksiyonu `prisma.aIRequest.create()` çağırıyor — bu collection `db.ts`'de **hiç yok**.
- `app/api/ai/chat/route.ts`: context bilgisi için `prisma.advertisement.count()`, `prisma.content.count()`, `prisma.advertisement.findMany()` kullanıyor.  
**Etki:** `/api/ai/chat`, `/api/ai/analyze`, `/api/ai/generate` endpointleri production'da 500 hatası veriyor.  
**Düzeltme:** Prisma çağrılarını `db.*` (Firestore) ile değiştir; `aIRequest` ya silinmeli ya da Firestore'a `ai_requests` collection'ı eklenmeli.

---

### 1.3 `sseRef` Dead Code — MainScreen'de Gereksiz Import ve Ref
**Dosya:** `components/display/MainScreen.tsx` satır 45  
**Sorun:** SSE kaldırıldı ama `sseRef = useRef<EventSource | null>(null)` hâlâ kodda. TypeScript hata vermez ama anlamsız memory tutulur; daha önemlisi `import { db } from '@/lib/firebase'` ile `onSnapshot` var, `EventSource` import'u kaldırılmamış olabilir.  
**Etki:** Düşük — sadece temizlik sorunu.

---

## 2. YÜKSEK ÖNCELİK (Önemli Fonksiyonlar Bozuk)

### 2.1 Instagram Scraping API Kırık
**Dosya:** `app/api/instagram/fetch/route.ts`  
**Sorun:** `axios.get('https://www.instagram.com/api/v1/users/web_profile_info/...')` çağrısı yapıyor. Instagram bu endpoint'i 2024 sonuna kadar kapattı; `403 / redirect` dönüyor. Resmi API (Meta Graph API) kullanılmıyor, `INSTAGRAM_ACCESS_TOKEN` env değişkeni yok.  
**Etki:** Instagram içerik çekme tamamen çalışmıyor. Manuel içerik ekleme işe yarıyor ama otomatik çekme yok.  
**Düzeltme:** Meta Business Suite → Instagram Basic Display API veya Instagram Graph API kullanımına geçiş gerekiyor; ya da scraping kaldırılıp sadece manuel ekleme ile devam edilmeli.

### 2.2 `GEMINI_API_KEY` Production'da Placeholder
**Dosya:** `apphosting.yaml` secret `GEMINI_API_KEY`  
**Sorun:** Secret oluşturuldu ama değer `"placeholder-gemini-key"` olarak ayarlandı. Tüm AI özellikleri (`/api/ai/chat`, `/api/ai/analyze`, `/api/ai/generate`) 503 hatası döndürüyor.  
**Etki:** AI Studio, içerik analizi, reklam metin üreteci çalışmıyor.  
**Düzeltme:** https://aistudio.google.com/apikey adresinden gerçek anahtar alınıp `firebase apphosting:secrets:set GEMINI_API_KEY` ile güncellenmeli.

### 2.3 `OPENAI_API_KEY` Placeholder — `lib/openai.ts` Yanlış Anahtar
**Dosya:** `.env.local` satır `OPENAI_API_KEY="sk-your-key-here"`, `apphosting.yaml` secret  
**Sorun:** OpenAI API anahtarı placeholder; `lib/openai.ts` modülü başlatılıyor ama OpenAI üzerinden çağrı varsa hata verir. `app/api/content/route.ts`'de `if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here')` kontrolü var ama production secret değeri kontrol edilmiyor.  
**Etki:** Otomatik içerik analizi devreye girmiyor (zaten Gemini'ye geçildi, OpenAI gereksiz).  
**Düzeltme:** `lib/openai.ts` ve OpenAI import'ları tamamen kaldırılmalı; `apphosting.yaml`'daki `OPENAI_API_KEY` secret silinmeli.

---

## 3. ORTA ÖNCELİK (Eksik veya Hatalı Davranış)

### 3.1 Rate Limiter In-Memory → Multi-Instance'da Çalışmaz
**Dosya:** `lib/rate-limit.ts`  
**Sorun:** `const buckets = new Map<string, Bucket>()` — Node.js process memory'sinde tutuluyor. Cloud Run birden fazla instance çalıştırdığında her instance kendi map'ini tutar; bir kullanıcı limit'i doldursa bile farklı instance'a giderek bypass edebilir.  
**Etki:** Rate limiting etkisiz (saldırılarda korunmasız), ama normal kullanımda sorun yaratmaz.  
**Düzeltme:** `apphosting.yaml`'da `maxInstances: 1` (şu an 2) veya Redis/Firestore tabanlı rate limiter.

### 3.2 Admin Auth Token — Client'ta Firebase Token Yenileme Eksik
**Dosya:** `components/admin/AdminApiAuthBridge.tsx`  
**Sorun:** Firebase ID token'ları 1 saat sonra expire oluyor. Admin sayfalarında uzun süreli oturumda API çağrıları 401 dönmeye başlar. Token yenileme `getIdToken(true)` ile otomatik yapılmıyor olabilir.  
**Etki:** 1+ saat admin oturumunda API çağrıları başarısız oluyor.

### 3.3 Screen Bağlantısı Sadece Mount'ta Yapılıyor
**Dosya:** `components/display/MainScreen.tsx`  
**Sorun:** SSE kaldırıldıktan sonra ekran kaydı için `HEAD /api/sync` isteği sadece component mount'ta bir kez gönderiliyor. Ekranın `lastSeen` değeri hiç güncellenmediğinden admin panelinde tüm ekranlar "çevrimdışı" görünüyor.  
**Etki:** Screens panelinde "0/N aktif ekran" gösteriyor, gerçekte bağlı olmasına rağmen.  
**Düzeltme:** HEAD ping'i interval ile tekrarlanmalı (örn. her 30 saniyede bir).

### 3.4 `docs/` ve `.firebase/` Klasörleri Git'e Commit Ediliyor
**Sorun:** `.firebase/` klasörü (build artifacts, ~35 dosya) ve `docs/` git commit'lerinde gereksiz yer kaplıyor. `.gitignore`'a eklenmemişler.  
**Etki:** Repository boyutu gereksiz büyüyor, her `npm run build` sonrası commit'lerde değişiklik görünüyor.

---

## 4. DÜŞÜK ÖNCELİK (Temizlik / İyileştirme)

| # | Sorun | Dosya |
|---|-------|-------|
| 4.1 | `lib/prisma.ts`, `prisma/schema.prisma`, `prisma/seed.ts` — SQLite artık kullanılmıyor, repo'da gereksiz | `prisma/` |
| 4.2 | `service-account.json` referansı kodda sabit yol: `path.join(process.cwd(), 'service-account.json')` — Environment variable kullanılmalı | `lib/firebase-admin.ts:19` |
| 4.3 | `lib/openai.ts` — Tamamen Gemini'ye geçildi, dosya kullanılmıyor | `lib/openai.ts` |
| 4.4 | `ADMIN_PASSWORD` env değişkeni tanımlı ama admin-auth'ta kullanılmıyor — ölü kod/güvenlik yanılsaması | `.env.local` |
| 4.5 | `apphosting.yaml` secrets `OPENAI_API_KEY` hâlâ tanımlı, silinmeli | `apphosting.yaml` |
| 4.6 | `sseRef` useRef dead code | `MainScreen.tsx:45` |

---

## 5. ÇÖZÜM PLANI

### Sprint 1 — Kritik (Önce Bunlar)

| Adım | İşlem | Dosya |
|------|-------|-------|
| S1-1 | `apphosting.yaml`'a `NEXT_PUBLIC_APP_URL` ekle | `apphosting.yaml` |
| S1-2 | `lib/ai-engine.ts` → `logAIRequest()` içindeki Prisma'yı Firestore `ai_requests` collection'ına taşı | `lib/ai-engine.ts` |
| S1-3 | `app/api/ai/chat/route.ts` → context sorgularını `db.advertisement` ve `db.content`'e geç | `app/api/ai/chat/route.ts` |
| S1-4 | `firebase apphosting:secrets:set GEMINI_API_KEY` ile gerçek anahtar ekle | — |
| S1-5 | Deploy | — |

### Sprint 2 — Yüksek Öncelik

| Adım | İşlem | Dosya |
|------|-------|-------|
| S2-1 | `MainScreen.tsx` → HEAD ping'i 30s interval'a al | `MainScreen.tsx` |
| S2-2 | Dead ref `sseRef` kaldır | `MainScreen.tsx:45` |
| S2-3 | `lib/openai.ts` sil, `OPENAI_API_KEY` secret'ı `apphosting.yaml`'dan kaldır | — |
| S2-4 | `.gitignore`'a `.firebase/` ekle | `.gitignore` |
| S2-5 | `AdminApiAuthBridge.tsx`'de token yenileme `getIdToken(true)` loop'u ekle | `AdminApiAuthBridge.tsx` |

### Sprint 3 — Temizlik

| Adım | İşlem |
|------|-------|
| S3-1 | `prisma/` klasörünü sil (SQLite tamamen kaldırıldı) |
| S3-2 | `lib/prisma.ts` sil |
| S3-3 | `service-account.json` yolu → `FIREBASE_SERVICE_ACCOUNT_JSON` env'den oku |
| S3-4 | Instagram API → scraping kaldır, statik içerik akışıyla devam et veya Meta Graph API geçişini planla |
| S3-5 | Rate limiter → maxInstances=1 kalıcı hale getir veya Firestore-based limiter yaz |

---

## 6. DEPLOYMENT ÇEVRESİ NOTLARI

```
Platform  : Firebase App Hosting (Cloud Run)
Region    : europe-west4
URL       : https://socialtv--social-web-tv.europe-west4.hosted.app
Branch    : main → otomatik deploy (GitHub)
Manuel    : firebase apphosting:rollouts:create socialtv --git-commit <HASH> --force
Firestore : proje: social-web-tv
Auth      : Firebase Authentication (email/password)
Secrets   : firebase apphosting:secrets:set <KEY>
```

### Çalışan Servisler ✅
- Firestore real-time komut kanalı (onSnapshot)
- Firebase Authentication (login)
- Firestore rules deploy
- Admin paneli CRUD (içerik, ekran, reklam, program, ticker)
- Markets API (piyasa verisi) — ama display route'da URL sorunu var
- News API (Google News RSS)
- Weather API (Open-Meteo)

### Çalışmayan / Sorunlu Servisler ❌
- AI özellikler (Gemini key placeholder)
- Instagram otomatik çekme (API kırık)
- Display layout'ta markets/news verisi (NEXT_PUBLIC_APP_URL eksik)
- Admin API'leri 1 saatlik oturumda (token yenileme yok)
- Ekran çevrimiçi durumu (HEAD ping tek seferlik)
