import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { loadAlignmentContextForUser } from "./lib/auth/alignment";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/auth/error", "/health"]);
const ACTIVE_ALIGNMENT_COOKIE = "pm-active-alignment";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const STATIC_PREFIXES = ["/_next/", "/static/", "/public/", "/favicon", "/robots.txt", "/sitemap.xml"];

const hasEnv = Boolean(supabaseUrl && supabaseAnonKey);

const isBypassedPath = (pathname: string) => {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api")) return true;
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export async function middleware(request: NextRequest) {
  if (!hasEnv) {
    console.warn("[Middleware] Missing Supabase env vars; skipping auth middleware");
    return NextResponse.next();
  }

  if (isBypassedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      async setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("redirectTo", redirectTarget);
    return NextResponse.redirect(loginUrl);
  }

  const preferredAlignment = request.cookies.get(ACTIVE_ALIGNMENT_COOKIE)?.value;
  const alignment = await loadAlignmentContextForUser(supabase, user.id, preferredAlignment);

  if (alignment.activeAlignmentId) {
    response.cookies.set(ACTIVE_ALIGNMENT_COOKIE, alignment.activeAlignmentId, {
      path: "/",
      sameSite: "lax",
    });

    if (!request.nextUrl.searchParams.has("alignment")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.searchParams.set("alignment", alignment.activeAlignmentId);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|login|auth/callback|auth/error|api/).*)"],
};
