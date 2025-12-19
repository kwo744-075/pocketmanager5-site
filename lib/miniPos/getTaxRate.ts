import { supabase } from "@/lib/supabaseClient";

export type TaxRateLookupInput = {
  shopNumber?: number | null;
  zip?: string | null;
  state?: string | null;
};

export type TaxRateLookupResult = {
  rate: number | null;
  source: "shop" | "zip" | "state" | "none";
};

const cache = new Map<string, Promise<TaxRateLookupResult>>();

function normalizeKey(input: TaxRateLookupInput) {
  const shopNumber = input.shopNumber ?? null;
  const zip = (input.zip ?? "").trim() || null;
  const state = (input.state ?? "").trim().toUpperCase() || null;
  return JSON.stringify({ shopNumber, zip, state });
}

export function getTaxRate(input: TaxRateLookupInput): Promise<TaxRateLookupResult> {
  const key = normalizeKey(input);
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<TaxRateLookupResult> => {
    if (typeof input.shopNumber === "number") {
      const { data, error } = await supabase
        .from("mini_pos_tax_rates")
        .select("tax_rate")
        .eq("shop_number", input.shopNumber)
        .maybeSingle();
      if (!error && data?.tax_rate != null) return { rate: Number(data.tax_rate), source: "shop" };
    }

    const zip = (input.zip ?? "").trim();
    if (zip) {
      const { data, error } = await supabase
        .from("mini_pos_tax_rates")
        .select("tax_rate")
        .eq("zip", zip)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.tax_rate != null) return { rate: Number(data.tax_rate), source: "zip" };
    }

    const state = (input.state ?? "").trim().toUpperCase();
    if (state) {
      const { data, error } = await supabase
        .from("mini_pos_tax_rates")
        .select("tax_rate")
        .eq("state", state)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.tax_rate != null) return { rate: Number(data.tax_rate), source: "state" };
    }

    return { rate: null, source: "none" };
  })();

  cache.set(key, promise);
  return promise;
}

export function clearTaxRateCache() {
  cache.clear();
}

