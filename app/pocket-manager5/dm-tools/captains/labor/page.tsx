"use client";

import Link from "next/link";
import { type ComponentType } from "react";
import { CheckCircle2, Clock4, Layers, LineChart, Store, Users } from "lucide-react";
import { CaptainsTopBar } from "../components/CaptainsTopBar";

type ViewBlueprint = {
  id: "region" | "district" | "shop" | "vp";
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  anchor: string;
  badge: string;
};

type ComplianceRow = {
  district: string;
  complete: boolean;
  totalHours: number;
  otHours: number;
};

type FutureCard = {
  title: string;
  description: string;
  status: string;
};

const VIEW_BLUEPRINTS: ViewBlueprint[] = [
  {
    id: "region",
    title: "Region Command",
    description: "District Labor roll-up, variance scoring, and compliance trackers.",
    icon: Layers,
    anchor: "#region",
    badge: "Live mock",
  },
  {
    id: "district",
    title: "DM Control",
    description: "District-level pacing with cars, staffing, and scheduling to-do's.",
    icon: Users,
    anchor: "#district",
    badge: "Next",
  },
  {
    id: "shop",
    title: "Shop Deep Dive",
    description: "Store roster, daily hour caps, and coaching follow-ups.",
    icon: Store,
    anchor: "#shop",
    badge: "Planned",
  },
  {
    id: "vp",
    title: "VP / Exec Lens",
    description: "Region vs division labor posture with readiness narratives.",
    icon: LineChart,
    anchor: "#vp",
    badge: "Expanding",
  },
];

const SCHEDULED_COMPLIANCE: ComplianceRow[] = [
  { district: "Baton Rouge North", complete: true, totalHours: 166, otHours: 18 },
  { district: "Baton Rouge South", complete: false, totalHours: 199, otHours: 32 },
  { district: "Gulf Coast North", complete: true, totalHours: 265, otHours: 16 },
  { district: "Gulf Coast West", complete: false, totalHours: 189, otHours: 27 },
  { district: "Lafayette", complete: true, totalHours: 221, otHours: 9 },
  { district: "Nola North", complete: true, totalHours: 340, otHours: 44 },
  { district: "Nola South", complete: false, totalHours: 314, otHours: 52 },
];

const DISTRICT_BLUEPRINTS: FutureCard[] = [
  { title: "District pacing board", description: "Queue labor calls, annotate hiring blockers, and surface OT alerts per DM.", status: "Wireframing" },
  { title: "Assignment tracker", description: "Overlay cadence tasks, staffing goals, and people moves for the week ahead.", status: "Next sprint" },
  { title: "Staff mix heatmap", description: "Map tech / CSA mix vs allowed hours for every DM to flag imbalance early.", status: "Research" },
];

const SHOP_BLUEPRINTS: FutureCard[] = [
  { title: "Shop roster cards", description: "Single-tap roster, schedule, and caps for each store with daily notes.", status: "Planned" },
  { title: "Variance drill-down", description: "Stack rank shops by variance and show the cars vs hours story.", status: "Prototyping" },
  { title: "Coaching journal", description: "Attach action plans, PTAs, and follow-ups right inside the labor grid.", status: "Concept" },
];

const VP_BLUEPRINTS: FutureCard[] = [
  { title: "Division scorecard", description: "Summarize every region with OT%, staffing readiness, and compliance in one glide.", status: "Planning" },
  { title: "Narrative exporter", description: "Auto-generate talking points for ELT touchbases from regions' notes.", status: "Planning" },
  { title: "Scenario sandbox", description: "Model what-if staffing changes vs weekly hour caps before calling audibles.", status: "Concept" },
];

const hoursFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function LaborCaptainPage() {
  return (
    <div className="space-y-10">
      <CaptainsTopBar
        title="Labor Captain"
        description="District Labor landing space: jump between region, DM, shop, and exec views without leaving the portal."
      />
      <RegionSection />
      <FutureSection id="district" title="District playbooks" description="DM controls mirror the region view with district-only filters." cards={DISTRICT_BLUEPRINTS} />
      <FutureSection id="shop" title="Shop intelligence" description="Shop modules will use the same components with store-by-store editing." cards={SHOP_BLUEPRINTS} />
      <FutureSection id="vp" title="VP / executive readiness" description="Summaries for VP + leadership show stacked regions with OT exposure." cards={VP_BLUEPRINTS} />
      <LandingRail />
    </div>
  );
}

function LandingRail() {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.5em] text-emerald-200">District Labor</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Labor intelligence landing</h2>
          <p className="mt-1 text-sm text-slate-300">Pick a lens to open the right table. Region view above is wired with mock data from the latest export.</p>
        </div>
        <span className="rounded-full border border-emerald-400/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-200">Pilot</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {VIEW_BLUEPRINTS.map((view) => (
          <Link
            key={view.id}
            href={view.anchor}
            className="group flex h-full flex-col justify-between rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition hover:border-emerald-400/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                <view.icon className="h-4 w-4 text-emerald-200" />
                Go to
              </div>
              <span className="rounded-full border border-emerald-400/40 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-100">
                {view.badge}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <h3 className="text-lg font-semibold text-white">{view.title}</h3>
              <p className="text-sm text-slate-300">{view.description}</p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-200">
              Jump <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RegionSection() {
  return (
    <section id="region" className="space-y-6 rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.5em] text-slate-400">Region View</p>
          <h2 className="text-2xl font-semibold text-white">District Labor — Region roll up</h2>
          <p className="mt-1 text-sm text-slate-300">
            Variance tables, PTO credits, store drill-down, and minimum hours keys now live in the Daily Labor feature beta. The captain page keeps the
            compliance tracker here so DMs still have a fast pulse on scheduled reviews.
          </p>
        </div>
        <Link
          href="/pocket-manager5/features/daily-labor"
          className="rounded-full border border-emerald-400/50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-200 transition hover:border-emerald-300"
        >
          View Daily Labor
        </Link>
      </div>
      <ScheduledComplianceCard />
    </section>
  );
}


function ScheduledComplianceCard() {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Region scheduling compliance</h3>
          <p className="text-xs text-slate-400">Track that every district booked labor reviews. Hours stay numeric; OT% auto-calculates.</p>
        </div>
        <CheckCircle2 className="h-5 w-5 text-emerald-200" />
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {SCHEDULED_COMPLIANCE.map((row) => {
          const percent = row.totalHours === 0 ? 0 : (row.otHours / row.totalHours) * 100;
          return (
            <div key={row.district} className="rounded-xl border border-slate-800/60 bg-slate-900/60 px-3 py-2">
              <div className="flex items-center justify-between text-white">
                <span className="font-semibold">{row.district}</span>
                {row.complete ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Scheduled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                    <Clock4 className="h-4 w-4" /> Pending
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Total hrs</p>
                  <p className="text-sm text-white">{hoursFormatter.format(row.totalHours)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">OT hrs</p>
                  <p className="text-sm text-white">{hoursFormatter.format(row.otHours)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">OT %</p>
                  <p className={`text-sm font-semibold ${percent > 10 ? "text-rose-300" : "text-emerald-300"}`}>
                    {percentFormatter.format(percent)}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FutureSection({ id, title, description, cards }: { id: string; title: string; description: string; cards: FutureCard[] }) {
  return (
    <section id={id} className="rounded-3xl border border-slate-900/60 bg-slate-950/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.45em] text-slate-500">{title}</p>
          <h3 className="text-2xl font-semibold text-white">{description}</h3>
        </div>
        <span className="rounded-full border border-slate-800 px-3 py-1 text-xs uppercase tracking-[0.4em] text-slate-400">Coming up</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-white">{card.title}</h4>
              <span className="rounded-full border border-emerald-400/40 px-3 py-0.5 text-[10px] uppercase tracking-[0.4em] text-emerald-100">
                {card.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{card.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

