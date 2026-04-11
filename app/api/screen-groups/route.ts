import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/screen-groups — list all groups with screen counts
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  const [groups, screens] = await Promise.all([
    db.screenGroup.findMany(),
    db.screen.findMany(),
  ]);

  // Attach screen count to each group
  const enriched = (groups as Array<Record<string, unknown>>).map((g) => ({
    ...g,
    screenCount: (screens as Array<Record<string, unknown>>).filter((s) => s.groupId === g.id).length,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

// POST /api/screen-groups — create group
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'screen-groups-write', 20, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { name, color, description } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const group = await db.screenGroup.create({ name: name.trim(), color, description });
  return NextResponse.json({ success: true, data: group }, { status: 201 });
}

// PATCH /api/screen-groups?id=... — update group
export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req, 'screen-groups-write', 20, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json();
  const ALLOWED = ['name', 'color', 'description'];
  const safe: Record<string, unknown> = {};
  for (const k of ALLOWED) { if (k in body) safe[k] = body[k]; }

  if (!Object.keys(safe).length) return NextResponse.json({ error: 'no valid fields' }, { status: 400 });

  const group = await db.screenGroup.update(id, safe);
  return NextResponse.json({ success: true, data: group });
}

// DELETE /api/screen-groups?id=... — delete group (+ detach screens)
export async function DELETE(req: NextRequest) {
  const limited = enforceRateLimit(req, 'screen-groups-write', 10, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await db.screenGroup.delete(id);
  return NextResponse.json({ success: true });
}
