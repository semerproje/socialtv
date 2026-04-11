import { NextRequest, NextResponse } from 'next/server';
import { batchGenerate } from '@/lib/ai-engine';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

const VALID_TYPES = ['ad_headlines', 'ig_captions', 'ticker_msgs', 'event_titles'];

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ai-batch', 5, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Gemini API key yapılandırılmamış. GEMINI_API_KEY ortam değişkenini ayarlayın.' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json() as { type?: string; context?: string; count?: number };
    const { type, context, count = 5 } = body;

    if (!type || !context) {
      return NextResponse.json({ success: false, error: 'type ve context alanları gerekli' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: `Geçersiz type. Geçerli değerler: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    const safeCount = Math.max(1, Math.min(Number(count) || 5, 10));
    const results = await batchGenerate(type, context, safeCount);
    return NextResponse.json({ success: true, data: { results } });
  } catch (error) {
    console.error('Batch generate error:', error);
    const message = error instanceof Error ? error.message : 'Toplu üretim başarısız';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
