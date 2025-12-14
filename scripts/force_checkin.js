#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

function parseArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
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
  const time_slot = parseArg('time_slot') || '17:00';

  if (!shop_id) {
    if (!shop_number) {
      console.error('Provide shop_id via --shop_id=123 or provide --shop_number=447 (or SHOP_ID/SHOP_NUMBER env vars)');
      process.exit(2);
    }
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  // If a shop_number was provided, resolve it to the shop UUID in the `shops` table
  let resolvedShopId = shop_id;
  let resolvedShopNumber = null;
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
    resolvedShopNumber = shop.shop_number;
  }

  const payload = {
    shop_id: String(resolvedShopId),
    shop_number: resolvedShopNumber ?? (shop_id && null),
    check_in_date: String(check_in_date),
    time_slot: String(time_slot),
    cars: 0,
    sales: 0,
    big4: 0,
    coolants: 0,
    diffs: 0,
    donations: 0,
    mobil1: 0,
    fuel_filters: 0,
    temperature: null,
    is_submitted: true,
    submitted_at: new Date().toISOString(),
  };

  try {
    console.log('Upserting forced submitted check-in:', payload);
    // Try upsert and if PostgREST reports missing cached columns, retry after removing them.
    let attempt = 0;
    let toTry = { ...payload };
    let result = null;
    while (attempt < 4) {
      attempt += 1;
      result = await supabase
        .from('check_ins')
        .upsert([toTry], { onConflict: 'shop_id,check_in_date,time_slot' })
        .select('time_slot,is_submitted');

      if (!result.error) break;

      const msg = String(result.error.message || '').toLowerCase();
      // If PostgREST schema cache complaint like "Could not find the 'fuel_filters' column",
      // parse the missing column name(s) and remove them from payload, then retry.
      const missingCols = [];
      const colRegex = /could not find the '\\'?([^'\\]+)\\?' column/gi;
      let m;
      while ((m = colRegex.exec(String(result.error.message || ''))) !== null) {
        missingCols.push(m[1]);
      }

      // Fallback: also check for direct mentions
      if (missingCols.length === 0) {
        if (msg.includes('fuel_filters')) missingCols.push('fuel_filters');
        if (msg.includes('shop_number')) missingCols.push('shop_number');
      }

      if (missingCols.length === 0) {
        // Unknown error, break and report it.
        break;
      }

      for (const c of missingCols) {
        if (c && c !== 'shop_id' && c !== 'check_in_date' && c !== 'time_slot') {
          delete toTry[c];
          console.warn(`Removing missing column '${c}' from payload and retrying.`);
        }
      }
      // loop to retry
    }

    if (result && result.error) {
      console.error('Upsert error:', result.error);
      process.exit(1);
    }

    console.log('Upsert result:', result.data);
    process.exit(0);
  } catch (err) {
    console.error('Failed to upsert check-in:', err?.message || err);
    process.exit(1);
  }
}

main();
