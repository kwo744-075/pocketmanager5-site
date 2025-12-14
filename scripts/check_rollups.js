#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

function parseArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a && a.startsWith(prefix));
  if (arg) return arg.slice(prefix.length);
  return process.env[name.toUpperCase()];
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(2);
  }

  const shop_id = parseArg('shop_id');
  const shop_number = parseArg('shop_number');
  const check_in_date = parseArg('check_in_date') || new Date().toISOString().split('T')[0];

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let resolvedShopId = shop_id;
  if (!resolvedShopId && shop_number) {
    const num = Number(shop_number);
    const { data: shop, error: shopErr } = await supabase
      .from('shops')
      .select('id,shop_number')
      .eq('shop_number', num)
      .maybeSingle();
    if (shopErr) {
      console.error('Failed to look up shop by shop_number:', shopErr);
      process.exit(1);
    }
    if (!shop || !shop.id) {
      console.error(`No shop found with shop_number=${shop_number}`);
      process.exit(2);
    }
    resolvedShopId = shop.id;
  }

  if (!resolvedShopId) {
    console.error('Provide --shop_id or --shop_number');
    process.exit(2);
  }

  console.log('Checking rollups for shop_id=', resolvedShopId, 'date=', check_in_date);

  // Helper to print results with date-field detection
  function findDateInRow(row) {
    if (!row) return null;
    const keys = Object.keys(row);
    for (const k of keys) {
      if (k.toLowerCase().includes('date') || k.toLowerCase().includes('day')) {
        return { key: k, value: row[k] };
      }
    }
    return null;
  }

  try {
    const { data: daily, error: dErr } = await supabase
      .from('shop_daily_totals')
      .select('*')
      .eq('shop_id', resolvedShopId)
      .limit(50);

    if (dErr) {
      console.warn('Query shop_daily_totals error:', dErr.message || dErr);
    } else {
      console.log('\nshop_daily_totals (up to 50 rows):');
      if (!daily || daily.length === 0) console.log('  (no rows returned)');
      else {
        daily.forEach((r, i) => {
          const df = findDateInRow(r);
          const match = df && String(df.value).startsWith(check_in_date);
          console.log(`  [${i}] ${match ? '*MATCH*' : '      '} ${JSON.stringify(r)}`);
        });
      }
    }

    const { data: wtd, error: wErr } = await supabase
      .from('shop_wtd_totals')
      .select('*')
      .eq('shop_id', resolvedShopId)
      .limit(50);

    if (wErr) {
      console.warn('Query shop_wtd_totals error:', wErr.message || wErr);
    } else {
      console.log('\nshop_wtd_totals (up to 50 rows):');
      if (!wtd || wtd.length === 0) console.log('  (no rows returned)');
      else {
        wtd.forEach((r, i) => {
          const df = findDateInRow(r);
          const match = df && String(df.value).startsWith(check_in_date);
          console.log(`  [${i}] ${match ? '*MATCH*' : '      '} ${JSON.stringify(r)}`);
        });
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed querying rollups:', err?.message || err);
    process.exit(1);
  }
}

main();
