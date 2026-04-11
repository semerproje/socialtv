# Faz 2 — Analytics Merkezi

> Süre: ~1 hafta  
> Öncelik: YÜKSEK  
> Etki: Reklam ve içerik ROI görünürlüğü

---

## Neden Kritik?

Mevcut analytics sayfası temel KPI + tek grafik. Bir dijital tabela platformunun "sektör zirvesi"nde olması için:
- Her ekranın performansını ayrı ayrı görmek gerekir
- Reklamların gerçek dönüşüm oranı hesaplanmalı
- İçeriğin hangi saatte daha çok izlendiği bilinmeli
- Yöneticiler **PDF rapor** alabilmeli

---

## 2.1 Analytics Sayfası Yeniden Tasarımı

### Yeni Tab Yapısı

```
[ Genel Bakış ] [ Ekran Bazlı ] [ Reklamlar ] [ İçerik ] [ Dışa Aktar ]
```

### Tab 1: Genel Bakış

#### KPI Kartları (Sparkline ile)
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Gösterim │ │Tamamlanma│ │İçer Görüm│ │QR Tarama │ │Yayın Süre│
│  14,582  │ │  11,034  │ │   8,291  │ │    47    │ │  42.3 sa │
│ +12% ↑   │ │  +8% ↑   │ │  -3% ↓   │ │  +24% ↑  │ │  +6% ↑   │
│ ~~~~~~~~~│ │  ~~~~~   │ │ ~~~~     │ │ ~~       │ │ ~~~~~~~~ │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Her kart için:
- 7 günlük sparkline (küçük Recharts LineChart, alan dolgusu ile)
- Önceki döneme göre % değişim + ok işareti
- Tıklanınca ilgili tab'a git

#### Kompozit Grafik
```typescript
// ComposedChart: Bar (gösterim) + Line (tamamlanma oranı %)
<ComposedChart>
  <Bar dataKey="impressions" fill="#6366f1" />
  <Line dataKey="completionRate" stroke="#10b981" dot={false} />
</ComposedChart>
```

#### Prime Time Haritası (Heatmap)
```
Saatler →  00 01 02 ... 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23
Pazartesi  ░░ ░░ ░░ ... ▒▒ ▒▒ ██ ██ ▒▒ ▒▒ ▒▒ ▒▒ ██ ██ ██ ██ ██ ██ ▒▒
Salı       ...
```
- Her hücre: o saatteki gösterim yoğunluğu
- Koyu = yoğun, açık = az
- CSS grid ile saf implementation (recharts değil)
- Kullanıcı "hangi saatte ne kadar yayın yapıldı" görebilir

#### Funnel Görselleştirme
```
Gösterim    14,582  ━━━━━━━━━━━━━━━━━━━━ 100%
  │
  ▼
Tamamlanma  11,034  ━━━━━━━━━━━━━━━  75.7%
  │
  ▼
QR Tarama       47  ━  0.3%
```

---

### Tab 2: Ekran Bazlı Analytics

```typescript
interface ScreenAnalytics {
  screenId: string;
  screenName: string;
  totalUptime: number;         // dakika, son 7 gün
  uptimePercent: number;       // %
  impressionCount: number;
  contentViewCount: number;
  layoutBreakdown: Record<LayoutType, number>; // kaç dakika hangi layout
  lastOnline: string;
}
```

**Her ekran için kart:**
```
┌─ Ekran A (Bar) ─────────────────────────────────┐
│ 🟢 Online · Son görülme: 2 dk önce              │
│ Uptime: ████████████░░ 87% (son 7 gün)         │
│ Layout dağılımı: Default 45% · Markets 30% ...  │
│ Gösterim: 2,341 · İçerik: 891                  │
│ [Detay] [Komut Gönder]                          │
└─────────────────────────────────────────────────┘
```

**Layout dağılımı donut chart:**
```typescript
// Her ekran için küçük PieChart
<PieChart width={120} height={120}>
  <Pie data={layoutBreakdown} innerRadius={30} outerRadius={55} />
</PieChart>
```

---

### Tab 3: Reklam Performansı

