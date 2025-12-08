#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and retry.');
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  try {
    console.log('Querying active test_runs...');
    const { data: rows, error: fetchErr } = await supabase
      .from('test_runs')
      .select('id,status,started_at')
      .eq('status', 'active');

    if (fetchErr) throw fetchErr;

    if (!rows || rows.length === 0) {
      console.log('No active test_runs found. Nothing to clear.');
      process.exit(0);
    }

    console.log(`Found ${rows.length} active test_runs; deleting...`);

    const ids = rows.map((r) => r.id);
    const { error: delErr } = await supabase.from('test_runs').delete().in('id', ids);

    if (delErr) throw delErr;
    console.log('Deleted active test_runs rows:', ids.join(', '));
    process.exit(0);
  } catch (err) {
    console.error('Failed to clear active test_runs:', err?.message || err);
    process.exit(1);
  }
}

main();
