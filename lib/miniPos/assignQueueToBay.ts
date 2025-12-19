import { supabase } from "@/lib/supabaseClient";
import { createWorkingWo } from "./workingWos";

export async function assignQueueToBay(args: {
  queueId: string;
  bayId: 1 | 2 | 3;
  context: {
    shopId?: string | null;
    shopNumber?: number | null;
    districtName?: string | null;
    regionName?: string | null;
  };
}): Promise<{ workOrderId: string }> {
  const { queueId, bayId, context } = args;

  const { data: queueRow, error: queueError } = await supabase
    .from("mini_pos_queue")
    .select("*")
    .eq("id", queueId)
    .maybeSingle();

  if (queueError) throw queueError;
  if (!queueRow) throw new Error("Queue item not found");

  const customerInfo = {
    name: queueRow.customer_name ?? "",
    phone: queueRow.phone ?? "",
    email: queueRow.email ?? "",
  };

  const vehicleInfo = (queueRow.vehicle ?? null) as Record<string, unknown> | null;

  const wo = await createWorkingWo({
    bayId,
    shopNumber: context.shopNumber ?? queueRow.shop_number ?? null,
    districtName: context.districtName ?? null,
    regionName: context.regionName ?? null,
    payload: {
      cartItems: [],
      customerInfo,
      vehicleInfo: vehicleInfo ?? {},
      techAssignments: {},
      serviceNotes: queueRow.notes ?? "",
      discountInput: "",
      taxRatePctInput: "0",
    },
    totals: { subtotal: 0, discountAmount: 0, taxAmount: 0, totalDue: 0, paymentMethod: "cash" },
  });

  const { error: updateError } = await supabase
    .from("mini_pos_queue")
    .update({
      status: "assigned",
      assigned_bay_id: bayId,
      assigned_work_order_id: wo.id,
      shop_id: context.shopId ?? queueRow.shop_id ?? (queueRow.shop_number != null ? String(queueRow.shop_number) : null),
      shop_number: context.shopNumber ?? queueRow.shop_number ?? null,
    })
    .eq("id", queueId);

  if (updateError) throw updateError;

  return { workOrderId: wo.id };
}

