const normalizeBoolean = (value: string | undefined) => {
  if (!value) {
    return false;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === "true" || trimmed === "1" || trimmed === "yes";
};

export const LOGIN_BYPASS_ENABLED = normalizeBoolean(process.env.NEXT_PUBLIC_BYPASS_LOGIN);
export const LOGIN_BYPASS_EMAIL = process.env.NEXT_PUBLIC_BYPASS_LOGIN_EMAIL?.trim() || "demo@take5.local";
export const LOGIN_BYPASS_SCOPE = process.env.NEXT_PUBLIC_BYPASS_LOGIN_SCOPE?.trim() || "SHOP";
export const LOGIN_BYPASS_DISPLAY_NAME = process.env.NEXT_PUBLIC_BYPASS_LOGIN_NAME?.trim() || "Demo Captain";
export const LOGIN_BYPASS_SHOP = process.env.NEXT_PUBLIC_BYPASS_LOGIN_SHOP?.trim() || "18";
