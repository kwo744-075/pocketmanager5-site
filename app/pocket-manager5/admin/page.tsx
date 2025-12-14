"use client";

import { useState } from "react";
import MasterShops from "@/app/pocket-manager5/features/components/admin/MasterShops";
import SlotLockoutEditor from "@/app/pocket-manager5/features/components/admin/SlotLockoutEditor";
import CadenceEditor from "@/app/pocket-manager5/features/components/admin/CadenceEditor";
import ManagementHub from "@/app/pocket-manager5/features/components/admin/ManagementHub";

export default function AdminPortalPage() {
  const [section, setSection] = useState<"shops"|"lockouts"|"cadence"|"hub">("hub");

  return (
    <main className="px-6 pb-10">
      <section className="mt-6 flex items-start gap-6">
        <aside className="w-56 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-white">Admin Portal</h2>
          <nav className="mt-4 flex flex-col gap-2 text-sm">
            <button className="text-left" onClick={() => setSection("hub")}>Overview</button>
            <button className="text-left" onClick={() => setSection("shops")}>Master Shops</button>
            <button className="text-left" onClick={() => setSection("lockouts")}>Slot Lockouts</button>
            <button className="text-left" onClick={() => setSection("cadence")}>DM Cadence</button>
          </nav>
        </aside>

        <div className="flex-1">
          {section === "hub" && <ManagementHub />}
          {section === "shops" && <MasterShops />}
          {section === "lockouts" && <SlotLockoutEditor />}
          {section === "cadence" && <CadenceEditor />}
        </div>
      </section>
    </main>
  );
}
