"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Chip from "@/app/components/Chip";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchShopTotals, EMPTY_TOTALS, type PulseTotalsResult } from "@/lib/pulseTotals";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";

const integerFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const aroFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${percentFormatter.format(value)}%`;
};

type ShopMeta = {
  id: string;
  shop_number: number | null;
  shop_name: string | null;
};

type ViewMode = "daily" | "weekly";

export default function ShopPulseSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shopId, setShopId] = useState<string | null>(searchParams?.get("shopId") ?? null);
  const [shopName, setShopName] = useState<string | null>(searchParams?.get("shopName") ?? null);
  const [shopNumber, setShopNumber] = useState<string | null>(searchParams?.get("shopNumber") ?? null);
  const [retailLabel] = useState(() => searchParams?.get("retailLabel") ?? null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<ViewMode>("daily");
  const [totals, setTotals] = useState<PulseTotalsResult>({ daily: EMPTY_TOTALS, weekly: EMPTY_TOTALS });
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const loggedIn = window.localStorage.getItem("loggedIn") === "true";
    queueMicrotask(() => {
      if (!loggedIn) {
        setAuthChecked(true);
        router.replace("/login?redirect=/pulse-check5/shop-summary");
        return;
      }
      setAuthChecked(true);
    });
  }, [router]);

  useEffect(() => {
    if (shopId || !shopNumber) {
      return;
    }

    const numericShop = Number(shopNumber);
    if (Number.isNaN(numericShop)) {
      return;
    }

    let cancelled = false;

    const resolveShopId = async () => {
      try {
        const clients = [pulseSupabase, supabase];
        let resolved: ShopMeta | null = null;
        for (const client of clients) {
          const { data, error } = await client
            .from("shops")
            .select("id, shop_number, shop_name")
            .eq("shop_number", numericShop)
            .limit(1)
            .maybeSingle();

          if (error && error.code !== "PGRST116") {
            console.error("Shop summary lookup error", error);
            continue;
          }

          if (data) {
            resolved = data as ShopMeta;
            break;
          }
        }

        if (cancelled) {
          return;
        }

        if (resolved) {
          setShopId(resolved.id);
          if (!shopName) {
            setShopName(resolved.shop_name ?? null);
          }
          if (!shopNumber && resolved.shop_number) {
            setShopNumber(String(resolved.shop_number));
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Shop summary metadata error", err);
        }
      }
    };

    resolveShopId();

    return () => {
      cancelled = true;
    };
  }, [shopId, shopNumber, shopName]);

  useEffect(() => {
    if (!shopId) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoadingTotals(true);
        setStatusMessage(null);
      }
    });

    fetchShopTotals(shopId)
      .then((result) => {
        if (!cancelled) {
          setTotals(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Shop summary totals error", err);
          setStatusMessage("Unable to load Pulse Check metrics right now.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTotals(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const activeTotals = view === "daily" ? totals.daily : totals.weekly;

  const metricTiles = useMemo(() => {
    const cars = activeTotals.cars;
    const scopeLabelShort = view === "daily" ? "today" : "WTD";
    const aro = cars > 0 ? activeTotals.sales / cars : null;
    const mixPercent = (part: number) => (cars > 0 ? (part / cars) * 100 : null);

    return [
      { label: `Cars ${scopeLabelShort}`, value: integerFormatter.format(cars) },
      { label: `Sales ${scopeLabelShort}`, value: currencyFormatter.format(activeTotals.sales) },
      { label: `ARO ${scopeLabelShort}`, value: aro === null ? "--" : aroFormatter.format(aro) },
      { label: `Donations ${scopeLabelShort}`, value: currencyFormatter.format(activeTotals.donations) },
      { label: "Big 4 mix", value: formatPercent(mixPercent(activeTotals.big4)) },
      { label: "Coolants mix", value: formatPercent(mixPercent(activeTotals.coolants)) },
      { label: "Diffs mix", value: formatPercent(mixPercent(activeTotals.diffs)) },
      { label: "Mobil 1 mix", value: formatPercent(mixPercent(activeTotals.mobil1)) },
    ];
  }, [activeTotals, view]);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking access…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-emerald-400"
          >
            ← Back
          </button>
          <Link href="/" className="text-xs text-emerald-300 hover:underline">
            Home
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-900 bg-slate-950/70 p-5 shadow-inner shadow-black/40">
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400">Pulse Check summary</p>
          <h1 className="text-3xl font-semibold text-white">Pulse Check – {shopName ?? "Shop"}</h1>
          <p className="text-sm text-slate-300">
            {shopNumber ? `Shop #${shopNumber}` : "Resolving shop"}
            {retailLabel ? ` • ${retailLabel}` : ""}
          </p>
        </div>

        <div className="flex gap-2">
          {(["daily", "weekly"] as ViewMode[]).map((mode) => (
            <Chip
              key={mode}
              label={mode === "daily" ? "Daily" : "Week to Date"}
              onClick={() => setView(mode)}
              active={view === mode}
              className="flex-1 px-4 py-2 text-sm"
            />
          ))}
        </div>

        {statusMessage && (
          <p className="rounded-xl border border-rose-500/40 bg-rose-900/40 px-4 py-2 text-xs text-rose-100">{statusMessage}</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {metricTiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{tile.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {loadingTotals ? "--" : tile.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
