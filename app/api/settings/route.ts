import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/settings
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const settings = await db.setting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return NextResponse.json({ success: true, data: map });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/settings — Bulk update
export async function PUT(request: NextRequest) {
  const limited = enforceRateLimit(request, 'settings-put', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'ops');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as Record<string, string>;

    const updates = Object.entries(body).map(([key, value]) =>
      db.setting.upsert(key, value),
    );

    await Promise.all(updates);
    return NextResponse.json({ success: true, message: 'Settings updated' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
}
