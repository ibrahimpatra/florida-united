import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = getAdminDb();
    const adminAuth = getAdminAuth();

    // Check Firestore for existing user
    const existing = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Also check Firebase Auth
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    } catch {
      // user-not-found is expected — continue
    }

    // 1. Create in Firebase Authentication (shows in Auth tab)
    const firebaseUser = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone ? (phone.startsWith('+') ? phone : `+${phone}`) : undefined,
      disabled: false,
    });

    // 2. Save full profile to Firestore users collection
    // Use the Firebase Auth UID as the Firestore doc ID so they stay in sync
    const hashed = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    await db.collection('users').doc(firebaseUser.uid).set({
      uid: firebaseUser.uid,
      email,
      displayName: name,
      phone: phone || null,
      password: hashed,           // kept for NextAuth credentials login
      role: 'customer',
      isActive: true,
      photoURL: null,
      addresses: [],
      createdAt: now,
      updatedAt: now,
    });

    // 3. Send welcome email (non-blocking — won't fail registration if email fails)
    sendWelcomeEmail(email, name).catch(() => {
      console.warn('Welcome email failed — check EMAIL_USER and EMAIL_PASSWORD in .env.local');
    });

    return NextResponse.json({ success: true, message: 'Account created successfully' });
  } catch (err: any) {
    console.error('Register error:', err);

    // Return Firebase Auth specific errors as readable messages
    if (err?.errorInfo?.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    if (err?.errorInfo?.code === 'auth/invalid-email') {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (err?.errorInfo?.code === 'auth/weak-password') {
      return NextResponse.json({ error: 'Password is too weak' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}