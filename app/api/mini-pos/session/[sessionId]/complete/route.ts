import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { MiniPosCompletePayload } from '@/app/pocket-manager5/features/miniPosTypes';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId param required' }, { status: 400 });
  }

  try {
    const payload = (await req.json()) as MiniPosCompletePayload;

    const { error } = await supabaseServer.rpc('rpc_close_pos_session', {
      session_id: sessionId,
      payload,
    });

    if (error) {
      console.error('rpc_close_pos_session failed', error);
      return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
    }

    return NextResponse.json({ sessionId });
  } catch (err) {
    console.error('Mini POS complete error', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
