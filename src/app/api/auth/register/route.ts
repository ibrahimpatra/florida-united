import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminDb } from '@/lib/firebase-admin';
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
    const existing = await db.collection('users').where('email', '==', email).limit(1).get();

    if (!existing.empty) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const ref = db.collection('users').doc();
    await ref.set({
      uid: ref.id,
      email,
      displayName: name,
      phone: phone || null,
      password: hashed,
      role: 'customer',
      isActive: true,
      photoURL: null,
      addresses: [],
      createdAt: now,
      updatedAt: now,
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(console.error);

    return NextResponse.json({ success: true, message: 'Account created successfully' });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
