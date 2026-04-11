# Social Lounge TV — Sektör Zirvesi Geliştirme Planı

> Versiyon: 2.0  
> Tarih: 11 Nisan 2026  
> Hedef: Dijital tabela / sosyal TV platformu sektörünün en iyi uygulaması

---

## Mevcut Durum Özeti

| Katman | Durum | Not |
|--------|-------|-----|
| Altyapı | ✅ Stabil | Firebase App Hosting, Firestore, Next.js 16 |
| Deploy | ✅ Çalışıyor | f40cf5e canlıda |
| Ekran yayını | ✅ Çalışıyor | Firestore onSnapshot, HEAD ping 30s |
| AI Motor | ✅ Gemini 2.0 | logAIRequest Firestore'a yazıyor |
| Admin Auth | ✅ Çalışıyor | sa@socialtv.com ops yetkili |
| Prisma | ✅ Temizlendi | Artık sadece Firestore |
| Instagram API | ❌ Kırık | Meta endpoint kapandı |
| Gemini Key | ⚠️ Placeholder | Üretimde AI çalışmıyor |
| Analytics | ⚠️ Temel | Grafik var, derinlik yok |
| Admin UX | ⚠️ Orta | Bazı sayfalar taslak düzeyi |

---

## Faz Haritası

```
FAZ 1 — Temel Güçlendirme          (1-2 hafta)
  Dashboard 2.0 · Ads Gelişimi · Content Zekası · Settings Pro

FAZ 2 — Analytics Merkezi          (1 hafta)
  Ekran Bazlı · Reklam KPI · Funnel · Export

FAZ 3 — Display & Yayın Sistemi    (1-2 hafta)
  Yeni Layoutlar · Geçişler · Widget Yükseltme

FAZ 4 — AI & Otomasyon             (1 hafta)
  AI Studio Pro · İçerik Skoru · Tahmin Motoru

FAZ 5 — Sektör Liderliği           (2 hafta)
  Guruplama · Mobil Admin · Bildirimler · White-label
```

---

## Faz Dosyaları

| Dosya | İçerik |
|-------|--------|
| [`faz-1-temel-guclendir.md`](faz-1-temel-guclendir.md) | Dashboard 2.0, Ads Pro, Content Intelligence, Settings Pro |
| [`faz-2-analitik-merkezi.md`](faz-2-analitik-merkezi.md) | Derin analitik, ekran bazlı, funnel, export |
| [`faz-3-ekran-ve-yayin.md`](faz-3-ekran-ve-yayin.md) | Yeni layoutlar, widget yükseltme, geçiş animasyonları |
| [`faz-4-ai-otomasyon.md`](faz-4-ai-otomasyon.md) | AI Studio Pro, içerik skoru, schedule AI |
| [`faz-5-sektor-liderligi.md`](faz-5-sektor-liderligi.md) | Ekran grupları, mobil admin, bildirimler, white-label |

---

## Her Fazın Kısa Özeti

| Faz | Başlık | Ne Kazandırır | Dosya |
|-----|--------|---------------|-------|
| **1** | Temel Güçlendirme | Dashboard real-time, Ads zaman hedefleme, Content skor, Settings logo upload | [faz-1](faz-1-temel-guclendir.md) |
| **2** | Analytics Merkezi | Prime time heatmap, funnel, ekran bazlı analitik, export | [faz-2](faz-2-analitik-merkezi.md) |
| **3** | Display & Yayın | 3 yeni layout, widget yükseltme, sinematik geçişler, broadcast log | [faz-3](faz-3-ekran-ve-yayin.md) |
| **4** | AI & Otomasyon | Vision analizi, toplu üretim, içerik önerileri, schedule AI | [faz-4](faz-4-ai-otomasyon.md) |
| **5** | Sektör Liderliği | Ekran grupları, sahneler, bildirimler, mobil admin, kullanıcı yönetimi | [faz-5](faz-5-sektor-liderligi.md) |

---

## Toplam Kapsam

- **14 admin sayfası** tamamen yenilenecek / derinleştirilecek
- **13 display layout** geliştirilecek + **3 yeni layout** eklenecek
- **5 yeni API endpoint** yazılacak
- **Bildirim sistemi** kurulacak
- Tüm sayfalar **mobil uyumlu** hale getirilecek
- **Real-time** veri akışı her dashboard widget'ına entegre edilecek

---

## Öncelik Matrisi

| Etki | Çaba | Aksiyon |
|------|------|---------|
| ⬆️ Yüksek | ⬇️ Düşük | **Hemen yap** (Faz 1) |
| ⬆️ Yüksek | ⬆️ Yüksek | **Planla** (Faz 3-5) |
| ⬇️ Düşük | ⬇️ Düşük | Backlog |
| ⬇️ Düşük | ⬆️ Yüksek | Atla |

**Hemen Yap (Faz 1):** Dashboard real-time ekran sayacı, Ads zaman hedefleme, Content bulk onayla, Settings logo upload  
**Planla (Faz 3):** Yeni display layoutlar, remote screenshot, mobil admin  
