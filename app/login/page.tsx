"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { writeHierarchySummaryCache } from "@/lib/hierarchyCache";

type HierarchySummary = {
  login: string;
  scope_level: string | null;
  division_name: string | null;
  region_name: string | null;
  district_name: string | null;
  shop_number: string | null;
  shops_in_district?: number | null;
  districts_in_region?: number | null;
  shops_in_region?: number | null;
  regions_in_division?: number | null;
  shops_in_division?: number | null;
};

type AlignmentRow = {
  Division: string | null;
  Region: string | null;
  District: string | null;
  store: string | number | null;
  Shop_UserName: string | null;
  District_UserName: string | null;
  Region_UserName: string | null;
  Division_UserName: string | null;
};

type LoginScope = "SHOP" | "DISTRICT" | "REGION" | "DIVISION";

const ALIGNMENT_SELECT = [
  '"Division"',
  '"Region"',
  '"District"',
  '"store"',
  '"Shop_UserName"',
  '"District_UserName"',
  '"Region_UserName"',
  '"Division_UserName"',
].join(", ");

const LOGIN_SCOPES: {
  scope: LoginScope;
  emailColumn: string;
  passwordColumn: string;
  userNameColumn: keyof AlignmentRow;
  friendlyLabel: string;
}[] = [
  {
    scope: "SHOP",
    emailColumn: "Shop_Email",
    passwordColumn: "Shop_Password",
    userNameColumn: "Shop_UserName",
    friendlyLabel: "Shop",
  },
  {
    scope: "DISTRICT",
    emailColumn: "District_Email",
    passwordColumn: "District_Password",
    userNameColumn: "District_UserName",
    friendlyLabel: "District",
  },
  {
    scope: "REGION",
    emailColumn: "Region_Email",
    passwordColumn: "Region_Password",
    userNameColumn: "Region_UserName",
    friendlyLabel: "Region",
  },
  {
    scope: "DIVISION",
    emailColumn: "Division_Email",
    passwordColumn: "Division_Password",
    userNameColumn: "Division_UserName",
    friendlyLabel: "Division",
  },
];

const LOCAL_LOGIN_COOKIE = "pm-local-login";

