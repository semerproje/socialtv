import { NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AdminRole } from '@/types';
import { getAdminAuth } from './firebase-admin';
import { consumeRateLimit, getRequestFingerprint } from './rate-limit';

const ROLE_WEIGHT: Record<AdminRole, number> = {
  viewer: 1,
  editor: 2,
  ops: 3,
};

function parseBearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

function isLocalDev(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  return process.env.NODE_ENV !== 'production' && (host.includes('localhost') || host.includes('127.0.0.1'));
}

function parseEmails(source: string | undefined): string[] {
  return (source ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRole(value: unknown): AdminRole | null {
  if (value === 'viewer' || value === 'editor' || value === 'ops') return value;
  return null;
}

function resolveRole(email?: string | null, decoded?: DecodedIdToken): AdminRole | null {
  const claimRole = normalizeRole(decoded?.role ?? decoded?.adminRole);
  if (claimRole) return claimRole;

  const normalizedEmail = email?.toLowerCase() ?? '';
  if (!normalizedEmail) return null;

  if (parseEmails(process.env.ADMIN_OPS_EMAILS).includes(normalizedEmail)) return 'ops';
  if (parseEmails(process.env.ADMIN_EDITOR_EMAILS).includes(normalizedEmail)) return 'editor';
  if (parseEmails(process.env.ADMIN_VIEWER_EMAILS).includes(normalizedEmail)) return 'viewer';
  if (parseEmails(process.env.ADMIN_ALLOWED_EMAILS).includes(normalizedEmail)) return 'ops';

  return null;
}

function hasRequiredRole(actual: AdminRole, required: AdminRole) {
  return ROLE_WEIGHT[actual] >= ROLE_WEIGHT[required];
}

export async function requireAdmin(
  request: NextRequest,
  requiredRole: AdminRole = 'viewer'
): Promise<{ ok: true; token: DecodedIdToken | null; role: AdminRole } | { ok: false; response: NextResponse }> {
  const bearer = parseBearer(request);

  if (!bearer) {
    if (isLocalDev(request) && process.env.ADMIN_API_STRICT !== 'true') {
      return { ok: true, token: null, role: 'ops' };
    }
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(bearer);
    const role = resolveRole(decoded.email, decoded);
    if (!role) {
      return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
    }

    if (!hasRequiredRole(role, requiredRole)) {
      return { ok: false, response: NextResponse.json({ success: false, error: 'Insufficient role' }, { status: 403 }) };
    }

    return { ok: true, token: decoded, role };
  } catch {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
}

export function enforceRateLimit(request: NextRequest, scope: string, limit: number, windowMs: number) {
  const result = consumeRateLimit(getRequestFingerprint(request, scope), limit, windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { success: false, error: 'Too many requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
      },
    }
  );
}