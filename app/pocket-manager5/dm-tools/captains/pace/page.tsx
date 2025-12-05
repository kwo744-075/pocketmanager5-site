import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { ComingSoonPanel } from "../components/ComingSoonPanel";

const BULLETS = [
  "Budget pacing dashboard with week-over-week trend lines",
  "Cars & sales vs. budget + vs. comp auto-highlights",
  "PACE alerts for outliers with recommended actions",
  "Drill down to shop + channel contribution",
  "Export-ready recap for RD cadence calls",
];

export default function PaceCaptainPage() {
  return (
    <div>
      <CaptainsTopBar title="PACE Captain" description="Track pacing to budget and comp across the entire route." />
      <ComingSoonPanel
        title="PACE monitoring is on deck"
        description="We are pairing shop KPI feeds with budget targets so you can steer cars and sales without waiting for spreadsheets."
        bullets={BULLETS}
      />
    </div>
  );
}
