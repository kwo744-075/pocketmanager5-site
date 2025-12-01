"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";
import { getCachedSummaryForLogin, normalizeLogin, writeHierarchySummaryCache } from "@/lib/hierarchyCache";

export type HierarchySummary = {
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

export type ShopMeta = {
  id: string;
  shop_number: number | null;
  shop_name: string | null;
  district_id: string | null;
  region_id: string | null;
};

export type UsePocketHierarchyResult = {
  authChecked: boolean;
  isLoggedIn: boolean;
  loginEmail: string | null;
  needsLogin: boolean;
  storedShopName: string | null;
  hierarchy: HierarchySummary | null;
  hierarchyLoading: boolean;
  hierarchyError: string | null;
  shopMeta: ShopMeta | null;
  divisionId: string | null;
};

export function usePocketHierarchy(redirectPath = "/pocket-manager5"): UsePocketHierarchyResult {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [storedShopName, setStoredShopName] = useState<string | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchySummary | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);

  const syncAuthState = useCallback(() => {
    if (typeof window === "undefined") return;

    const loggedIn = window.localStorage.getItem("loggedIn") === "true";
    const email = (window.localStorage.getItem("loginEmail") ?? "").trim().toLowerCase();

    if (!loggedIn || !email) {
      setIsLoggedIn(false);
      setLoginEmail(null);
      setAuthChecked(true);
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    setIsLoggedIn(true);
    setLoginEmail(email);
    setAuthChecked(true);
  }, [redirectPath, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "loggedIn" || event.key === "loginEmail") {
        syncAuthState();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [syncAuthState]);

  useEffect(() => {
    syncAuthState();
  }, [syncAuthState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedName = window.localStorage.getItem("shopUserName") ?? null;
    setStoredShopName(cachedName);
  }, [loginEmail]);

  useEffect(() => {
    if (!loginEmail) {
      setHierarchy(null);
      setHierarchyError(null);
      setHierarchyLoading(false);
      return;
    }

    let cancelled = false;
    const normalized = normalizeLogin(loginEmail);
    if (!normalized) {
      setHierarchy(null);
      setHierarchyError("Unable to load your hierarchy scope.");
      setHierarchyLoading(false);
      return;
    }

    const cachedSummary = getCachedSummaryForLogin(normalized);
    if (cachedSummary) {
      setHierarchy((cachedSummary as HierarchySummary) ?? null);
      setHierarchyError(null);
    }
    setHierarchyLoading(true);
    setHierarchyError(null);

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("*")
          .eq("login", normalized)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          console.error("usePocketHierarchy hierarchy_summary_vw error", error);
          if (!getCachedSummaryForLogin(normalized)) {
            setHierarchy(null);
            setHierarchyError("Unable to load your hierarchy scope.");
          }
        } else {
          const resolved = (data as HierarchySummary | null) ?? null;
          if (resolved) {
            setHierarchy(resolved);
            setHierarchyError(null);
            writeHierarchySummaryCache(resolved);
          } else {
            const fallback = getCachedSummaryForLogin(normalized);
            if (fallback) {
              setHierarchy((fallback as HierarchySummary) ?? null);
              setHierarchyError(null);
            } else {
              setHierarchy(null);
              setHierarchyError("Unable to load your hierarchy scope.");
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("usePocketHierarchy hierarchy fetch error", err);
          if (!getCachedSummaryForLogin(normalized)) {
            setHierarchy(null);
            setHierarchyError("Unable to load your hierarchy scope.");
          }
        }
      } finally {
        if (!cancelled) {
          setHierarchyLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loginEmail]);

  useEffect(() => {
    if (!hierarchy?.shop_number) {
      setShopMeta(null);
      return;
    }

    const numericShop = Number(hierarchy.shop_number);
    if (Number.isNaN(numericShop)) {
      setShopMeta(null);
      return;
    }

    let cancelled = false;

    const fetchMeta = async () => {
      try {
        const clients = [pulseSupabase, supabase];
        let resolved: ShopMeta | null = null;
        let lastError: unknown = null;

        for (const client of clients) {
          try {
            const { data, error } = await client
              .from("shops")
              .select("id, shop_number, shop_name, district_id, region_id")
              .eq("shop_number", numericShop)
              .limit(1)
              .maybeSingle();

            if (error && error.code !== "PGRST116") {
              lastError = error;
              continue;
            }

            if (data) {
              resolved = data as ShopMeta;
              break;
            }
          } catch (clientErr) {
            lastError = clientErr;
          }
        }

        if (cancelled) {
          return;
        }

        if (resolved) {
          setShopMeta(resolved);
        } else {
          setShopMeta(null);
          if (lastError) {
            console.error("usePocketHierarchy shop lookup error", lastError);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("usePocketHierarchy shop metadata error", err);
          setShopMeta(null);
        }
      }
    };

    fetchMeta();

    return () => {
      cancelled = true;
    };
  }, [hierarchy?.shop_number]);

  useEffect(() => {
    if (!shopMeta?.region_id) {
      setDivisionId(null);
      return;
    }

    let cancelled = false;

    const fetchDivision = async () => {
      try {
        const { data, error } = await pulseSupabase
          .from("regions")
          .select("division_id")
          .eq("id", shopMeta.region_id)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error && error.code !== "PGRST116") {
          console.error("usePocketHierarchy regions lookup error", error);
          setDivisionId(null);
          return;
        }

        setDivisionId((data?.division_id as string | null) ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error("usePocketHierarchy regions lookup exception", err);
          setDivisionId(null);
        }
      }
    };

    fetchDivision();

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.region_id]);

  const needsLogin = authChecked && !loginEmail;

  return {
    authChecked,
    isLoggedIn,
    loginEmail,
    needsLogin,
    storedShopName,
    hierarchy,
    hierarchyLoading,
    hierarchyError,
    shopMeta,
    divisionId,
  };
}
