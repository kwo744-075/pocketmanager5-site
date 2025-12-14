import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/auth/session';

type RoleKind = 'Shop' | 'DM' | 'RD' | 'VP' | 'Unknown';

interface AlignmentMembership {
  role?: string | null;
}

interface Alignment {
  memberships?: AlignmentMembership[] | null;
}

interface CadenceRow {
  id?: number;
  scope: 'company' | 'shop' | string;
  scope_id?: string | null;
  day: string;
  tasks: string | string[] | null;
  created_by?: string | null;
  updated_at?: string | null;
}

function deriveUserRole(alignment: Alignment): RoleKind {
  if (!alignment?.memberships || alignment.memberships.length === 0) return 'Unknown';
  const roles = alignment.memberships.map((m) => String(m.role ?? '').toLowerCase());
  if (roles.some((r) => r.includes('vp'))) return 'VP';
  if (roles.some((r) => r.includes('rd') || r.includes('regional'))) return 'RD';
  if (roles.some((r) => r.includes('dm') || r.includes('district'))) return 'DM';
  if (roles.some((r) => r.includes('shop') || r.includes('employee') || r.includes('ops'))) return 'Shop';
  return 'Unknown';
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const url = new URL(req.url);
    const shopId = url.searchParams.get('shopId');

    const admin = getSupabaseAdmin();
    // prefer shop-level templates, fallback to company/global
    const rows: CadenceRow[] = [];
    if (shopId) {
      const { data: shopRows, error: shopErr } = await admin
        .from('cadence_templates')
        .select('*')
        .eq('scope', 'shop')
        .eq('scope_id', String(shopId));
      if (!shopErr && shopRows) rows.push(...(shopRows as CadenceRow[]));
    }

    // company-level
    const { data: companyRows, error: compErr } = await admin
      .from('cadence_templates')
      .select('*')
      .eq('scope', 'company');

    if (!compErr && companyRows) rows.push(...(companyRows as CadenceRow[]).filter((r) => !rows.find((x) => x.day === r.day)));

    // build a map day->tasks
    const map: Record<string, string[]> = {};
    rows.forEach((r) => {
      try {
        if (Array.isArray(r.tasks)) map[r.day] = r.tasks as string[];
        else if (typeof r.tasks === 'string') {
          // tasks might be stored as JSON string or newline-separated
          try {
            const parsed = JSON.parse(r.tasks);
            map[r.day] = Array.isArray(parsed) ? parsed.map(String) : String(r.tasks).split('\n').map((s) => s.trim()).filter(Boolean);
          } catch {
            map[r.day] = String(r.tasks).split('\n').map((s) => s.trim()).filter(Boolean);
          }
        } else {
          map[r.day] = [];
        }
      } catch {
        map[r.day] = [];
      }
    });

    return NextResponse.json({ data: map });
  } catch (err) {
    console.error('cadence templates GET error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    type PostBody = {
      scope?: 'company' | 'shop' | string;
      scopeId?: string | null;
      day?: string;
      tasks?: string[] | string;
    };

    const body = (await req.json()) as PostBody | null;
    const day = body?.day;
    const tasksRaw = body?.tasks;
    const scope = body?.scope ?? 'company';
    const scopeId = body?.scopeId ?? null;

    if (!day || !tasksRaw) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const userRole = deriveUserRole(session.alignment as Alignment);
    if (!(userRole === 'RD' || userRole === 'VP' || userRole === 'DM')) {
      // allow DM/RD/VP (DMs sometimes manage cadence for shops they oversee)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();

    // normalize tasks into string[]
    const tasks = Array.isArray(tasksRaw)
      ? tasksRaw.map(String).map((s) => s.trim()).filter(Boolean)
      : typeof tasksRaw === 'string'
      ? tasksRaw.split('\n').map((s) => s.trim()).filter(Boolean)
      : [];

    // upsert based on scope/scope_id/day
    const payload: CadenceRow = {
      scope,
      scope_id: scopeId,
      day,
      // store tasks as a JSON string to match DB text column expectations
      tasks: JSON.stringify(tasks),
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin.from('cadence_templates').upsert([payload], { onConflict: 'scope,scope_id,day' }).select().maybeSingle();
    if (error) {
      console.error('cadence templates upsert failed', error);
      return NextResponse.json({ error: 'Upsert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('cadence templates POST error', err);
    return NextResponse.json({ error: 'Invalid JSON or server error' }, { status: 400 });
  }
}
