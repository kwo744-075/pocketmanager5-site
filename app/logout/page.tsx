"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    ["loggedIn", "loginEmail", "shopStore", "shopUserName"].forEach((key) =>
      localStorage.removeItem(key)
    );

    router.replace("/login");
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <div
          aria-hidden="true"
          className="h-6 w-6 mx-auto border-2 border-emerald-300 border-t-transparent rounded-full animate-spin"
        />
        <p className="text-sm text-slate-300">Logging you out…</p>
      </div>
    </main>
  );
}
