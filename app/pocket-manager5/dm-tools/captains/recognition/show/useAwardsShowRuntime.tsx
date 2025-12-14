"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

type RuntimeState = {
  id?: string;
  status: string;
  theme_id: string;
  current_slide_index: number;
};

export function useAwardsShowRuntime({ year, period_no, createIfMissing = false }: { year: number; period_no: number; createIfMissing?: boolean }) {
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("awards_show_runtime")
      .select("*")
      .eq("year", year)
      .eq("period_no", period_no)
      .limit(1)
      .single();
    if (error && createIfMissing) {
      const { data: ins } = await supabase.from("awards_show_runtime").insert({ year, period_no }).select().single();
      if (ins) setRuntime(ins as RuntimeState);
      return;
    }
    if (data) setRuntime(data as RuntimeState);
  }, [year, period_no, createIfMissing]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`awards_show_runtime:${year}:${period_no}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "awards_show_runtime", filter: `year=eq.${year},period_no=eq.${period_no}` }, (payload) => {
        const newRow = payload.new as RuntimeState;
        setRuntime(newRow);
      })
      .subscribe();

    return () => {
      try {
        void supabase.removeChannel(channel);
      } catch (e) {}
    };
  }, [load, year, period_no]);

  const update = useCallback(async (patch: Partial<RuntimeState>) => {
    if (!runtime) return null;
    const { data } = await supabase.from("awards_show_runtime").update(patch).match({ id: runtime.id }).select().single();
    if (data) setRuntime(data as RuntimeState);
    return data;
  }, [runtime]);

  return { runtime, reload: load, update };
}

export default useAwardsShowRuntime;
