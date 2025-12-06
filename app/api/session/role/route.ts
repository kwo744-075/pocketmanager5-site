import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ authenticated: false });

    return NextResponse.json({
      authenticated: true,
      user: { id: session.user.id, email: session.user.email ?? null },
      alignment: session.alignment ?? null,
    });
  } catch (err) {
    console.error('session role GET error', err);
    return NextResponse.json({ authenticated: false });
  }
}
