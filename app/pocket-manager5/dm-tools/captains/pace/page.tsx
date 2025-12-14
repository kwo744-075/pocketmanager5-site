import { BarChart3, LineChart, Radar, TrendingUp } from "lucide-react";
import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { CaptainLanding, type CaptainLandingCard } from "../components/CaptainLanding";

const PACE_CARDS: CaptainLandingCard[] = [
  {
    title: "Budget Dashboard",
    description: "Placeholder for week-over-week pacing with budget overlays.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-cyan-200 border-cyan-400/70",
    icon: TrendingUp,
    disabled: true,
  },
  {
    title: "Variance Highlights",
    description: "Cars & sales vs. budget/comp auto-highlights will land here.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-cyan-200 border-cyan-400/70",
    icon: BarChart3,
    disabled: true,
  },
  {
    title: "PACE Alerts",
    description: "Reserved for outlier detection and recommended corrective actions.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-cyan-200 border-cyan-400/70",
    icon: Radar,
    disabled: true,
  },
  {
    title: "Channel Drilldowns",
    description: "Future drilldown to shop and channel contribution with export-ready recaps.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-cyan-200 border-cyan-400/70",
    icon: LineChart,
    disabled: true,
  },
];

export default function PaceCaptainPage() {
  return (
    <div className="space-y-8">
      <CaptainsTopBar title="PACE Captain" description="Track pacing to budget and comp across the entire route." />
      <CaptainLanding
        eyebrow="PACE hub"
        title="Monitoring suite coming soon"
        description="Budget pacing and alerting modules are in-flight; these placeholders will switch to live cards as feeds land."
        cards={PACE_CARDS}
      />
    </div>
  );
}
