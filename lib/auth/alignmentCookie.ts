import { cookies as nextCookies } from "next/headers";

export async function getActiveAlignmentFromServer(): Promise<string | null> {
  try {
    const ck = await nextCookies();
    const val = ck.get?.("pm-active-alignment") ?? null;
    if (!val) return null;
    return decodeURIComponent((val as any).value || "");
  } catch (err) {
    console.warn("getActiveAlignmentFromServer: unable to read cookies", err);
    return null;
  }
}

export function parseActiveAlignmentFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  try {
    const parts = cookieHeader.split(";").map((s) => s.trim());
    for (const part of parts) {
      if (part.startsWith("pm-active-alignment=")) {
        const val = part.split("=")[1] ?? "";
        return decodeURIComponent(val);
      }
    }
    return null;
  } catch (err) {
    console.warn("parseActiveAlignmentFromCookieHeader failed", err);
    return null;
  }
}

export default getActiveAlignmentFromServer;
