import gemini, { GEMINI_MODEL, GEMINI_FLASH_MODEL } from '@/lib/gemini';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { AIContentAnalysis, AIAdGenerationRequest, AIChatMessage, TextAdContent } from '@/types';

// ─── Helper: Log AI request ────────────────────────────────────────────────────
async function logAIRequest(
  type: string,
  prompt: string,
  response: string,
  tokensUsed?: number,
  durationMs?: number,
) {
  try {
    await adminDb.collection('ai_requests').add({
      type,
      prompt,
      response,
      model: GEMINI_MODEL,
      tokensUsed: tokensUsed ?? null,
      durationMs: durationMs ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Non-critical
  }
}

// ─── Helper: Generate JSON via Gemini ─────────────────────────────────────────
async function generateJSON<T>(prompt: string): Promise<{ result: T; raw: string; tokenCount?: number }> {
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const res = await model.generateContent(prompt);
  const raw = res.response.text();
  // usageMetadata is optional
  const tokenCount = (res.response as unknown as Record<string, unknown>).usageMetadata
    ? ((res.response as unknown as Record<string, unknown>).usageMetadata as Record<string, number>).totalTokenCount
    : undefined;
  return { result: JSON.parse(raw) as T, raw, tokenCount };
}

// ─── Helper: Generate text via Gemini ─────────────────────────────────────────
async function generateText(prompt: string, systemInstruction?: string): Promise<{ text: string; tokenCount?: number }> {
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    ...(systemInstruction ? { systemInstruction } : {}),
  });
  const res = await model.generateContent(prompt);
  const text = res.response.text();
  const tokenCount = (res.response as unknown as Record<string, unknown>).usageMetadata
    ? ((res.response as unknown as Record<string, unknown>).usageMetadata as Record<string, number>).totalTokenCount
    : undefined;
  return { text, tokenCount };
}

// ─── Analyze Content ──────────────────────────────────────────────────────────
export async function analyzeContent(text: string): Promise<AIContentAnalysis> {
  const start = Date.now();
  const prompt = `Aşağıdaki sosyal medya içeriğini analiz et. JSON formatında yanıt ver:

İçerik: "${text}"

Şu bilgileri çıkar:
- sentiment: "positive", "neutral" veya "negative" (Türkçe içerik için)
- sentimentScore: -1 ile 1 arasında ondalık sayı
- summary: İçeriğin 1 cümlelik Türkçe özeti
- tags: İlgili Türkçe taglar dizisi (maks 5)
- isAppropriate: İçerik lounge ekranında yayınlamak için uygun mu? (boolean)
- moderationReason: Uygun değilse neden olduğu (string veya null)
- highlights: Öne çıkan en ilginç 1-2 nokta (string dizisi)

Sadece geçerli JSON döndür, başka açıklama ekleme.`;

  const { result, raw, tokenCount } = await generateJSON<AIContentAnalysis>(prompt);
  await logAIRequest('analyze_content', prompt, raw, tokenCount, Date.now() - start);
  return result;
}

// ─── Moderate Content ─────────────────────────────────────────────────────────
export async function moderateContent(text: string): Promise<{ passed: boolean; reason?: string }> {
  try {
    const prompt = `Aşağıdaki içeriği incele ve bir lounge/bar dijital ekranında yayınlamak için uygun olup olmadığını belirle.
JSON formatında yanıt ver: { "passed": boolean, "reason": string | null }
Nefret söylemi, şiddet, müstehcenlik veya aşırı siyasi içerik varsa passed=false.

İçerik: "${text}"

Sadece JSON döndür.`;
    const { result } = await generateJSON<{ passed: boolean; reason?: string }>(prompt);
    return result;
  } catch {
    return { passed: true }; // Fail open on error
  }
}

// ─── Generate Ad Copy ─────────────────────────────────────────────────────────
export async function generateAdCopy(request: AIAdGenerationRequest): Promise<TextAdContent> {
  const start = Date.now();
  const prompt = `Bir lounge/bar işletmesi için etkileyici dijital ekran reklam metni oluştur.

İşletme: ${request.business || 'Social Lounge'}
Teklif/Mesaj: ${request.offer}
Ton: ${request.tone || 'enerjik ve davetkar'}
Hedef Kitle: ${request.targetAudience || 'genç yetişkinler'}
CTA: ${request.callToAction || 'Hemen gel!'}

JSON formatında şu alanları doldur:
- headline: Ana başlık (maks 20 karakter, büyük harf etkili)
- subheadline: Alt başlık (maks 30 karakter)
- body: Ana metin (maks 50 karakter, 1-2 satır)
- cta: Eylem çağrısı butonu metni (maks 25 karakter)
- badge: Köşe rozeti metni (maks 10 karakter, örn: "BUGÜN", "ÖZEL", "YENİ")

Sadece JSON döndür.`;

  const { result, raw, tokenCount } = await generateJSON<TextAdContent>(prompt);
  await logAIRequest('generate_ad', prompt, raw, tokenCount, Date.now() - start);
  return result;
}

