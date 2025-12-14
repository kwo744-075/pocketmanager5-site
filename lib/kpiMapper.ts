export type Scope = "shop" | "district" | "region";

const SCOPE_COLUMNS = {
  shop: ["shop", "store", "store_id", "shop_id", "location"],
  district: ["district", "dm", "district_name", "district_id"],
  region: ["region", "region_name", "zone"],
};

const PRESETS_BY_SCOPE: Record<Scope, string[]> = {
  shop: ["Sales", "Cars", "ARO $", "Big 4 %", "Labor %"],
  district: ["Sales", "Cars", "Profit", "Big 4 %", "ARO $"],
  region: ["Sales", "Profit", "Big 4 %", "Labor %"],
};

function normalizeKey(s: string) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

import { getAliasesForKey } from "./kpiAliases";

export function matchColumn(target: string, columns: string[]) {
  const t = normalizeKey(target);

  // include any aliases for the target key (from localStorage/defaults)
  const aliases = getAliasesForKey(target) || [];
  const candidates = Array.from(new Set([target, ...aliases]));
  const normalizedCandidates = candidates.map(normalizeKey);

  // exact match against any candidate
  for (const c of columns) {
    const nc = normalizeKey(c);
    if (normalizedCandidates.includes(nc)) return c;
  }

  // contains / includes checks
  for (const c of columns) {
    const nc = normalizeKey(c);
    if (normalizedCandidates.some(candidate => nc.includes(candidate) || candidate.includes(nc))) return c;
  }

  // startsWith / prefix checks
  for (const c of columns) {
    const nc = normalizeKey(c);
    if (normalizedCandidates.some(candidate => nc.startsWith(candidate) || candidate.startsWith(nc))) return c;
  }

  return null;
}

export function findScopeColumn(columns: string[], scope: Scope): string | null {
  const candidates = SCOPE_COLUMNS[scope] ?? [];
  for (const c of candidates) {
    const m = matchColumn(c, columns);
    if (m) return m;
  }
  // fallback: try generic names
  for (const c of columns) {
    const n = normalizeKey(c);
    if (n.includes(scope)) return c;
  }
  return null;
}

export function mapPresetToColumns(presetNames: string[], columns: string[]): string[] {
  const mapped: string[] = [];
  for (const name of presetNames) {
    const m = matchColumn(name, columns);
    if (m) mapped.push(m);
  }
  return mapped;
}

export function getPresetsForScope(scope: Scope): string[] {
  return PRESETS_BY_SCOPE[scope] ?? [];
}

export default {
  findScopeColumn,
  mapPresetToColumns,
  getPresetsForScope,
  matchColumn,
};
