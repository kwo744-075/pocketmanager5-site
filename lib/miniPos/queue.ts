import { supabase } from "@/lib/supabaseClient";

export type MiniPosQueueStatus = "new" | "assigned" | "closed";

export type MiniPosQueueRow = {
  id: string;
  created_at: string;
  updated_at: string;
  shop_number: number | null;
  shop_id: string | null;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  vehicle: Record<string, unknown> | null;
  notes: string | null;
  status: MiniPosQueueStatus;
  assigned_bay_id: number | null;
  assigned_work_order_id: string | null;
};

export async function listQueue(shopNumber: number) {
  const { data, error } = await supabase
    .from("mini_pos_queue")
    .select("*")
    .eq("shop_number", shopNumber)
    .in("status", ["new"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as MiniPosQueueRow[];
}

export function subscribeQueue(shopNumber: number, onChange: () => void) {
  const channel = supabase
    .channel(`mini_pos_queue_${shopNumber}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "mini_pos_queue", filter: `shop_number=eq.${shopNumber}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

