import { supabase } from "@/lib/supabaseClient";

export type ManualWorkOrderStatus = "draft" | "open" | "closed" | "archived";

export type ManualWorkOrderRow = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  shop_id: string | null;
  shop_number: number | null;
  district_name: string | null;
  region_name: string | null;
  bay_id?: number | null;
  status: ManualWorkOrderStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_due: number;
  payment_method: string | null;
  tendered_amount: number;
  change_due: number;
  cash_received: number;
  payload: Record<string, unknown>;
};

export type WorkingWoTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalDue: number;
  paymentMethod: string | null;
  tenderedAmount: number;
  changeDue: number;
  cashReceived: number;
};

export type CreateWorkingWoArgs = {
  bayId?: 1 | 2 | 3;
  shopNumber?: number | null;
  districtName?: string | null;
  regionName?: string | null;
  payload?: Record<string, unknown>;
  totals?: Partial<WorkingWoTotals>;
};

function normalizeTotals(input?: Partial<WorkingWoTotals>) {
  return {
    subtotal: Number(input?.subtotal ?? 0) || 0,
    discountAmount: Number(input?.discountAmount ?? 0) || 0,
    taxAmount: Number(input?.taxAmount ?? 0) || 0,
    totalDue: Number(input?.totalDue ?? 0) || 0,
    paymentMethod: input?.paymentMethod ?? null,
    tenderedAmount: Number(input?.tenderedAmount ?? 0) || 0,
    changeDue: Number(input?.changeDue ?? 0) || 0,
    cashReceived: Number(input?.cashReceived ?? 0) || 0,
  } satisfies WorkingWoTotals;
}

export async function createWorkingWo(args: CreateWorkingWoArgs) {
  const totals = normalizeTotals(args.totals);
  const shopNumber = typeof args.shopNumber === "number" ? args.shopNumber : null;
  const shopId = shopNumber != null ? String(shopNumber) : null;
  const bayId = args.bayId ?? 1;
  const { data, error } = await supabase
    .from("manual_work_orders")
    .insert([
      {
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        shop_id: shopId,
        shop_number: shopNumber,
        district_name: args.districtName ?? null,
        region_name: args.regionName ?? null,
        bay_id: bayId,
        status: "draft",
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_due: totals.totalDue,
        payment_method: totals.paymentMethod,
        tendered_amount: totals.tenderedAmount,
        change_due: totals.changeDue,
        cash_received: totals.cashReceived,
        payload: args.payload ?? {},
      },
    ])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as ManualWorkOrderRow;
}

export async function listWorkingWosByBay(bayId: 1 | 2 | 3) {
  const { data, error } = await supabase
    .from("manual_work_orders")
    .select("*")
    .in("status", ["draft", "open"])
    .eq("bay_id", bayId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ManualWorkOrderRow[];
}

export async function listWorkingWosAllBays() {
  const { data, error } = await supabase
    .from("manual_work_orders")
    .select("*")
    .in("status", ["draft", "open"])
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ManualWorkOrderRow[];
}

export async function listWorkOrdersAllBays(args?: { statuses?: ManualWorkOrderStatus[]; limit?: number }) {
  const statuses = args?.statuses?.length
    ? args.statuses
    : (["draft", "open", "closed", "archived"] as ManualWorkOrderStatus[]);
  const limit = args?.limit ?? 250;
  const { data, error } = await supabase
    .from("manual_work_orders")
    .select("*")
    .in("status", statuses as string[])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ManualWorkOrderRow[];
}

export async function getWorkingWo(id: string) {
  const { data, error } = await supabase.from("manual_work_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ManualWorkOrderRow | null;
}

export async function upsertWorkingWo(id: string, payload: Record<string, unknown>, totals: Partial<WorkingWoTotals>) {
  const normalized = normalizeTotals(totals);
  const { error } = await supabase
    .from("manual_work_orders")
    .update({
      subtotal: normalized.subtotal,
      discount_amount: normalized.discountAmount,
      tax_amount: normalized.taxAmount,
      total_due: normalized.totalDue,
      payment_method: normalized.paymentMethod,
      tendered_amount: normalized.tenderedAmount,
      change_due: normalized.changeDue,
      cash_received: normalized.cashReceived,
      payload,
      status: "open",
    })
    .eq("id", id);
  if (error) throw error;
}

export async function completeWorkingWo(id: string, payload: Record<string, unknown>, totals: Partial<WorkingWoTotals>) {
  const normalized = normalizeTotals(totals);
  const { error } = await supabase
    .from("manual_work_orders")
    .update({
      subtotal: normalized.subtotal,
      discount_amount: normalized.discountAmount,
      tax_amount: normalized.taxAmount,
      total_due: normalized.totalDue,
      payment_method: normalized.paymentMethod,
      tendered_amount: normalized.tenderedAmount,
      change_due: normalized.changeDue,
      cash_received: normalized.cashReceived,
      payload,
      status: "closed",
    })
    .eq("id", id);
  if (error) throw error;
}

export async function archiveWorkingWo(id: string) {
  const { error } = await supabase.from("manual_work_orders").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
}

export function subscribeWorkingWos(onChange: () => void) {
  const channel = supabase
    .channel("manual_work_orders_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "manual_work_orders" },
      () => onChange(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchWorkingWosRollup() {
  const { data, error } = await supabase.from("manual_work_orders_rollup_vw").select("wo_count_active, wo_total_active");
  if (error) throw error;
  const rows = (data ?? []) as Array<{ wo_count_active: number; wo_total_active: number }>;
  return rows.reduce(
    (acc, row) => {
      acc.count += Number(row.wo_count_active ?? 0) || 0;
      acc.total += Number(row.wo_total_active ?? 0) || 0;
      return acc;
    },
    { count: 0, total: 0 },
  );
}
