"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

      const { data, error: supaError } = await supabase
        .from("company_alignment")
        .select('store, "Shop_Email", "Shop_UserName"')
        .eq("Shop_Email", loginEmail)
        .eq("Shop_Password", loginPassword)
        .maybeSingle();

      if (supaError) {
        console.error("Supabase login error:", supaError);
        setError("Login error – please try again or contact admin.");
      } else if (!data) {
        setError("Invalid email or password.");
      } else {
        // ✅ Logged in – simple local flag for now
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("loginEmail", loginEmail);
        localStorage.setItem("shopStore", String(data.store ?? ""));
        localStorage.setItem("shopUserName", data.Shop_UserName ?? "");

        router.push("/"); // send them to the main dashboard
      }
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("Unexpected error – please try again.");
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
            Use your shop login from company_alignment (ex: 18@t5.com).
          </p>
        </div>

        {/* Form */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-300"
            >
              Login (Shop_Email)
            </label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              placeholder="18@t5.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300"
            >
              Password (Shop_Password)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              placeholder="take5"
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


