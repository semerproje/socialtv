import gemini, { GEMINI_MODEL } from '@/lib/gemini';
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

