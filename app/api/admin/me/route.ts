import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'viewer');
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    success: true,
    data: {
      role: auth.role,
      email: auth.token?.email ?? null,
      uid: auth.token?.uid ?? null,
    },
  });
}