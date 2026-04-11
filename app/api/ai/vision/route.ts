import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/ai-engine';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ai-vision', 10, 60_000);
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
    const body = await request.json() as { base64?: string; mimeType?: string; prompt?: string };
    const { base64, mimeType = 'image/jpeg', prompt } = body;

    if (!base64 || !prompt) {
      return NextResponse.json({ success: false, error: 'base64 ve prompt alanları gerekli' }, { status: 400 });
    }

    // Basic size guard: base64 of 10MB image ≈ 13.3MB string
    if (base64.length > 14_000_000) {
      return NextResponse.json({ success: false, error: 'Görsel çok büyük (maks ~10MB)' }, { status: 413 });
    }

    const result = await analyzeImage(base64, mimeType, prompt);
    return NextResponse.json({ success: true, data: { result } });
  } catch (error) {
    console.error('Vision API error:', error);
    const message = error instanceof Error ? error.message : 'Görsel analizi başarısız';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
