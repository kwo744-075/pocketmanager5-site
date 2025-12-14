import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  MiniPosSessionPayload,
  MiniPosSessionListResponse,
  PersistedMiniPosSession,
} from '@/app/pocket-manager5/features/miniPosTypes';

const SESSION_SELECT = `
  *,
  cart:pos_cart_items (*),
  customer:pos_customer_capture ( * ),
  vehicle:pos_vehicle_capture ( * )
`;

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const shopId = search.get('shopId');

  if (!shopId) {
    return NextResponse.json({ error: 'shopId query param is required' }, { status: 400 });
  }

  const status = search.get('status');
  const limit = Number(search.get('limit') ?? '10');

  let query = supabaseServer
    .from('pos_sessions')
    .select(SESSION_SELECT)
    .eq('shop_id', shopId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('session_status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to load mini POS sessions', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }

  const response: MiniPosSessionListResponse = {
    sessions: (data as PersistedMiniPosSession[]) ?? [],
  };

  return NextResponse.json(response);
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as MiniPosSessionPayload;

    if (!payload.shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseServer.rpc('rpc_save_pos_session', {
      payload,
    });

    if (error) {
      console.error('rpc_save_pos_session failed', error);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: data });
  } catch (err) {
    console.error('Unexpected mini POS save error', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
