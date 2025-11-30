import { createClient } from "@supabase/supabase-js";

const serviceRoleKey =
  process.env.PM_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.POCKET_MANAGER_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

const supabaseUrl =
  process.env.NEXT_PUBLIC_PM_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.POCKET_MANAGER_SUPABASE_URL ??
  process.env.PM_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_PM_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase service role credentials for admin client");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
