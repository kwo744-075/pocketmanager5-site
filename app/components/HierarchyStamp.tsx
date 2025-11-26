"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type HierarchyRow = {
  login: string;
  scope_level: string;
  division_name: string | null;
  region_name: string | null;
  district_name: string | null;
  shop_number: string | null;
  shops_in_district: number | null;
  districts_in_region: number | null;
  shops_in_region: number | null;
  regions_in_division: number | null;
  shops_in_division: number | null;
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

export function HierarchyStamp() {
  const [summary, setSummary] = useState<string>("Loading…");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        // We stored this on successful login
        const loginEmail =
          typeof window !== "undefined"
            ? window.localStorage.getItem("loginEmail")
            : null;

        if (!loginEmail) {
          setSummary("Not signed in");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("*")
          .eq("login", loginEmail.toLowerCase())
          .maybeSingle();

        if (error) {
          console.error("hierarchy_summary_vw error", error);
          setSummary("Hierarchy unavailable");
        } else {
          setSummary(formatSummary(data as HierarchyRow | null));
        }
      } catch (err) {
        console.error("HierarchyStamp error", err);
        setSummary("Hierarchy unavailable");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <div className="text-[11px] text-slate-400 text-right max-w-xs leading-snug">
      {loading ? "Loading…" : summary}
    </div>
  );
}
