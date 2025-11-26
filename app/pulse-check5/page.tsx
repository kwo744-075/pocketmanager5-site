"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { RetailPills } from "@/app/components/RetailPills";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";

type HierarchyRow = {
  login: string;
  scope_level: string | null;
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

const cardBaseClasses =
  "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-black/20";

export default function PulseCheckPage() {
  const router = useRouter();
  const [hierarchy, setHierarchy] = useState<HierarchyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loginEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem("loginEmail")
        : null;

    if (!loginEmail) {
      router.replace("/login");
      return;
    }

    const fetchHierarchy = async () => {
      try {
        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("*")
          .eq("login", loginEmail.toLowerCase())
          .maybeSingle();

        if (error) {
          console.error("hierarchy_summary_vw error", error);
          setError("Unable to load hierarchy (Supabase error).");
        } else if (!data) {
          setError(
            "We couldn't find your hierarchy. Please contact your DM or admin."
          );
        } else {
          setHierarchy(data as HierarchyRow);
        }
      } catch (err) {
        console.error("Pulse Check hierarchy error", err);
        setError("Unexpected error loading hierarchy.");
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();
  }, [router]);

  const scope = useMemo(() => {
    if (!hierarchy?.scope_level) return "SHOP";
    return hierarchy.scope_level.toUpperCase();
  }, [hierarchy]);

  const renderScopeSection = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20 text-sm text-slate-400">
          Loading Pulse Check…
        </div>
      );
    }

    if (error || !hierarchy) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-6 py-4 text-sm text-red-200">
            {error ?? "We couldn't find your hierarchy. Please contact your DM or admin."}
          </div>
        </div>
      );
    }

    switch (scope) {
      case "DISTRICT":
        return <DistrictView hierarchy={hierarchy} />;
      case "REGION":
        return <RegionView hierarchy={hierarchy} />;
      case "DIVISION":
        return <DivisionView hierarchy={hierarchy} />;
      case "SHOP":
      default:
        return <ShopView hierarchy={hierarchy} />;
    }
  };

  const handleLogout = () => {
    router.push("/logout");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-900/70 bg-slate-950/60 p-4 shadow-lg shadow-black/30 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <RetailPills />
          </div>

          <div className="text-center">
            <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">
              Pulse Check5
            </p>
            <h1 className="text-xl font-semibold text-slate-50">
              Daily visit, coaching & follow-up dashboard
            </h1>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              Logout
            </button>
            <HierarchyStamp />
          </div>
        </header>

        {renderScopeSection()}
      </div>
    </main>
  );
}

function ShopView() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlaceholderCard
        title="Today’s visit checklist"
        value="4 of 6 complete"
        note="Shop-level tasks (placeholder)"
      />
      <PlaceholderCard
        title="Open follow-ups"
        value="3"
        note="Customer or SM follow-ups (placeholder)"
      />
      <PlaceholderCard
        title="Coaching log (last 7 days)"
        value="5 entries"
        note="From Pocket Manager coaching logs (placeholder)"
      />
      <PlaceholderCard
        title="Claims/issues submitted"
        value="2 today / 7 WTD"
        note="Warranty + customer claims (placeholder)"
      />
    </section>
  );
}

function DistrictView() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlaceholderCard
        title="Shops visited today / WTD"
        value="5 / 18"
        note="District rollup (placeholder)"
      />
      <PlaceholderCard
        title="Shops with outstanding follow-ups"
        value="4"
        note="Needs DM attention (placeholder)"
      />
      <PlaceholderCard
        title="Coaching sessions this week"
        value="9"
        note="From DM + SM logs (placeholder)"
      />
      <PlaceholderCard
        title="Claims/issues by shop"
        value="3 shops reporting"
        note="Breakdown via Pulse Check (placeholder)"
      />
    </section>
  );
}

function RegionView() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlaceholderCard
        title="Districts checked-in today"
        value="6 / 8"
        note="Pulse Check visits (placeholder)"
      />
      <PlaceholderCard
        title="Open escalations"
        value="5"
        note="Region-level issues (placeholder)"
      />
      <PlaceholderCard
        title="Coaching coverage"
        value="78%"
        note="Districts delivering coaching cadence (placeholder)"
      />
      <PlaceholderCard
        title="Claims/issues aging > 7 days"
        value="11"
        note="Needs regional push (placeholder)"
      />
    </section>
  );
}

function DivisionView() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlaceholderCard
        title="Regions reporting today"
        value="3 / 4"
        note="Division-level cadence (placeholder)"
      />
      <PlaceholderCard
        title="Districts with open escalations"
        value="7"
        note="Needs divisional support (placeholder)"
      />
      <PlaceholderCard
        title="Shops visited (PTD)"
        value="64%"
        note="Of total shops (placeholder)"
      />
      <PlaceholderCard
        title="Claims/issues aging > 14 days"
        value="18"
        note="Division-level KPI (placeholder)"
      />
    </section>
  );
}

function PlaceholderCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className={cardBaseClasses}>
      <p className="text-xs uppercase tracking-wide text-emerald-300/80">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{note}</p>
      <p className="mt-4 text-[11px] text-slate-500">
        Placeholder – wire to Pulse Check5 Supabase metrics
      </p>
    </div>
  );
}
