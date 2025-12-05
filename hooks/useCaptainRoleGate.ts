"use client";

import { useMemo } from "react";

export type CaptainRole = "viewer" | "dm" | "rd" | "admin";

const SCOPE_TO_ROLE: Record<string, CaptainRole> = {
  SHOP: "viewer",
  DISTRICT: "dm",
  REGION: "rd",
  DIVISION: "admin",
};

type CaptainRoleGateOptions = {
  scopeLevel?: string | null;
  loading?: boolean;
};

export function useCaptainRoleGate(options: CaptainRoleGateOptions = {}) {
  const normalizedScope = options.scopeLevel?.toUpperCase() ?? null;

  const role = useMemo<CaptainRole>(() => {
    if (!normalizedScope) {
      return "viewer";
    }
    return SCOPE_TO_ROLE[normalizedScope] ?? "viewer";
  }, [normalizedScope]);

  const hydrated = options.loading === undefined ? true : !options.loading;
  const canEditRules = role === "rd" || role === "admin";
  const canQueueExports = role !== "viewer";

  return {
    role,
    hydrated,
    canEditRules,
    canQueueExports,
  };
}
