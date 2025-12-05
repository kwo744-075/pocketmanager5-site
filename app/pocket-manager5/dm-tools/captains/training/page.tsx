import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { ComingSoonPanel } from "../components/ComingSoonPanel";

const BULLETS = [
  "CTT / LMS module completion tracker with overdue callouts",
  "Bench readiness matrix for ASM → GM progression",
  "Ride-along + certification scheduling",
  "Training demand forecast vs. capacity",
  "Shareable coaching plans per store",
];

export default function TrainingCaptainPage() {
  return (
    <div>
      <CaptainsTopBar
        title="Training & Development Captain"
        description="Track certification pipelines and coaching plans in one space."
      />
      <ComingSoonPanel
        title="Training Captain is nearly here"
        description="We are pairing LMS feeds with coaching plans so you can see completion, gaps, and readiness without spreadsheets."
        bullets={BULLETS}
      />
    </div>
  );
}
