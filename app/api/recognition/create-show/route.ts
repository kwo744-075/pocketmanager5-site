import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Minimal create-show implementation: return a generated showId
    const showId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now());
    return NextResponse.json({ showId });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
