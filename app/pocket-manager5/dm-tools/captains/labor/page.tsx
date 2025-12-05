import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { ComingSoonPanel } from "../components/ComingSoonPanel";

const BULLETS = [
  "Staffing mix vs. allowed hours with OT exposure callouts",
  "Bench planning view with readiness tags",
  "Overtime + premium labor trend visualizations",
  "Upcoming hiring milestones and blockers",
  "Notifications for critical role gaps",
];

export default function LaborCaptainPage() {
  return (
    <div>
      <CaptainsTopBar title="Labor Captain" description="Balance staffing, OT, and readiness with one console." />
      <ComingSoonPanel
        title="Labor intelligence is warming up"
        description="Soon you will see staffing health, overtime risk, and bench depth in one tap, complete with coaching nudges."
        bullets={BULLETS}
      />
    </div>
  );
}