// ─── AI Chat (Admin Assistant) ────────────────────────────────────────────────
export async function aiChat(
  messages: AIChatMessage[],
  systemContext?: string,
): Promise<string> {
  const start = Date.now();

  const systemInstruction = `Sen Social Lounge TV için profesyonel bir dijital tabela asistanısın.
Türkçe yanıt ver. Kısa ve pratik cevaplar ver.
Reklam yönetimi, içerik moderasyonu, ekran düzeni ve lounge pazarlaması konularında uzmansın.
${systemContext ? `\nMevcut bağlam:\n${systemContext}` : ''}`;

  // Build conversation history for Gemini multi-turn chat
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
  });

  const chat = model.startChat({
    history: messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  });

  const lastMessage = messages[messages.length - 1]?.content ?? '';
  const res = await chat.sendMessage(lastMessage);
  const reply = res.response.text();
  const tokenCount = (res.response as unknown as Record<string, unknown>).usageMetadata
    ? ((res.response as unknown as Record<string, unknown>).usageMetadata as Record<string, number>).totalTokenCount
    : undefined;

  await logAIRequest('chat', lastMessage, reply, tokenCount, Date.now() - start);
  return reply;
}

// ─── Generate Content Suggestion ──────────────────────────────────────────────
export async function generateContentSuggestion(context: string): Promise<string> {
  const start = Date.now();
  const { text, tokenCount } = await generateText(
    `Şu konu için kısa ve etkileyici bir sosyal medya paylaşımı oluştur:\n${context}\n\nMaks 150 karakter. Direkt paylaşıma hazır metin yaz. Emoji kullanabilirsin.`,
    'Sen bir lounge/bar için sosyal medya içerik uzmanısın. Türkçe, etkileyici ve kısa içerikler yaz.',
  );
  await logAIRequest('generate_content', context, text, tokenCount, Date.now() - start);
  return text;
}

// ─── Smart Ad Scheduling Suggestion ───────────────────────────────────────────
export async function suggestAdSchedule(adTitle: string, stats: string): Promise<string> {
  const { text } = await generateText(
    `Reklam: "${adTitle}"\n\nMevcut analitik:\n${stats}\n\nBu reklam için en iyi yayın zamanını ve günlerini 2-3 cümle ile öner.`,
    'Sen bir dijital tabela optimizasyon uzmanısın. Lounge reklamlarının ne zaman yayınlanması gerektiği konusunda kısa, pratik Türkçe öneriler ver.',
  );
  return text || 'Öneri oluşturulamadı.';
}

// ─── Analyze Image (Gemini Vision) ────────────────────────────────────────────
export async function analyzeImage(base64: string, mimeType: string, prompt: string): Promise<string> {
  const start = Date.now();
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });
  const res = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    prompt,
  ]);
  const text = res.response.text();
  await logAIRequest('vision', prompt, text, undefined, Date.now() - start);
  return text;
}

