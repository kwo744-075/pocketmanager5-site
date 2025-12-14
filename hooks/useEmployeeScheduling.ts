import { supabase } from "@/lib/supabaseClient";

export type Staff = { id: string; staff_name?: string | null; primary_role?: string | null };
export type Shift = {
  id?: string;
  employee_id: string;
  shop_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  kind?: string | null;
};

export type Projections = {
  formulation_factor: number | null;
  sunday_cars: number | null;
  monday_cars: number | null;
  tuesday_cars: number | null;
  wednesday_cars: number | null;
  thursday_cars: number | null;
  friday_cars: number | null;
  saturday_cars: number | null;
};

export async function getSchedules(shopId: string, weekStartISO: string) {
  const weekEndISO = new Date(weekStartISO);
  weekEndISO.setDate(weekEndISO.getDate() + 6);
  const endISO = weekEndISO.toISOString().slice(0, 10);

  const [staffResp, shiftsResp, projResp] = await Promise.all([
    supabase.from("shop_staff").select("id, staff_name, primary_role").eq("shop_id", shopId).order("staff_name"),
    supabase
      .from("employee_shifts")
      .select("id, employee_id, shop_id, date, start_time, end_time, break_minutes, kind")
      .eq("shop_id", shopId)
      .gte("date", weekStartISO)
      .lte("date", endISO)
      .limit(1000),
    supabase
      .from("weekly_projections")
      .select(
        "formulation_factor, sunday_cars, monday_cars, tuesday_cars, wednesday_cars, thursday_cars, friday_cars, saturday_cars",
      )
      .eq("shop_id", shopId)
      .eq("week_start_date", weekStartISO)
      .maybeSingle(),
  ]);

  const staff = Array.isArray(staffResp.data) ? (staffResp.data as Staff[]) : [];
  const shifts = Array.isArray(shiftsResp.data) ? (shiftsResp.data as Shift[]) : [];
  const projections = (projResp.data as Projections) ?? null;

  return { staff, shifts, projections };
}

export async function getStaff(shopId: string) {
  const { data } = await supabase.from("shop_staff").select("id, staff_name, primary_role").eq("shop_id", shopId).order("staff_name");
  return Array.isArray(data) ? (data as Staff[]) : [];
}

async function postAction(action: string, payload: unknown) {
  const resp = await fetch("/api/pocket-manager/employee-shifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json?.error ?? "Request failed");
  return json;
}

export async function createShift(payload: Partial<Shift>) {
  return postAction("create", payload);
}

export async function updateShift(payload: Partial<Shift>) {
  return postAction("update", payload);
}

export async function deleteShift(id: string) {
  return postAction("delete", { id });
}

export function subscribeToChanges(shopId: string, callback: () => void) {
  try {
    const channel = supabase
      .channel(`employee_shifts_changes_${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_shifts", filter: `shop_id=eq.${shopId}` },
        () => {
          // small debounce could be applied by caller
          callback();
        },
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel as any);
      } catch (err) {
        // ignore
      }
    };
  } catch (err) {
    // return noop unsubscribe on failure
    return () => {};
  }
}

export default {
  getSchedules,
  getStaff,
  createShift,
  updateShift,
  deleteShift,
  subscribeToChanges,
};
