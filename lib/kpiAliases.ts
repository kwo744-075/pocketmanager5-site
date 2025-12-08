const STORAGE_KEY = "weekly.kpi.aliases.v1";

export type AliasTable = Record<string, string[]>;

const DEFAULT_ALIASES: AliasTable = {
  "sales": ["total sales", "net sales", "sales $", "sales_amt", "salesamount"],
  "cars": ["transactions", "units", "cars sold", "units_sold"],
  "aro$": ["aro", "aro $", "avg repair order", "average repair order"],
  "big4%": ["big 4 %", "big4 percent", "big4pct"],
  "labor%": ["labor %", "labor percent", "labor_pct", "labor%"],
  "profit": ["profit $", "profitamount", "net profit"],
};

export function loadAliases(): AliasTable {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw) as AliasTable;
  } catch (e) {
    // ignore and fall back to defaults
  }
  return { ...DEFAULT_ALIASES };
}

export function saveAliases(table: AliasTable) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
  } catch (e) {
    // swallow
  }
}

export function getAliasesForKey(key: string): string[] {
  const table = loadAliases();
  return table[key.toLowerCase()] ?? [];
}

export function updateAlias(key: string, alias: string) {
  const table = loadAliases();
  const k = key.toLowerCase();
  table[k] = Array.from(new Set([...(table[k] ?? []), alias.toLowerCase().trim()]));
  saveAliases(table);
}

export function removeAlias(key: string, alias: string) {
  const table = loadAliases();
  const k = key.toLowerCase();
  if (!table[k]) return;
  table[k] = table[k].filter(a => a !== alias.toLowerCase());
  saveAliases(table);
}

export default {
  loadAliases,
  saveAliases,
  getAliasesForKey,
  updateAlias,
  removeAlias,
};