// ─── Batch Generate ───────────────────────────────────────────────────────────
export async function batchGenerate(type: string, context: string, count: number): Promise<string[]> {
  const start = Date.now();
  const typeLabels: Record<string, string> = {
    ad_headlines: `${count} farklı, kısa ve etkileyici reklam başlığı (her biri max 25 karakter)`,
    ig_captions:  `${count} farklı Instagram caption (her biri max 150 karakter, emojili)`,
    ticker_msgs:  `${count} farklı haber bandı mesajı (her biri max 80 karakter)`,
    event_titles: `${count} farklı etkinlik başlığı (kısa, enerjik, dikkat çekici)`,
  };
  const typeLabel = typeLabels[type] ?? `${count} farklı metin`;

  const prompt = `Lounge/bar işletmesi için aşağıdaki konuya uygun ${typeLabel} üret.

Konu/Bağlam: ${context}

Önemli kurallar:
- Türkçe yaz
- Yaratıcı ve özgün ol
- Her madde farklı bir açıdan yaklaş
- Bir JSON string dizisi olarak döndür: ["metin1", "metin2", ...]
- Sadece JSON array döndür, ek açıklama ekleme`;

  const { result, raw, tokenCount } = await generateJSON<string[]>(prompt);
  await logAIRequest('batch_generate', prompt, raw, tokenCount, Date.now() - start);
  return Array.isArray(result) ? result : [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── AI DIRECTOR ENGINE (Gemini 2.5 Pro) ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Use Pro model for Director (deep reasoning)
async function generateJSONPro<T>(prompt: string, systemInstruction: string): Promise<{ result: T; raw: string; tokenCount?: number }> {
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      topP: 0.95,
    },
  });
  const res = await model.generateContent(prompt);
  const raw = res.response.text();
  const tokenCount = (res.response as unknown as Record<string, unknown>).usageMetadata
    ? ((res.response as unknown as Record<string, unknown>).usageMetadata as Record<string, number>).totalTokenCount
    : undefined;
  return { result: JSON.parse(raw) as T, raw, tokenCount };
}

async function generateTextPro(prompt: string, systemInstruction: string): Promise<{ text: string; tokenCount?: number }> {
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    generationConfig: { temperature: 0.8 },
  });
  const res = await model.generateContent(prompt);
  const text = res.response.text();
  const tokenCount = (res.response as unknown as Record<string, unknown>).usageMetadata
    ? ((res.response as unknown as Record<string, unknown>).usageMetadata as Record<string, number>).totalTokenCount
    : undefined;
  return { text, tokenCount };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DirectorLayoutRecommendation {
  screenId?: string | null;        // null = all screens
  screenName?: string;
  layout: string;
  reason: string;
  priority: 'immediate' | 'suggested' | 'scheduled';
  scheduledFor?: string;           // ISO datetime for scheduled
  duration?: number;               // minutes to keep this layout
}

export interface DirectorScheduleEvent {
  title: string;
  type: string;
  layoutType?: string;
  contentRef?: string;
  startAt: string;                 // ISO datetime
  endAt?: string;
  recurrence: string;
  priority: string;
  color?: string;
  reason: string;
}

export interface DirectorPlaylistSuggestion {
  name: string;
  description: string;
  transition: string;
  defaultDuration: number;
  items: Array<{
    type: string;
    title: string;
    duration: number;
    reason: string;
    mediaUrl?: string;
    youtubeVideoId?: string;
    layoutType?: string;
  }>;
  totalDuration: number;
  targetScreens?: string[];
}

export interface DirectorBroadcastCommand {
  command: string;               // SSE event name: 'change_layout', 'overlay_message', etc.
  target: 'all' | string;        // 'all' or screenId
  payload: Record<string, unknown>;
  reason: string;
  executeAt?: string;            // ISO datetime, undefined = immediate
}

export interface DirectorTickerSuggestion {
  text: string;
  emoji?: string;
  priority: number;
  color?: string;
  reason: string;
}

export interface AIActionPlan {
  summary: string;
  analysis: string;
  confidence: number;             // 0-100
  layoutRecommendations: DirectorLayoutRecommendation[];
  scheduleEvents: DirectorScheduleEvent[];
  playlistSuggestions: DirectorPlaylistSuggestion[];
  broadcastCommands: DirectorBroadcastCommand[];
  tickerSuggestions: DirectorTickerSuggestion[];
  contentPriorities: Array<{
    contentId?: string;
    reason: string;
    action: 'feature' | 'hide' | 'highlight';
  }>;
  optimizationTips: string[];
  generatedAt: string;
}

export interface SystemStateSnapshot {
  currentTime: string;
  dayOfWeek: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  screens: Array<{
    id: string;
    name: string;
    location?: string;
    currentLayout: string;
    isOnline: boolean;
    groupName?: string;
  }>;
  activeAds: Array<{ id: string; title: string; type: string; priority: number }>;
  approvedContentCount: number;
  instagramPostCount: number;
  activeTickerCount: number;
  scheduledEventsToday: number;
  playlistCount: number;
  businessContext?: string;
}

