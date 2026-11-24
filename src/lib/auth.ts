// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import { log } from '@/lib/logger';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { getAdminAuth, getAdminDb } from './firebase-admin';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      isSuper?: boolean;
      phone?: string;
    };
  }
  interface User {
    id: string;
    role: string;
    phone?: string;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
        if (!credentials?.email || !credentials?.password) { log.warn('auth', 'login rejected: email or password missing'); return null; }

        const db = getAdminDb();
        const usersRef = db.collection('users');
        const snap = await usersRef.where('email', '==', credentials.email).limit(1).get();

        if (snap.empty) { log.warn('auth', 'login failed: no account with this email', { email: credentials.email }); return null; }

        const userDoc = snap.docs[0];
        const userData = userDoc.data();

        if (!userData.password) { log.warn('auth', 'login failed: account has no password (Google sign-in account?)', { email: credentials.email }); return null; }
        if (!userData.isActive) { log.warn('auth', 'login blocked: account is deactivated', { email: credentials.email }); throw new Error('Account is deactivated'); }

        const isValid = await bcrypt.compare(credentials.password, userData.password);
        if (!isValid) { log.warn('auth', 'login failed: wrong password', { email: credentials.email }); return null; }

        return {
          id: userDoc.id,
          email: userData.email,
          name: userData.displayName,
          image: userData.photoURL || null,
          role: userData.role || 'customer',
        };
        } catch (e: any) {
          if (e?.message === 'Account is deactivated') throw e;
          // A server fault (database down, bad keys), not a wrong password. Saved to Admin > Issues.
          log.error('auth', 'login crashed', { error: e?.message });
          void import('./issues').then(m => m.recordIssue({ route: 'login', method: 'POST', status: 500, message: String(e?.message || e) }));
          throw new Error('Login is temporarily unavailable. Please try again.');
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        // Upsert user in Firestore on Google sign-in
        const db = getAdminDb();
        const userRef = db.collection('users').doc(user.id);
        const snap = await userRef.get();

        if (!snap.exists) {
          await userRef.set({
            uid: user.id,
            email: user.email,
            displayName: user.name,
            photoURL: user.image,
            role: 'customer',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      // For Google sign-in, role isn't on the user object — fetch it from Firestore
      if (account?.provider === 'google' && !token.role) {
        try {
          const db = getAdminDb();
          const snap = await db.collection('users').doc(token.id as string).get();
          token.role = snap.exists ? snap.data()?.role || 'customer' : 'customer';
        } catch (e: any) {
          log.error('auth', 'could not read the user role from Firestore, defaulting to customer', { error: e?.message });
          token.role = 'customer';
        }
      }
      // Staff roles are re-read every 5 minutes, so removing someone's admin access works without waiting for their login to expire
      if ((token.role === 'admin' || token.isSuper) && token.id && Date.now() - Number(token.roleAt || 0) > 5 * 60_000) {
        try {
          const snap = await getAdminDb().collection('users').doc(token.id as string).get();
          const r = snap.exists ? String(snap.data()?.role || 'customer').toLowerCase() : 'customer';
          token.isSuper = r === 'superadmin'; token.role = r === 'superadmin' ? 'admin' : r; token.roleAt = Date.now();
        } catch { /* keep the current role if the database is unreachable */ }
      }
      // A superadmin acts as "admin" everywhere (existing checks keep working) and carries a flag for the 3 super-only tabs.
      if (token.role === 'superadmin') { token.role = 'admin'; token.isSuper = true; }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isSuper = !!token.isSuper;
      }
      return session;
    },
  },
};
