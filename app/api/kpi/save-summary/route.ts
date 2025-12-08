import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

type SummaryRow = {
  shop: string;
  shop_id?: number | null;
  sales?: number | null;
  cars?: number | null;
  big4?: number | null;
  mobil1?: number | null;
  coolants?: number | null;
  diffs?: number | null;
  donations?: number | null;
  [k: string]: any;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, filename, source, notes, summary } = body as {
      date?: string;
      filename?: string | null;
      source?: string | null;
      notes?: string | null;
      summary: SummaryRow[];
    };

    if (!summary || !Array.isArray(summary) || summary.length === 0) {
      return NextResponse.json({ error: 'summary required' }, { status: 400 });
    }

    const day = date || new Date().toISOString().slice(0, 10);

    const uploadPayload = {
      uploaded_at: new Date().toISOString(),
      filename: filename ?? null,
      source: source ?? 'dm-daily-review',
      notes: notes ?? null,
      payload: { summary_count: summary.length, included_kpis: body.included_kpis ?? null },
    };

    const up = await supabaseServer.from('kpi_uploads').insert(uploadPayload).select('id').maybeSingle();
    if (up.error) {
      console.error('kpi_uploads.insert error', up.error);
      return NextResponse.json({ error: up.error.message }, { status: 500 });
    }

    const upload_id = up.data?.id;
    if (!upload_id) {
      return NextResponse.json({ error: 'failed to create upload record' }, { status: 500 });
    }

    const rows = (summary as SummaryRow[]).map((s) => ({
      upload_id,
      shop: String(s.shop ?? '(unknown)'),
      shop_id: s.shop_id ?? null,
      day,
      sales: s.sales ?? null,
      cars: s.cars ?? null,
      big4: s.big4 ?? null,
      mobil1: s.mobil1 ?? null,
      coolants: s.coolants ?? null,
      diffs: s.diffs ?? null,
      donations: s.donations ?? null,
    }));

    const ins = await supabaseServer.from('kpi_shop_metrics').insert(rows);
    if (ins.error) {
      console.error('kpi_shop_metrics.insert error', ins.error);
      return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, upload_id, inserted: ins.data?.length ?? rows.length });
  } catch (err: any) {
    console.error('save-summary error', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
