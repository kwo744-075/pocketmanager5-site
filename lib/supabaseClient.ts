// lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const primaryUrl =
	process.env.NEXT_PUBLIC_PM_SUPABASE_URL ??
	process.env.NEXT_PUBLIC_SUPABASE_URL;
const primaryKey =
	process.env.NEXT_PUBLIC_PM_SUPABASE_ANON_KEY ??
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missingEnvMessage =
	"Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable alignment features.";

const createNoopSupabaseClient = (): SupabaseClient => {
	const throwNotConfigured = () => {
		throw new Error(missingEnvMessage);
	};

	const proxyTarget = Object.assign(throwNotConfigured, {});
	return new Proxy(proxyTarget, {
		get: () => proxyTarget,
		apply: () => {
			throwNotConfigured();
			return undefined;
		},
	}) as unknown as SupabaseClient;
};

const primaryConfigured = Boolean(primaryUrl && primaryKey);

const baseClient = primaryConfigured ? createClient(primaryUrl!, primaryKey!) : createNoopSupabaseClient();

const pulseUrl =
	process.env.NEXT_PUBLIC_PULSE_SUPABASE_URL ??
	process.env.NEXT_PUBLIC_PC_SUPABASE_URL ??
	primaryUrl;
const pulseKey =
	process.env.NEXT_PUBLIC_PULSE_SUPABASE_ANON_KEY ??
	process.env.NEXT_PUBLIC_PC_SUPABASE_ANON_KEY ??
	primaryKey;

const pulseConfigured = Boolean(pulseUrl && pulseKey);

export const supabase = baseClient;
export const pulseSupabase =
	pulseConfigured && pulseUrl && pulseKey
		? pulseUrl === primaryUrl && pulseKey === primaryKey
			? baseClient
			: createClient(pulseUrl, pulseKey)
		: baseClient;

if (!primaryConfigured) {
	console.warn(missingEnvMessage);
}
