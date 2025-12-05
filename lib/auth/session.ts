'use server';

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAlignmentContextForUser, type AlignmentContext } from "./alignment";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const SUPABASE_URL = supabaseUrl;
const SUPABASE_ANON_KEY = supabaseAnonKey;

const ACTIVE_ALIGNMENT_COOKIE = "pm-active-alignment";

export type ServerSession = {
  supabase: SupabaseClient;
  user: Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data']['user'];
  alignment: AlignmentContext | null;
};


export async function getServerSession(): Promise<ServerSession> {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      async setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as never);
        });
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, alignment: null } satisfies ServerSession;
  }

  const preferredAlignmentId = cookieStore.get(ACTIVE_ALIGNMENT_COOKIE)?.value;
  const alignment = await loadAlignmentContextForUser(supabase, user.id, preferredAlignmentId);

  if (alignment.activeAlignmentId) {
    cookieStore.set(ACTIVE_ALIGNMENT_COOKIE, alignment.activeAlignmentId, {
      path: "/",
      sameSite: "lax",
    });
  } else {
    if (cookieStore.get(ACTIVE_ALIGNMENT_COOKIE)) {
      cookieStore.delete(ACTIVE_ALIGNMENT_COOKIE);
    }
  }

  return { supabase, user, alignment } satisfies ServerSession;
}

export async function requireServerSession() {
  const session = await getServerSession();
  if (!session.user) {
    throw new Error("Authentication required");
  }
  return session;
}

export async function requireAlignmentContext() {
  const session = await requireServerSession();
  if (!session.alignment || !session.alignment.activeAlignmentId) {
    throw new Error("Alignment context required");
  }
  return session;
}

export async function getDefaultAlignmentCookieName() {
  return ACTIVE_ALIGNMENT_COOKIE;
}