const persistLegacyAuthCookie = (login: string | null) => {
  if (typeof document === "undefined") return;
  if (login) {
    const encoded = encodeURIComponent(login);
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    document.cookie = `${LOCAL_LOGIN_COOKIE}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } else {
    document.cookie = `${LOCAL_LOGIN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // normalize inputs
    const loginEmail = email.trim().toLowerCase();
    const loginPassword = password.trim();

    try {
      console.log("Trying login with:", loginEmail); // debug

      let matchedLogin: { row: AlignmentRow; scope: (typeof LOGIN_SCOPES)[number] } | null = null;

      for (const scopeConfig of LOGIN_SCOPES) {
        const { data, error: supaError } = await supabase
          .from("company_alignment")
          .select(ALIGNMENT_SELECT)
          .eq(scopeConfig.emailColumn, loginEmail)
          .eq(scopeConfig.passwordColumn, loginPassword)
          .limit(1)
          .maybeSingle<AlignmentRow>();

        if (supaError) {
          // Multiple district/region rows can still report an error;
          // log and move on to the next scope without surfacing to the user.
          if (supaError.code !== "PGRST116") {
            console.warn(
              `Supabase login lookup failed for scope ${scopeConfig.scope}:`,
              supaError
            );
          }
          continue;
        }

        if (data) {
          matchedLogin = { row: data, scope: scopeConfig };
          break;
        }
      }

      if (!matchedLogin) {
        setError("Invalid email or password.");
        persistLegacyAuthCookie(null);
        return;
      }

      const {
        row,
        scope: { scope: scopeLevel, userNameColumn, friendlyLabel },
      } = matchedLogin;
      const displayName = (row[userNameColumn] as string | null) ?? friendlyLabel;

      // Store a minimal hierarchy summary immediately so downstream pages have context even
      // if Supabase view rows are missing for this login scope.
      const fallbackSummary = buildHierarchySummaryFromAlignment({
        login: loginEmail,
        scopeLevel,
        row,
      });
      writeHierarchySummaryCache(fallbackSummary);

      // ✅ Logged in – persist shared context
      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("loginEmail", loginEmail);
      localStorage.setItem("userScopeLevel", scopeLevel);
      localStorage.setItem("userDisplayName", displayName ?? friendlyLabel);
      localStorage.setItem("userDivision", row.Division ?? "");
      localStorage.setItem("userRegion", row.Region ?? "");
      localStorage.setItem("userDistrict", row.District ?? "");
      persistLegacyAuthCookie(loginEmail);

      if (scopeLevel === "SHOP") {
        localStorage.setItem("shopStore", String(row.store ?? ""));
        localStorage.setItem(
          "shopUserName",
          (row.Shop_UserName as string | null) ?? displayName ?? ""
        );
      } else {
        localStorage.removeItem("shopStore");
        localStorage.removeItem("shopUserName");
      }

      // Load alignment context (alignment_memberships + shop_role_assignments)
      try {
        // The canonical key for these tables in the app is the auth `user_id` (UUID).
        // For legacy logins we only have an email. Try to resolve a profile row
        // to obtain the canonical user_id, falling back to the email if not found.
        let queryUserId: string | null = loginEmail;
        try {
          const { data: profileRow, error: profileErr } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", loginEmail)
            .maybeSingle();

          if (!profileErr && profileRow?.user_id) {
            queryUserId = profileRow.user_id;
          }
        } catch (profileLookupErr) {
          console.warn("[Login] profile lookup failed, falling back to email for alignment queries", profileLookupErr);
        }

        const { data: memberships, error: membersErr } = await supabase
          .from("alignment_memberships")
          .select("alignment_id, alignment_name, shop_id, role, is_primary")
          .eq("user_id", queryUserId as string);

        const shopsFromMemberships = new Set<string>();
        if (!membersErr && memberships) {
          (memberships as any[]).forEach((m) => {
            if (m.shop_id) shopsFromMemberships.add(m.shop_id);
          });
        }

        const { data: assignments, error: assignErr } = await supabase
          .from("shop_role_assignments")
          .select("shop_id")
          .eq("user_id", queryUserId as string);

        if (!assignErr && assignments) {
          (assignments as any[]).forEach((a) => {
            if (a.shop_id) shopsFromMemberships.add(a.shop_id);
          });
        }

        let activeAlignmentId: string | undefined = undefined;
        if (!activeAlignmentId && memberships && (memberships as any[]).length > 0) {
          activeAlignmentId = (memberships as any[]).find((m) => m.is_primary)?.alignment_id ?? (memberships as any[])[0]?.alignment_id;
        }

        const newAlignment = {
          memberships: memberships ?? [],
          shops: Array.from(shopsFromMemberships),
          activeAlignmentId,
        };

        localStorage.setItem("alignmentContext", JSON.stringify(newAlignment));
        // Mirror server behavior: set pm-active-alignment cookie when activeAlignmentId exists
        if (typeof document !== "undefined") {
          if (activeAlignmentId) {
            document.cookie = `pm-active-alignment=${encodeURIComponent(activeAlignmentId)}; path=/; SameSite=Lax`;
          } else {
            document.cookie = `pm-active-alignment=; path=/; max-age=0; SameSite=Lax`;
          }
        }
        console.log("[Login] alignmentContext saved", newAlignment);
      } catch (alignErr) {
        console.warn("[Login] Failed to load alignment context:", alignErr);
      }

      try {
        // NOTE: This uses the same Supabase tables as the Pocket Manager5 & Pulse Check5 apps.
        const summary = await fetchHierarchySummary(loginEmail);
        if (summary) {
          writeHierarchySummaryCache(summary);
        }
      } catch (hierarchyErr) {
        console.error("Hierarchy summary fetch error:", hierarchyErr);
      }

      router.push("/"); // send them to the main dashboard
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("Unexpected error – please try again.");
      persistLegacyAuthCookie(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/40">
        {/* Logo / title */}
        <div className="text-center space-y-1">
          <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">
            Pocket Manager5 • Pulse Check5
          </p>
          <h1 className="text-2xl font-semibold">
            Sign in to{" "}
            <span className="text-red-500">P</span>ocket&nbsp;Manager{" "}
            <span className="text-red-500">5</span>
          </h1>
          <p className="text-xs text-slate-400">
            Use any company_alignment login (Shop, DM, RD, VP).
          </p>
        </div>

        {/* Form */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-300"
            >
              Login Email
            </label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="off"
              inputMode="email"
              placeholder=""
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="off"
              placeholder=""
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-[11px] text-center text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Footer links */}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <Link
            href="/"
            className="hover:text-emerald-300 transition underline-offset-2 hover:underline"
          >
            ← Back to home
          </Link>
          <span className="opacity-60">Forgot password? (DM-only, for now)</span>
        </div>
      </div>
    </main>
  );
}

async function fetchHierarchySummary(loginEmail: string) {
  const { data, error } = await supabase
    .from("hierarchy_summary_vw")
    .select("*")
    .eq("login", loginEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as HierarchySummary | null;
}

function buildHierarchySummaryFromAlignment({
  login,
  scopeLevel,
  row,
}: {
  login: string;
  scopeLevel: LoginScope;
  row: AlignmentRow;
}): HierarchySummary {
  return {
    login,
    scope_level: scopeLevel,
    division_name: row.Division ?? null,
    region_name: row.Region ?? null,
    district_name: row.District ?? null,
    shop_number: scopeLevel === "SHOP" ? (row.store ? String(row.store) : null) : null,
    shops_in_district: null,
    districts_in_region: null,
    shops_in_region: null,
    regions_in_division: null,
    shops_in_division: null,
  };
}


