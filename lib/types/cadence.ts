export type DmListItemStatus = "pending" | "completed";
export type DmListResolutionType = "complete" | "called_in" | "ordered";

export type DmListItem = {
  id: string;
  created_at: string;
  created_by_user_id?: string;
  created_by_role?: "Shop" | "DM" | "RD" | "VP" | string;
  shop_id?: string | null;
  district_id?: string | null;
  region_id?: string | null;
  target_role: "DM" | "RD" | "VP" | string;
  message: string;
  category: "Ops" | "People" | "Inventory" | "HR" | "Other";
  priority: "Low" | "Normal" | "High";
  status: DmListItemStatus;
  resolution_type?: DmListResolutionType | null;
  carry_forward_until_completed: boolean;
  effective_date: string; // ISO date
  last_rolled_date?: string | null;
  completed_at?: string | null;
};
