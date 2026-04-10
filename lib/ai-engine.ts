import openai from '@/lib/openai';
import { prisma } from '@/lib/prisma';
import type { AIContentAnalysis, AIAdGenerationRequest, AIChatMessage, TextAdContent } from '@/types';

const AI_MODEL = 'gpt-4o';

// ─── Helper: Log AI request ────────────────────────────────────────────────────
async function logAIRequest(
  type: string,
  prompt: string,
  response: string,
  tokensUsed?: number,
  durationMs?: number,
) {
  try {
    await prisma.aIRequest.create({
      data: { type, prompt, response, model: AI_MODEL, tokensUsed, durationMs },
    });
  } catch {
    // Non-critical
  }
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

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 500,
  });

  const rawJson = response.choices[0]?.message?.content ?? '{}';
  const result = JSON.parse(rawJson) as AIContentAnalysis;
  const durationMs = Date.now() - start;

  await logAIRequest('analyze_content', prompt, rawJson, response.usage?.total_tokens, durationMs);
  return result;
}

// ─── Moderate Content ─────────────────────────────────────────────────────────
export async function moderateContent(text: string): Promise<{ passed: boolean; reason?: string }> {
  try {
    const response = await openai.moderations.create({ input: text });
    const result = response.results[0];

    if (result.flagged) {
      const categories = Object.entries(result.categories)
        .filter(([, flagged]) => flagged)
        .map(([cat]) => cat)
        .join(', ');
      return { passed: false, reason: `İçerik uygunsuz kategorilerde işaretlendi: ${categories}` };
    }
    return { passed: true };
  } catch {
    return { passed: true }; // On API error, allow content (fail open)
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

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.8,
    max_tokens: 300,
  });

  const rawJson = response.choices[0]?.message?.content ?? '{}';
  const result = JSON.parse(rawJson) as TextAdContent;
  const durationMs = Date.now() - start;

  await logAIRequest('generate_ad', prompt, rawJson, response.usage?.total_tokens, durationMs);
  return result;
}

// ─── AI Chat (Admin Assistant) ────────────────────────────────────────────────
export async function aiChat(
  messages: AIChatMessage[],
  systemContext?: string,
): Promise<string> {
  const start = Date.now();

  const systemPrompt = `Sen Social Lounge TV için profesyonel bir dijital tabela asistanısın. 
Türkçe yanıt ver. Kısa ve pratik cevaplar ver.
Reklam yönetimi, içerik moderasyonu, ekran düzeni ve lounge pazarlaması konularında uzmansın.
${systemContext ? `\nMevcut bağlam:\n${systemContext}` : ''}`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  const reply = response.choices[0]?.message?.content ?? 'Yanıt alınamadı.';
  const durationMs = Date.now() - start;
  const lastMsg = messages[messages.length - 1]?.content ?? '';
  await logAIRequest('chat', lastMsg, reply, response.usage?.total_tokens, durationMs);

  return reply;
}

// ─── Generate Content Suggestion ──────────────────────────────────────────────
export async function generateContentSuggestion(context: string): Promise<string> {
  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Sen bir lounge/bar için sosyal medya içerik uzmanısın. Türkçe, etkileyici ve kısa içerikler yaz. Emoji kullanabilirsin.',
      },
      {
        role: 'user',
        content: `Şu konu için kısa ve etkileyici bir sosyal medya paylaşımı oluştur:\n${context}\n\nMaks 150 karakter. Direkt paylaşıma hazır metin yaz.`,
      },
    ],
    temperature: 0.9,
    max_tokens: 200,
  });

  const reply = response.choices[0]?.message?.content ?? '';
  await logAIRequest('generate_content', context, reply, response.usage?.total_tokens, Date.now() - start);
  return reply;
}

// ─── Smart Ad Scheduling Suggestion ───────────────────────────────────────────
export async function suggestAdSchedule(adTitle: string, stats: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Sen bir dijital tabela optimizasyon uzmanısın. Lounge reklamlarının ne zaman yayınlanması gerektiği konusunda kısa, pratik Türkçe öneriler ver.',
      },
      {
        role: 'user',
        content: `Reklam: "${adTitle}"\n\nMevcut analitik:\n${stats}\n\nBu reklam için en iyi yayın zamanını ve günlerini 2-3 cümle ile öner.`,
      },
    ],
    temperature: 0.4,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content ?? 'Öneri oluşturulamadı.';
}
