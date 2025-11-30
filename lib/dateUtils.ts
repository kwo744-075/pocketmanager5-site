export const todayISO = () => new Date().toISOString().split("T")[0];

export const getWeekStartISO = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const first = new Date(now.setDate(diff));
  return first.toISOString().split("T")[0];
};
