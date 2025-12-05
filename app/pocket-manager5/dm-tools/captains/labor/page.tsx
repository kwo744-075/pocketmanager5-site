import { AlarmClock, Briefcase, ClipboardList, Users } from "lucide-react";
import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { CaptainLanding, type CaptainLandingCard } from "../components/CaptainLanding";

const LABOR_CARDS: CaptainLandingCard[] = [
  {
    title: "Staffing Outlook",
    description: "Placeholder for staffing mix vs allowed hours with OT exposure callouts.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-amber-200 border-amber-400/70",
    icon: Users,
    disabled: true,
  },
  {
    title: "Bench Planner",
    description: "Future bench planning matrix with readiness tags and milestones.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-amber-200 border-amber-400/70",
    icon: Briefcase,
    disabled: true,
  },
  {
    title: "Overtime Watch",
    description: "Placeholder for overtime + premium labor trend visualizations.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-amber-200 border-amber-400/70",
    icon: AlarmClock,
    disabled: true,
  },
  {
    title: "Gap Notifications",
    description: "Reserved for hiring blockers, readiness alerts, and automation.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-amber-200 border-amber-400/70",
    icon: ClipboardList,
    disabled: true,
  },
];

export default function LaborCaptainPage() {
  return (
    <div className="space-y-8">
      <CaptainsTopBar title="Labor Captain" description="Balance staffing, OT, and readiness with one console." />
      <CaptainLanding
        eyebrow="Labor hub"
        title="Workflows loading soon"
        description="We are wiring staffing intelligence now. These placeholders will flip live as each module lands."
        cards={LABOR_CARDS}
      />
    </div>
  );
}
