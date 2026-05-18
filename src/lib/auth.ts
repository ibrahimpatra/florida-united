// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
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
        if (!credentials?.email || !credentials?.password) return null;

        const db = getAdminDb();
        const usersRef = db.collection('users');
        const snap = await usersRef.where('email', '==', credentials.email).limit(1).get();

        if (snap.empty) return null;

        const userDoc = snap.docs[0];
        const userData = userDoc.data();

        if (!userData.password) return null;
        if (!userData.isActive) throw new Error('Account is deactivated');

        const isValid = await bcrypt.compare(credentials.password, userData.password);
        if (!isValid) return null;

        return {
          id: userDoc.id,
          email: userData.email,
          name: userData.displayName,
          image: userData.photoURL || null,
          role: userData.role || 'customer',
        };
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
        } catch {
          token.role = 'customer';
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
