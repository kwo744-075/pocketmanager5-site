// app/login/page.tsx

import Link from "next/link";

export default function LoginPage() {
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
            Use your work email and password to continue.
          </p>
        </div>

        {/* Form */}
        <form className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
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
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            Sign in
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
          <button
            type="button"
            className="text-[11px] hover:text-emerald-300 transition"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </main>
  );
}
