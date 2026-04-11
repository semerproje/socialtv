import { NextRequest, NextResponse } from 'next/server';
import { aiChat } from '@/lib/ai-engine';
import * as db from '@/lib/db';
import type { AIChatMessage } from '@/types';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ai-chat-post', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { messages, includeContext = true } = await request.json() as {
      messages: AIChatMessage[];
      includeContext?: boolean;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: false, error: 'messages is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key yapılandırılmamış. GEMINI_API_KEY ortam değişkenini ayarlayın.' },
        { status: 503 },
      );
    }

    // Build context from DB
    let context: string | undefined;
    if (includeContext) {
      try {
        const [activeAds, contentCount] = await Promise.all([
          db.advertisement.findMany({ where: { isActive: true } }),
          db.content.count({ where: { isApproved: true } }),
        ]);
        const adCount = activeAds.length;
        const topAds = activeAds
          .sort((a, b) => ((b as { priority: number }).priority - (a as { priority: number }).priority))
          .slice(0, 5);

        context = `
Mevcut sistem durumu:
- Toplam reklam: ${adCount}
- Aktif reklamlar: ${topAds.map((a) => { const ad = a as { title: string; priority: number; impressions: number }; return `"${ad.title}" (öncelik: ${ad.priority}, gösterim: ${ad.impressions})`; }).join(', ')}
- Onaylı içerik sayısı: ${contentCount}`
      } catch {
        // Continue without context
      }
    }

    const reply = await aiChat(messages, context);
    return NextResponse.json({ success: true, data: { reply } });
  } catch (error) {
    console.error('AI chat error:', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
