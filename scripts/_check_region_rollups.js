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

  const shop_number = parseArg('shop_number');
  const check_in_date = parseArg('check_in_date') || new Date().toISOString().split('T')[0];

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (!shop_number) {
    console.error('Provide --shop_number');
    process.exit(2);
  }

  const num = Number(shop_number);
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select('id,shop_number,shop_name,district_id,region_id')
    .eq('shop_number', num)
    .maybeSingle();

  if (shopErr) {
    console.error('Failed to look up shop:', shopErr);
    process.exit(1);
  }
  if (!shop || !shop.id) {
    console.error('Shop not found for shop_number=', shop_number);
    process.exit(2);
  }

  const shopId = shop.id;
  console.log('Shop:', shop.shop_number, shop.shop_name, 'id=', shopId);

  try {
    const { data: dailyDistrict, error: ddErr } = await supabase
      .from('district_daily_totals')
      .select('*')
      .eq('district_id', shop.district_id)
      .limit(20);

    if (ddErr) console.warn('district_daily_totals query error:', ddErr.message || ddErr);
    else console.log('\ndistrict_daily_totals (sample):', JSON.stringify(dailyDistrict || [], null, 2));

    const { data: wtdDistrict, error: dwErr } = await supabase
      .from('district_wtd_totals')
      .select('*')
      .eq('district_id', shop.district_id)
      .limit(20);

    if (dwErr) console.warn('district_wtd_totals query error:', dwErr.message || dwErr);
    else console.log('\ndistrict_wtd_totals (sample):', JSON.stringify(wtdDistrict || [], null, 2));

    const { data: dailyRegion, error: rdErr } = await supabase
      .from('region_daily_totals')
      .select('*')
      .eq('region_id', shop.region_id)
      .limit(20);

    if (rdErr) console.warn('region_daily_totals query error:', rdErr.message || rdErr);
    else console.log('\nregion_daily_totals (sample):', JSON.stringify(dailyRegion || [], null, 2));

    const { data: wtdRegion, error: rwErr } = await supabase
      .from('region_wtd_totals')
      .select('*')
      .eq('region_id', shop.region_id)
      .limit(20);

    if (rwErr) console.warn('region_wtd_totals query error:', rwErr.message || rwErr);
    else console.log('\nregion_wtd_totals (sample):', JSON.stringify(wtdRegion || [], null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Failed checking rollups:', err?.message || err);
    process.exit(1);
  }
}

main();
