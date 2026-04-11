import { NextRequest, NextResponse } from 'next/server';
import { adminDb, getAdminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

// ─── Users API ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'ops');
  if (auth instanceof NextResponse) return auth;

  try {
    const adminAuth = getAdminAuth();
    const listResult = await adminAuth.listUsers(1000);

    // Fetch role overrides from Firestore
    const rolesSnap = await adminDb.collection('admin_users').get();
    const roleMap: Record<string, string> = {};
    rolesSnap.docs.forEach(d => { roleMap[d.id] = d.data().role ?? 'viewer'; });

    const users = listResult.users.map(u => ({
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      photoURL: u.photoURL ?? null,
      disabled: u.disabled,
      lastSignInTime: u.metadata.lastSignInTime ?? null,
      creationTime: u.metadata.creationTime ?? null,
      role: roleMap[u.uid] ?? (u.customClaims?.role as string | undefined) ?? 'viewer',
    }));

    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    console.error('[admin/users GET]', err);
    return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authRes = await requireAdmin(request, 'ops');
  if (authRes instanceof NextResponse) return authRes;

  const rl = enforceRateLimit(request, 'admin-users-patch', 20, 60_000);
  if (rl instanceof NextResponse) return rl;

  try {
    const { uid, role, disabled } = await request.json();
    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ success: false, error: 'uid required' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    if (role !== undefined) {
      const allowed = ['viewer', 'editor', 'ops'];
      if (!allowed.includes(role)) {
        return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
      }
      await adminAuth.setCustomUserClaims(uid, { role });
      await adminDb.collection('admin_users').doc(uid).set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    if (disabled !== undefined) {
      await adminAuth.updateUser(uid, { disabled: Boolean(disabled) });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users PATCH]', err);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}
