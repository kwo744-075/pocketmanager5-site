import { supabase } from "@/lib/supabaseClient";
import type { PostgrestError } from "@supabase/supabase-js";

export type MiniPosButtonSummary = {
  id: string;
  label: string;
  color: string | null;
  nestedCount: number;
};

export type MiniPosOverview = {
  buttonCount: number;
  nestedCount: number;
  sampleButtons: MiniPosButtonSummary[];
  employeeCount: number;
};

const EMPTY_OVERVIEW: MiniPosOverview = {
  buttonCount: 0,
  nestedCount: 0,
  sampleButtons: [],
  employeeCount: 0,
};

type MainButtonRow = {
  id: string;
  button_name: string | null;
  button_color: string | null;
};

type NestedButtonRow = {
  id: string;
  parent_button_id: string | null;
};

const handleList = async <T,>(promise: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>, label: string) => {
  try {
    const { data, error } = await promise;
    if (error) {
      console.error(`[MiniPOS] ${label} error`, error);
      return [] as T[];
    }
    return (data ?? []) as T[];
  } catch (error) {
    console.error(`[MiniPOS] ${label} exception`, error);
    return [] as T[];
  }
};

export async function fetchMiniPosOverview(shopIdInput: string | null | undefined): Promise<MiniPosOverview> {
  const shopId = shopIdInput?.toString();
  if (!shopId) {
    return { ...EMPTY_OVERVIEW };
  }

  const mainButtons = await handleList<MainButtonRow>(
    supabase
      .from("pos_buttons")
      .select("id, button_name, button_color")
      .eq("shop_id", shopId)
      .is("parent_button_id", null)
      .eq("is_active", true)
      .order("sort_index")
      .limit(48),
    "pos_buttons"
  );

  const mainIds = mainButtons.map((button) => button.id);
  const nestedButtons = mainIds.length
    ? await handleList<NestedButtonRow>(
        supabase
          .from("pos_nested_buttons")
          .select("id, parent_button_id")
          .in("parent_button_id", mainIds)
          .eq("is_active", true),
        "pos_nested_buttons"
      )
    : [];

  const { count: employeeCount } = await supabase
    .from("shop_staff")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);

  const sampleButtons: MiniPosButtonSummary[] = mainButtons.slice(0, 6).map((button) => ({
    id: button.id,
    label: button.button_name ?? "Unnamed",
    color: button.button_color ?? null,
    nestedCount: nestedButtons.filter((nested) => nested.parent_button_id === button.id).length,
  }));

  return {
    buttonCount: mainButtons.length,
    nestedCount: nestedButtons.length,
    sampleButtons,
    employeeCount: employeeCount ?? 0,
  } satisfies MiniPosOverview;
}