const DIRECTOR_SYSTEM_INSTRUCTION = `Sen Social Lounge TV'nin AI Direktörüsün. 
Görevin: dijital tabela sistemini baştan sona yönetmek ve en yüksek kalitede yayın deneyimi sunmak.

Sistemdeki layoutlar ve kullanım alanları:
- default: Genel sosyal medya içeriği, gün içi yayın
- youtube: YouTube video yayını, müzik/eğlence
- instagram: Instagram post akışı, sosyal duvar
- split_2: İki bölümlü ekran, içerik + haber
- fullscreen: Tek içerik tam ekran
- digital_signage: Profesyonel tabela, duyuru
- social_wall: Sosyal medya mozaik duvarı
- ambient: Saat, hava, ortam bilgileri — sakin atmosfer
- promo: Promosyon ve reklam odaklı
- triple: Üç bölümlü ekran
- news_focus: Haber odaklı yayın
- portrait: Dikey ekran modu
- markets: Borsa ve döviz bilgileri
- breaking_news: Acil/önemli duyuru (yalnızca gerektiğinde)
- event_countdown: Etkinlik geri sayımı
- split_scoreboard: Spor skoru + sosyal feed

Zamanlama rehberi:
- 07:00–11:00 (Sabah): ambient, digital_signage, news_focus 
- 11:00–14:00 (Öğle): social_wall, instagram, default
- 14:00–17:00 (Öğleden sonra): youtube, promo, split_2
- 17:00–21:00 (Akşam prime time): promo, instagram, youtube — reklam yoğunluğunu artır
- 21:00–00:00 (Gece): social_wall, ambient, youtube
- 00:00–07:00 (Gece geç): ambient, markets

Verilen sistem durumunu analiz et ve JSON action plan oluştur. 
Tüm metin çıktıları Türkçe olmalı. Pratik, uygulanabilir öneriler ver.`;

// ─── Master AI Director ───────────────────────────────────────────────────────

