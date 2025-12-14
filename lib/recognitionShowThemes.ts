export type ShowThemeId = "classic" | "neon" | "championship" | "steel" | "spotlight" | "minimal";

export const themeMap: Record<ShowThemeId, { id: ShowThemeId; label: string; background: string; header: string; accent: string; fontSize: string }> = {
  classic: { id: 'classic', label: 'Classic', background: '#0f172a', header: '#0ea5a4', accent: '#10b981', fontSize: '16px' },
  neon: { id: 'neon', label: 'Neon', background: '#030712', header: '#7c3aed', accent: '#ef4444', fontSize: '18px' },
  championship: { id: 'championship', label: 'Championship', background: '#06152b', header: '#f59e0b', accent: '#ef4444', fontSize: '18px' },
  steel: { id: 'steel', label: 'Steel', background: '#0b1220', header: '#94a3b8', accent: '#60a5fa', fontSize: '15px' },
  spotlight: { id: 'spotlight', label: 'Spotlight', background: '#08121a', header: '#f97316', accent: '#fb7185', fontSize: '20px' },
  minimal: { id: 'minimal', label: 'Minimal', background: '#0f172a', header: '#cbd5e1', accent: '#38bdf8', fontSize: '14px' },
};

export default themeMap;
