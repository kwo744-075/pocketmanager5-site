// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const primaryUrl =
	process.env.NEXT_PUBLIC_PM_SUPABASE_URL ??
	process.env.NEXT_PUBLIC_SUPABASE_URL;
const primaryKey =
	process.env.NEXT_PUBLIC_PM_SUPABASE_ANON_KEY ??
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!primaryUrl || !primaryKey) {
	throw new Error(
		"Missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY for the alignment project"
	);
}

const pulseUrl =
	process.env.NEXT_PUBLIC_PULSE_SUPABASE_URL ??
	process.env.NEXT_PUBLIC_PC_SUPABASE_URL ??
	primaryUrl;
const pulseKey =
	process.env.NEXT_PUBLIC_PULSE_SUPABASE_ANON_KEY ??
	process.env.NEXT_PUBLIC_PC_SUPABASE_ANON_KEY ??
	primaryKey;

export const supabase = createClient(primaryUrl, primaryKey);
export const pulseSupabase =
	pulseUrl === primaryUrl && pulseKey === primaryKey
		? supabase
		: createClient(pulseUrl, pulseKey);
