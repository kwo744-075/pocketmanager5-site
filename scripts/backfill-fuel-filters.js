#!/usr/bin/env node
/*
Safe backfill helper: iterates shops and updates fuel_filters totals
for `shop_daily_totals` and `shop_wtd_totals` in separate transactions to
avoid long-running single transactions and reduce lock contention.

Usage:
  1) Install dependency: `npm install pg`
  2) Set connection env vars: PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
  3) Run: `node scripts/backfill-fuel-filters.js`

Note: run from a machine close to the DB (CI runner or dedicated admin machine).
*/

const { Client } = require('pg');

async function main() {
  const client = new Client();
  await client.connect();

  try {
    console.log('Gathering shop ids to process...');
    const res = await client.query(`SELECT DISTINCT shop_id FROM check_ins WHERE is_submitted = true`);
    const shopIds = res.rows.map(r => r.shop_id).filter(Boolean);
    console.log(`Found ${shopIds.length} shops with submitted check_ins`);

    for (let i = 0; i < shopIds.length; i++) {
      const shopId = shopIds[i];
      console.log(`Processing (${i+1}/${shopIds.length}): shop_id=${shopId}`);

      // Update shop_daily_totals for this shop
      await client.query('BEGIN');
      try {
        await client.query(
          `UPDATE shop_daily_totals s
           SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
           FROM (
             SELECT shop_id, check_in_date, COALESCE(SUM(fuel_filters), 0) AS total_fuel_filters
             FROM check_ins
             WHERE is_submitted = true AND shop_id = $1
             GROUP BY shop_id, check_in_date
           ) src
           WHERE s.shop_id = src.shop_id
             AND s.check_in_date = src.check_in_date`,
          [shopId]
        );

        // Update shop_wtd_totals for this shop
        await client.query(
          `UPDATE shop_wtd_totals w
           SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
           FROM (
             SELECT shop_id, week_start, COALESCE(SUM(total_fuel_filters), 0) AS total_fuel_filters
             FROM shop_daily_totals
             WHERE shop_id = $1
             GROUP BY shop_id, week_start
           ) src
           WHERE w.shop_id = src.shop_id
             AND w.week_start = src.week_start`,
          [shopId]
        );

        await client.query('COMMIT');
        console.log(`Completed shop ${shopId}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing shop ${shopId}:`, err.message || err);
      }
    }

    console.log('Backfill complete.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
