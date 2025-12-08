"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCachedSummaryForLogin, normalizeLogin, writeHierarchySummaryCache } from "@/lib/hierarchyCache";

type HierarchyRow = {
  login?: string | null;
  scope_level?: string | null;
  division_name?: string | null;
  region_name?: string | null;
  district_name?: string | null;
  shop_number?: string | null;
  shops_in_district?: number | null;
  districts_in_region?: number | null;
  shops_in_region?: number | null;
  regions_in_division?: number | null;
  shops_in_division?: number | null;
};

function formatSummary(row: HierarchyRow | null): string {
  if (!row) return "Not signed in";

  const {
    scope_level,
    division_name,
    region_name,
    district_name,
    shop_number,
    shops_in_district,
    districts_in_region,
    shops_in_region,
    regions_in_division,
    shops_in_division,
  } = row;

  const level = scope_level?.toUpperCase();

  switch (level) {
    case "DIVISION":
      return `${division_name ?? "Division"} • ${
        regions_in_division ?? "?"
      } regions • ${shops_in_division ?? "?"} shops`;

    case "REGION":
      return `${region_name ?? "Region"} • ${
        districts_in_region ?? "?"
      } districts • ${shops_in_region ?? "?"} shops`;

    case "DISTRICT":
      return `${district_name ?? "District"} • ${
        shops_in_district ?? "?"
      } shops`;

    // For now everything in the view is SHOP-level, but this keeps us future-proof.
    case "SHOP":
    default:
      return `Shop ${shop_number ?? "?"} • ${
        district_name ?? "District"
      } • ${region_name ?? "Region"}`;
  }
}

type HierarchyStampProps = {
  align?: "left" | "right";
  loginEmail?: string | null;
  hierarchy?: HierarchyRow | null;
};

export function HierarchyStamp({ align = "right", loginEmail, hierarchy }: HierarchyStampProps) {
  const [summary, setSummary] = useState<string>("Loading…");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (hierarchy) {
      setSummary(formatSummary(hierarchy));
      setLoading(false);
      return;
    }

    const resolvedLogin = normalizeLogin(
      loginEmail ?? (typeof window !== "undefined" ? window.localStorage.getItem("loginEmail") : null)
    );

    const cached = getCachedSummaryForLogin(resolvedLogin);
    if (cached) {
      setSummary(formatSummary(cached as HierarchyRow));
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (!resolvedLogin) {
      if (!cached) {
        setSummary("Not signed in");
        setLoading(false);
      }
      return;
    }

    const run = async () => {
      try {
        // If loginEmail matches the current local login, prefer server API (uses normalized tables)
        const localLogin = typeof window !== "undefined" ? window.localStorage.getItem("loginEmail") : null;
        let parsed: HierarchyRow | null = null;

        if (!loginEmail || normalizeLogin(loginEmail) === normalizeLogin(localLogin)) {
          // current user — call server API
          try {
            const resp = await fetch("/api/hierarchy/summary", { credentials: "same-origin" });
            if (resp.ok) {
              const body = await resp.json();
              parsed = body?.data ?? null;
            } else {
              console.error("HierarchyStamp API status", resp.status);
            }
          } catch (apiErr) {
            console.error("HierarchyStamp API error", apiErr);
          }
        }

        // If we still don't have parsed summary, fall back to the legacy view lookup
        if (!parsed) {
          const { data, error } = await supabase
            .from("hierarchy_summary_vw")
            .select("*")
            .eq("login", resolvedLogin)
            .maybeSingle();
          if (error) {
            console.error("hierarchy_summary_vw error", error);
          } else {
            parsed = (data as HierarchyRow | null) ?? null;
          }
        }

        if (cancelled) return;

        setSummary(formatSummary(parsed));
        if (parsed) writeHierarchySummaryCache(parsed);
      } catch (err) {
        if (!cancelled) {
          console.error("HierarchyStamp error", err);
          if (!cached) setSummary("Hierarchy unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [hierarchy, loginEmail]);

  const alignmentClass = align === "left" ? "text-left" : "text-right";

  return (
    <div className={`text-[11px] text-slate-400 ${alignmentClass} max-w-xs leading-snug`}>
      {loading ? "Loading…" : summary}
    </div>
  );
}