**Tablo görünümü:**
```
Reklam            | Gösterim | Tamamlanma |  CR%  | Süre T. | Zaman
─────────────────────────────────────────────────────────────────
Yaz İndirimi      |   1,247  |    1,024   | 82.1% |  3.2 sa | Sabah
Restoran Özel     |     892  |      701   | 78.6% |  2.1 sa | Akşam
VIP Üyelik        |     445  |      234   | 52.6% |  1.1 sa | Tüm gün
```

**Sütun açıklamaları:**
- `CR%` = Completion Rate (tamamlanma oranı)
- `Süre T.` = Toplam oynatma süresi

**Her reklamın mini trend grafiği:**
- Son 7 gün sparkline
- En iyi performans saati badge

**Performans Uyarıları:**
```
⚠️  "VIP Üyelik" reklamı CR% 52.6 ile ortalamanın (%72) çok altında.
    Öneri: Reklam süresini kısalt veya içeriği yenile.

💡  "Yaz İndirimi" en iyi performansı 14:00-16:00 arasında gösteriyor.
    Öneri: Bu saate odaklanmak için zamanlama ekle.
```

---

### Tab 4: İçerik Performansı

```typescript
interface ContentAnalytics {
  contentId: string;
  author: string;
  platform: string;
  viewCount: number;
  engagementScore: number;   // hesaplanmış skor (likes+comments*2)
  aiSentiment: string;
  peakHour: number;          // en çok izlendiği saat
  approvedAt: string;
}
```

**Platform dağılımı:**
```
Instagram  ████████░░  43%  (127 içerik)
Custom     █████░░░░░  28%  (83 içerik)
Twitter    ███░░░░░░░  17%  (51 içerik)
TikTok     ██░░░░░░░░  12%  (35 içerik)
```

**Duygu analizi özeti:**
```
Pozitif  ████████  68%
Nötr     ███       22%
Negatif  █         10%
```

---

### Tab 5: Dışa Aktar

#### CSV Export
```typescript
// Her tab'ın verisi ayrı CSV olarak indirilebilir
function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  const blob = new Blob([headers, '\n', rows.join('\n')], { type: 'text/csv' });
  // download...
}
```

#### PDF Rapor
```typescript
// @react-pdf/renderer ile haftalık özet raporu
// Kapak sayfa: Logo + tarih aralığı
// Sayfa 2: KPI özeti
// Sayfa 3: Reklam performans tablosu
// Sayfa 4: Ekran durumu
```

#### Otomatik Rapor (Faz 5 ile)
- Her Pazartesi sabahı haftalık rapor email

---

## 2.2 Dashboard'a Analytics Entegrasyonu

- Dashboard'daki grafik `/api/analytics`'i **gerçek zamanlı** poll eder (30s)
- KPI kartları mevcut hafta ↔ önceki hafta karşılaştırması yapar

---

## 2.3 Yeni API: `/api/analytics/screens`

```typescript
// GET /api/analytics/screens?days=7
// Her ekran için uptime, impression, layout breakdown döner
export async function GET(req: NextRequest) {
  const screens = await db.screen.findMany();
  const since = new Date(Date.now() - days * 86400_000);
  
  const events = await db.analyticsEvent.findMany({
    where: { createdAt: { gte: since } }
  });
  
  // screenId bazlı group + aggregate
  return NextResponse.json({ success: true, data: aggregated });
}
```

---

## Faz 2 Uygulama Sırası

```
1. /api/analytics refactor → screens bazlı data ekle
2. Analytics sayfası Tab yapısına geç
3. KPI kartlarına sparkline ekle
4. Prime time heatmap implement
5. Funnel görselleştirme
6. Ekran bazlı tab + ScreenAnalytics arayüzü
7. Reklam performans tablosu + öneriler
8. CSV export
```

## Etkilenen Dosyalar

```
app/(admin)/admin/analytics/page.tsx    ← TAM YENİDEN YAZ
app/api/analytics/route.ts              ← Ekran bazlı veri ekle
app/api/analytics/screens/route.ts      ← YENİ endpoint
```