export async function analyzeAndDirectSystem(
  snapshot: SystemStateSnapshot,
  userInstruction?: string,
): Promise<AIActionPlan> {
  const start = Date.now();

  const prompt = `Aşağıdaki sistem durumunu analiz et ve kapsamlı bir aksiyon planı oluştur.

## MEVCUT SİSTEM DURUMU
Zaman: ${snapshot.currentTime}
Gün: ${snapshot.dayOfWeek}
Günün dilimi: ${snapshot.timeOfDay}
${snapshot.businessContext ? `İşletme bağlamı: ${snapshot.businessContext}` : ''}

## EKRANLAR (${snapshot.screens.length} adet)
${snapshot.screens.map(s => `- ${s.name}${s.location ? ` (${s.location})` : ''}: layout="${s.currentLayout}" ${s.isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}${s.groupName ? ` [Grup: ${s.groupName}]` : ''}`).join('\n')}

## İÇERİK
- Aktif reklam: ${snapshot.activeAds.length} adet
${snapshot.activeAds.slice(0, 5).map(a => `  • "${a.title}" (tür: ${a.type}, öncelik: ${a.priority})`).join('\n')}
- Onaylı sosyal içerik: ${snapshot.approvedContentCount} adet
- Instagram gönderisi: ${snapshot.instagramPostCount} adet
- Aktif ticker mesajı: ${snapshot.activeTickerCount} adet
- Bugünkü schedule eventi: ${snapshot.scheduledEventsToday} adet
- Playlist sayısı: ${snapshot.playlistCount} adet

${userInstruction ? `## KULLANICI TALİMATI\n${userInstruction}` : ''}

## GÖREV
Yukarıdaki durumu analiz ederek kapsamlı bir aksiyon planı döndür. JSON formatı:

{
  "summary": "1-2 cümle özet",
  "analysis": "Detaylı durum analizi (3-5 cümle)",
  "confidence": 85,
  "layoutRecommendations": [
    {
      "screenId": null,
      "screenName": "Tüm ekranlar",
      "layout": "youtube",
      "reason": "Akşam prime time — eğlence içeriği daha fazla müşteri çeker",
      "priority": "immediate",
      "duration": 120
    }
  ],
  "scheduleEvents": [
    {
      "title": "Akşam Promo Yayını",
      "type": "layout",
      "layoutType": "promo",
      "startAt": "${new Date(Date.now() + 3600000).toISOString().slice(0, 16)}:00",
      "endAt": "${new Date(Date.now() + 7200000).toISOString().slice(0, 16)}:00",
      "recurrence": "daily",
      "priority": "high",
      "color": "#ec4899",
      "reason": "Her gün akşam prime time reklamı"
    }
  ],
  "playlistSuggestions": [
    {
      "name": "Akşam Karışık",
      "description": "Prime time için optimize edilmiş",
      "transition": "fade",
      "defaultDuration": 15,
      "items": [
        { "type": "layout", "title": "Promo Layout", "duration": 300, "layoutType": "promo", "reason": "Reklam izlenimi sağlar" },
        { "type": "youtube", "title": "Müzik videosu", "duration": 180, "reason": "Atmosfer yaratır" }
      ],
      "totalDuration": 480
    }
  ],
  "broadcastCommands": [
    {
      "command": "change_layout",
      "target": "all",
      "payload": { "layout": "youtube" },
      "reason": "Anlık layout değişikliği"
    }
  ],
  "tickerSuggestions": [
    {
      "text": "Akşam 21:00'e kadar mutfaktan özel menüler mevcut! 🍽️",
      "emoji": "🍽️",
      "priority": 8,
      "color": "#f59e0b",
      "reason": "Müşteri yönlendirme"
    }
  ],
  "contentPriorities": [],
  "optimizationTips": [
    "Prime time saatlerinde reklam frekansını artırın",
    "Akşam 19-21 arası en yüksek müşteri trafiği bekleniyor"
  ],
  "generatedAt": "${new Date().toISOString()}"
}

Sadece geçerli JSON döndür.`;

  const { result, raw, tokenCount } = await generateJSONPro<AIActionPlan>(prompt, DIRECTOR_SYSTEM_INSTRUCTION);
  await logAIRequest('ai_director', prompt, raw, tokenCount, Date.now() - start);
  return { ...result, generatedAt: new Date().toISOString() };
}

// ─── AI Weekly Schedule Generator ─────────────────────────────────────────────

export interface WeeklyScheduleItem {
  title: string;
  type: string;
  layoutType?: string;
  startAt: string;      // ISO datetime (full week)
  endAt: string;
  recurrence: string;
  priority: string;
  color?: string;
  reason: string;
}

export async function generateWeeklySchedule(
  weekStart: string,            // ISO date "2026-04-13"
  businessContext: string,
  contentSummary: string,
  existingEventsCount: number,
): Promise<{ events: WeeklyScheduleItem[]; narrative: string }> {
  const start = Date.now();

  const prompt = `Aşağıdaki işletme için ${weekStart} tarihinden başlayan 1 haftalık yayın takvimi oluştur.

İşletme: ${businessContext}
Mevcut içerik özeti: ${contentSummary}
Mevcut schedule eventi: ${existingEventsCount} adet

Haftalık takvim kuralları:
- Pazartesi–Cuma: İş günü ritmi
- Cumartesi–Pazar: Hafta sonu = daha uzun akşam programı, daha çok promo
- Sabah açılışı (07:00–09:00): ambient/digital_signage
- Öğle yoğunluğu (12:00–14:00): social_wall/instagram
- Prime time (18:00–22:00): promo/youtube yoğun
- Gece kapanış (22:00–00:00): ambient/markets

JSON formatında döndür:
{
  "events": [
    {
      "title": "Pazartesi Sabah Ortam",
      "type": "layout",
      "layoutType": "ambient",
      "startAt": "${weekStart}T07:00:00",
      "endAt": "${weekStart}T09:00:00",
      "recurrence": "weekdays",
      "priority": "normal",
      "color": "#6366f1",
      "reason": "Sabah sakin atmosfer"
    }
  ],
  "narrative": "Bu hafta için önerilen yayın stratejisi..."
}

Her gün için en az 4-5 event oluştur (toplam 28-35 event). Sadece JSON döndür.`;

  const systemInstruction = DIRECTOR_SYSTEM_INSTRUCTION + `\nHaftalık schedule JSON formatında döndür. Türkçe başlıklar kullan. startAt/endAt tam ISO datetime olmalı.`;

  const { result, raw, tokenCount } = await generateJSONPro<{ events: WeeklyScheduleItem[]; narrative: string }>(prompt, systemInstruction);
  await logAIRequest('ai_weekly_schedule', prompt, raw, tokenCount, Date.now() - start);
  return result;
}

// ─── AI Layout Recommender (fast, Flash model) ────────────────────────────────

export async function suggestLayoutForNow(
  currentTime: Date,
  screens: Array<{ id: string; name: string; currentLayout: string }>,
  businessContext?: string,
): Promise<Array<{ screenId: string | null; layout: string; reason: string }>> {
  const hour = currentTime.getHours();
  const day = currentTime.getDay();
  const isWeekend = day === 0 || day === 6;
  const isPrimeTime = hour >= 18 && hour < 22;

  const prompt = `Saat: ${currentTime.toLocaleTimeString('tr-TR')}
Gün: ${'PazPztSalÇarPerCumCmt'.match(/.{3}/g)![day]} (${isWeekend ? 'Hafta sonu' : 'Hafta içi'})
Prime time: ${isPrimeTime ? 'EVET' : 'HAYIR'}
${businessContext ? `Bağlam: ${businessContext}` : ''}

Ekranlar: ${screens.map(s => `${s.name} (şu an: ${s.currentLayout})`).join(', ')}

Her ekran için en uygun layoutu JSON array olarak döndür:
[{"screenId":"<id ya da null>","layout":"<layout>","reason":"<türkçe kısa neden>"}]

Sadece JSON array döndür.`;

  try {
    const model = gemini.getGenerativeModel({
      model: GEMINI_FLASH_MODEL,           // Fast model for quick recommendations
      generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
    });
    const res = await model.generateContent(prompt);
    return JSON.parse(res.response.text()) as Array<{ screenId: string | null; layout: string; reason: string }>;
  } catch {
    return [{ screenId: null, layout: isPrimeTime ? 'promo' : 'default', reason: 'Varsayılan öneri' }];
  }
}

// ─── AI Playlist Generator ─────────────────────────────────────────────────────

export async function generateAIPlaylist(
  theme: string,
  durationMinutes: number,
  availableLayouts: string[],
  businessContext?: string,
): Promise<DirectorPlaylistSuggestion> {
  const start = Date.now();

  const prompt = `Aşağıdaki tema için ${durationMinutes} dakikalık bir playlist oluştur:

Tema: ${theme}
${businessContext ? `İşletme bağlamı: ${businessContext}` : ''}
Kullanılabilir layoutlar: ${availableLayouts.join(', ')}

Playlist JSON formatında döndür:
{
  "name": "Playlist adı",
  "description": "Kısa açıklama",
  "transition": "fade",
  "defaultDuration": 15,
  "items": [
    { "type": "layout", "title": "Promo Ekranı", "duration": 300, "layoutType": "promo", "reason": "Reklam izlenimi" },
    { "type": "youtube", "title": "Canlı Müzik", "duration": 240, "reason": "Atmosfer" }
  ],
  "totalDuration": ${durationMinutes * 60}
}

Çeşitli içerik türleri karıştır. Sadece JSON döndür.`;

  const { result, raw, tokenCount } = await generateJSONPro<DirectorPlaylistSuggestion>(prompt, DIRECTOR_SYSTEM_INSTRUCTION);
  await logAIRequest('ai_playlist_generate', prompt, raw, tokenCount, Date.now() - start);
  return result;
}

// ─── AI Ticker Generator ───────────────────────────────────────────────────────

export async function generateAITickers(
  context: string,
  count: number = 5,
): Promise<DirectorTickerSuggestion[]> {
  const prompt = `"${context}" bağlamı için ${count} ticker mesajı üret.

JSON array döndür:
[{"text":"mesaj max 80 karakter","emoji":"🎯","priority":7,"color":"#f59e0b","reason":"neden önemli"}]

Sadece JSON array döndür.`;

  try {
    const { result } = await generateJSONPro<DirectorTickerSuggestion[]>(prompt, DIRECTOR_SYSTEM_INSTRUCTION);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

// ─── AI Content Priority Ranker ───────────────────────────────────────────────

export async function rankContentForDisplay(
  contents: Array<{ id: string; text: string; platform: string; likes: number; sentiment?: string }>,
  screenContext: string,
): Promise<Array<{ contentId: string; score: number; reason: string; action: 'feature' | 'highlight' | 'normal' | 'hide' }>> {
  if (!contents.length) return [];

  const prompt = `Şu ekran bağlamı için içerikleri sırala: ${screenContext}

İçerikler:
${contents.slice(0, 20).map(c => `ID:${c.id} [${c.platform}] beğeni:${c.likes} sentiment:${c.sentiment ?? 'neutral'} — "${c.text.slice(0, 80)}"`).join('\n')}

Her içerik için skor ver (0-100) ve aksiyon öner.
JSON array döndür: [{"contentId":"id","score":85,"reason":"neden","action":"feature|highlight|normal|hide"}]
Sadece JSON array döndür.`;

  try {
    const { result } = await generateJSONPro<Array<{ contentId: string; score: number; reason: string; action: 'feature' | 'highlight' | 'normal' | 'hide' }>>(prompt, DIRECTOR_SYSTEM_INSTRUCTION);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

