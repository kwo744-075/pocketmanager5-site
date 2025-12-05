import { CaptainsTopBar } from "./components/CaptainsTopBar";
import { CaptainNavCard } from "./components/CaptainNavCard";

const CAPTAIN_ROUTES = [
  {
    title: "Recognition Captain",
    subtitle: "Upload KPI tables, auto-build award leaderboards, and export decks.",
    href: "/pocket-manager5/dm-tools/captains/recognition",
    comingSoon: false,
  },
  {
    title: "Inventory Captain",
    subtitle: "Track coverage, AOR hits, and variance alerts in one canvas.",
    href: "/pocket-manager5/dm-tools/captains/inventory",
    comingSoon: true,
  },
  {
    title: "PACE Captain",
    subtitle: "Budget pacing co-pilot for cars, sales, and lagging KPIs.",
    href: "/pocket-manager5/dm-tools/captains/pace",
    comingSoon: true,
  },
  {
    title: "Labor Captain",
    subtitle: "Staffing, OT exposure, and bench planning in a single dashboard.",
    href: "/pocket-manager5/dm-tools/captains/labor",
    comingSoon: true,
  },
  {
    title: "Training & Development Captain",
    subtitle: "Module completion, certs, and development plans at-a-glance.",
    href: "/pocket-manager5/dm-tools/captains/training",
    comingSoon: true,
  },
];

export default function CaptainsPortalPage() {
  return (
    <div>
      <CaptainsTopBar
        title="Captains Portal"
        description="Central hub for DM captains – recognition, inventory coverage, PACE, labor, and training."
      />
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CAPTAIN_ROUTES.map((captain) => (
          <CaptainNavCard key={captain.href} {...captain} />
        ))}
      </section>
    </div>
  );
}
