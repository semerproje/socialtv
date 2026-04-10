import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const content = await db.content.findUnique(id);
    if (!content) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: content });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, 'content-put', 40, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const content = await db.content.update(id, body);
    return NextResponse.json({ success: true, data: content });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, 'content-delete', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await db.content.delete(id);
    return NextResponse.json({ success: true, message: 'Deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
