import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getRetailPeriodInfo } from "@/app/pocket-manager5/components/dmScheduleUtils";

type Payload = {
  periodId?: string;
  scope?: { shopNumbers?: number[] };
  assumptions?: {
    weeks: Array<{ weekIndex: number; daysOff?: string; adminDays?: string }>;
    maxVisitsPerDay?: number;
    allowDouble?: boolean;
    preferEarlyAudit?: boolean;
    proximityGroups?: Array<{ label: string; shops: number[] }>;
  };
};

const VISIT_TYPES = {
  planToWin: "Plan To Win",
  standard: "Standard Visit",
  quarterly: "Quarterly Audit",
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pickDates(periodStart: Date, weeks: number) {
  const days: Date[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(periodStart);
    d.setDate(periodStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;
    const periodInfo = getRetailPeriodInfo(new Date());
    const periodId = body.periodId ?? `P${periodInfo.period}-${periodInfo.startDate.getFullYear()}`;
    const shops = body.scope?.shopNumbers?.length ? body.scope.shopNumbers : [1501, 1502, 1503, 1504, 1505];
    const days = pickDates(periodInfo.startDate, periodInfo.weeksInPeriod);
    const lastTwoWeeksStart = periodInfo.weeksInPeriod >= 4 ? (periodInfo.weeksInPeriod - 2) * 7 : Math.max(days.length - 14, 0);
    const firstTwoWeeksEnd = Math.min(14, days.length);

    const planWindow = days.slice(0, firstTwoWeeksEnd);
    const quarterlyWindow = days.slice(lastTwoWeeksStart);
    const middleWindow = days.filter((d) => d >= planWindow[planWindow.length - 1] && d <= quarterlyWindow[0]);

    const rows: Array<{ shop_number: number; period_id: string; visit_date: string; visit_type: string; source: string }> = [];

    const clusterMap: Array<number[]> =
      body.assumptions?.proximityGroups?.length
        ? body.assumptions.proximityGroups.map((c) => c.shops.filter((n) => !Number.isNaN(n)))
        : [];

    const assignShop = (shop: number, shopIdx: number, seed = 0) => {
      const planDay = planWindow[(shopIdx + 1 + seed) % planWindow.length] ?? planWindow[0];
      const standardDay = middleWindow[(shopIdx + 2 + seed) % Math.max(middleWindow.length, 1)] ?? planDay;
      const quarterlyDay = quarterlyWindow[(shopIdx + 3 + seed) % quarterlyWindow.length] ?? standardDay;

      rows.push({
        shop_number: shop,
        period_id: periodId,
        visit_date: iso(planDay),
        visit_type: VISIT_TYPES.planToWin,
        source: "ai",
      });
      rows.push({
        shop_number: shop,
        period_id: periodId,
        visit_date: iso(standardDay),
        visit_type: VISIT_TYPES.standard,
        source: "ai",
      });
      rows.push({
        shop_number: shop,
        period_id: periodId,
        visit_date: iso(quarterlyDay),
        visit_type: VISIT_TYPES.quarterly,
        source: "ai",
      });
    };

    // Assign clusters first to keep nearby shops on same day seed
    let idx = 0;
    clusterMap.forEach((cluster) => {
      const seed = idx;
      cluster.forEach((shop) => {
        assignShop(shop, idx, seed);
        idx += 1;
      });
    });
    // Remaining shops
    shops.forEach((shop, shopIdx) => {
      if (clusterMap.some((c) => c.includes(shop))) return;
      assignShop(shop, shopIdx);
    });

    const { error } = await supabaseServer.rpc("upsert_dm_schedule_rows", { rows });
    if (error) {
      console.error("ai-generate upsert failed", error);
      return NextResponse.json({ error: "upsert failed" }, { status: 500 });
    }

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err) {
    console.error("ai-generate error", err);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
