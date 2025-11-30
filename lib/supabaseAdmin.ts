import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null = null;

const resolveServiceRoleKey = () =>
  process.env.PM_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.POCKET_MANAGER_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

const resolveSupabaseUrl = () =>
  process.env.NEXT_PUBLIC_PM_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.POCKET_MANAGER_SUPABASE_URL ??
  process.env.PM_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_PM_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) {
    return cachedAdmin;
  }

  const serviceRoleKey = resolveServiceRoleKey();
  const supabaseUrl = resolveSupabaseUrl();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role credentials for admin client");
  }

  cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdmin;
}
