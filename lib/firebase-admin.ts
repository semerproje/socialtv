import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

let _db: Firestore | null = null;
let _app: App | null = null;
let _auth: Auth | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  try {
    // Prefer JSON env var (production), then fall back to local file (dev)
    let sa: object | undefined;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      const saPath = path.join(process.cwd(), 'service-account.json');
      sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    }
    _app = initializeApp({ credential: cert(sa as Parameters<typeof cert>[0]) });
  } catch {
    _app = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'social-web-tv',
    });
  }

  return _app;
}

function getAdminDb(): Firestore {
  if (_db) return _db;

  const app = getAdminApp();
  _db = getFirestore(app);

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    _db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
  }

  return _db;
}

export { getAdminDb, getAdminApp };
export function getAdminAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getAdminApp());
  return _auth;
}

// Lazy proxy — only initializes on first actual DB call, not at module load
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const db = getAdminDb();
    const val = (db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  },
});

