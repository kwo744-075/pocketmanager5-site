export type MiniPosColorToken = {
  baseClass: string;
  selectedClass: string;
  hoverClass?: string;
  borderClass?: string;
};

export const SERVICE_COLOR_MAP: Record<string, MiniPosColorToken> = {
  mobil1: {
    baseClass: "bg-amber-700/50 border-amber-400/60 text-white",
    selectedClass: "bg-amber-500/70 border-amber-200/80 text-white",
    hoverClass: "hover:border-amber-200/80 hover:bg-amber-500/60",
  },
  xlt: {
    baseClass: "bg-sky-800/50 border-sky-400/60 text-white",
    selectedClass: "bg-sky-600/70 border-sky-200/80 text-white",
    hoverClass: "hover:border-sky-200/80 hover:bg-sky-600/60",
  },
  premium: {
    baseClass: "bg-emerald-800/50 border-emerald-400/60 text-white",
    selectedClass: "bg-emerald-600/70 border-emerald-200/80 text-white",
    hoverClass: "hover:border-emerald-200/80 hover:bg-emerald-600/60",
  },
  economy: {
    baseClass: "bg-teal-800/50 border-teal-400/60 text-white",
    selectedClass: "bg-teal-600/70 border-teal-200/80 text-white",
    hoverClass: "hover:border-teal-200/80 hover:bg-teal-600/60",
  },
  diesel: {
    baseClass: "bg-indigo-800/50 border-indigo-400/60 text-white",
    selectedClass: "bg-indigo-600/70 border-indigo-200/80 text-white",
    hoverClass: "hover:border-indigo-200/80 hover:bg-indigo-600/60",
  },
  byo: {
    baseClass: "bg-fuchsia-800/50 border-fuchsia-400/60 text-white",
    selectedClass: "bg-fuchsia-600/70 border-fuchsia-200/80 text-white",
    hoverClass: "hover:border-fuchsia-200/80 hover:bg-fuchsia-600/60",
  },
  other_services: {
    baseClass: "bg-purple-800/50 border-purple-400/60 text-white",
    selectedClass: "bg-purple-600/70 border-purple-200/80 text-white",
    hoverClass: "hover:border-purple-200/80 hover:bg-purple-600/60",
  },
  filters_wipers: {
    baseClass: "bg-rose-800/50 border-rose-400/60 text-white",
    selectedClass: "bg-rose-600/70 border-rose-200/80 text-white",
    hoverClass: "hover:border-rose-200/80 hover:bg-rose-600/60",
  },
};

export function getServiceColors(key: string): MiniPosColorToken {
  return (
    SERVICE_COLOR_MAP[key] ?? {
      baseClass: "bg-slate-800/60 border-slate-500/60 text-white",
      selectedClass: "bg-slate-600/80 border-white/60 text-white",
      hoverClass: "hover:border-white/70 hover:bg-slate-600/70",
    }
  );
}
