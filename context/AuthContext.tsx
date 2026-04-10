'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  AuthError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { AdminRole } from '@/types';

interface AuthContextType {
  user: User | null;
  adminRole: AdminRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (!u) {
        setAdminRole(null);
        setLoading(false);
        return;
      }

      try {
        const token = await u.getIdToken();
        const response = await fetch('/api/admin/me', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setAdminRole(null);
          setLoading(false);
          return;
        }

        const json = await response.json();
        setAdminRole(json.data?.role ?? null);
      } catch {
        setAdminRole(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error('Firebase Auth başlatılamadı');
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    if (!auth) return;
    await firebaseSignOut(auth);
    setAdminRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, adminRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
