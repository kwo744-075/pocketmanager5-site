export function autoFitTextClass(
  input: string,
  opts?: {
    large?: number;
    medium?: number;
    small?: number;
  },
): string {
  const text = (input ?? "").trim();
  const len = text.length;

  const large = opts?.large ?? 70;
  const medium = opts?.medium ?? 120;
  const small = opts?.small ?? 180;

  if (len > small) return "text-[11px]";
  if (len > medium) return "text-[12px]";
  if (len > large) return "text-[13px]";
  return "text-sm";
}

