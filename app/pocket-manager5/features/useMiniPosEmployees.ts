import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type MiniPosEmployeeOption = { id: string; name: string };

export function useMiniPosEmployees(shopNumber?: string | null) {
  const [employees, setEmployees] = useState<MiniPosEmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopNumber) {
      return;
    }
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("shop_staff")
        .select("id, staff_name")
        .eq("shop_id", shopNumber)
        .order("staff_name", { ascending: true })
        .limit(100);
      if (!active) return;
      if (error) {
        console.error("mini-pos employees load failed", error);
        setEmployees(buildFallbackEmployees(shopNumber));
      } else {
        const options = (data ?? []).map((row) => ({
          id: row.id as string,
          name: (row.staff_name as string | null) ?? "Unnamed",
        }));
        setEmployees(options.length ? options : buildFallbackEmployees(shopNumber));
      }
      setLoading(false);
    };
    void load();

    return () => {
      active = false;
    };
  }, [shopNumber]);

  return { employees: shopNumber ? employees : [], loading: shopNumber ? loading : false };
}

function buildFallbackEmployees(shopNumber: string): MiniPosEmployeeOption[] {
  // Testing fallback so Mini POS tech dropdowns are usable even before roster data is seeded.
  return Array.from({ length: 5 }).map((_, idx) => ({
    id: `test-${shopNumber}-${idx + 1}`,
    name: `Test Employee ${idx + 1}`,
  }));
}
