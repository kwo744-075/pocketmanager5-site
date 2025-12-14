import type { ReactNode } from "react";

export default function CaptainsPortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 lg:px-8">{children}</div>
    </div>
  );
}
