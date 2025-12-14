export type ThemeId = "theme1"|"theme2"|"theme3"|"theme4"|"theme5"|"theme6";

export const THEMES: Record<ThemeId, { name: string; frameClass: string; headerClass: string; cardClass: string; accentClass: string; subtleClass: string }> = {
  theme1: { name: "Emerald", frameClass: "bg-gradient-to-r from-emerald-900 to-emerald-700", headerClass: "text-emerald-200", cardClass: "bg-emerald-900/30", accentClass: "text-emerald-300", subtleClass: "text-emerald-400" },
  theme2: { name: "Solar", frameClass: "bg-gradient-to-r from-yellow-900 to-orange-700", headerClass: "text-yellow-200", cardClass: "bg-yellow-900/30", accentClass: "text-yellow-300", subtleClass: "text-yellow-400" },
  theme3: { name: "Ocean", frameClass: "bg-gradient-to-r from-sky-900 to-blue-700", headerClass: "text-sky-200", cardClass: "bg-sky-900/30", accentClass: "text-sky-300", subtleClass: "text-sky-400" },
  theme4: { name: "Twilight", frameClass: "bg-gradient-to-r from-violet-900 to-purple-700", headerClass: "text-violet-200", cardClass: "bg-violet-900/30", accentClass: "text-violet-300", subtleClass: "text-violet-400" },
  theme5: { name: "Slate", frameClass: "bg-gradient-to-r from-slate-900 to-slate-700", headerClass: "text-slate-200", cardClass: "bg-slate-900/30", accentClass: "text-slate-300", subtleClass: "text-slate-400" },
  theme6: { name: "Crimson", frameClass: "bg-gradient-to-r from-rose-900 to-red-700", headerClass: "text-rose-200", cardClass: "bg-rose-900/30", accentClass: "text-rose-300", subtleClass: "text-rose-400" },
};

export const THEME_IDS: ThemeId[] = ["theme1","theme2","theme3","theme4","theme5","theme6"];

export default THEMES;
