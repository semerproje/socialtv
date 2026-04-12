import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const TPL_PREFIX = 'schedule_tpl_';

// GET /api/schedule/templates — list all saved templates
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const allSettings = await db.setting.findMany();
    const tplSettings = allSettings.filter((s) => s.key.startsWith(TPL_PREFIX));

    const templates = tplSettings
      .map((r) => {
        try { return JSON.parse(r.value); } catch { return null; }
      })
      .filter(Boolean)
      .sort((a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json({ success: true, data: templates });
  } catch (err) {
    console.error('[GET /api/schedule/templates]', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/schedule/templates — save a new template
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'schedule-tpl-post', 10, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { name, slots } = body;

    if (!name || !Array.isArray(slots)) {
      return NextResponse.json({ success: false, error: 'name and slots are required' }, { status: 400 });
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const template = { id, name, createdAt: new Date().toISOString(), slots };

    await db.setting.upsert(`${TPL_PREFIX}${id}`, JSON.stringify(template));

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/schedule/templates]', err);
    return NextResponse.json({ success: false, error: 'Failed to save template' }, { status: 500 });
  }
}

// DELETE /api/schedule/templates?id=xxx — delete a template
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    await db.setting.delete(`${TPL_PREFIX}${id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/schedule/templates]', err);
    return NextResponse.json({ success: false, error: 'Failed to delete template' }, { status: 500 });
  }
}
