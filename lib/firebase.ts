import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { auth, db, storage };

/*
 * ─── Firestore Security Rules ─────────────────────────────────────────────────
 * Deploy these rules in Firebase Console → Firestore → Rules:
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /screens/{screenId} {
 *       allow read: if true;
 *       allow write: if request.auth != null;
 *     }
 *     match /broadcast/{document} {
 *       allow read: if true;
 *       allow write: if request.auth != null;
 *     }
 *   }
 * }
 *
 * ─── Firebase Storage Security Rules ─────────────────────────────────────────
 * Deploy in Firebase Console → Storage → Rules:
 *
 * rules_version = '2';
 * service firebase.storage {
 *   match /b/{bucket}/o {
 *     match /{allPaths=**} {
 *       allow read: if true;
 *       allow write: if request.auth != null;
 *     }
 *   }
 * }
 */
