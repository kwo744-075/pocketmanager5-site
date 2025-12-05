import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { RecognitionCaptainWorkspace } from "./components/RecognitionCaptainWorkspace";

export default function RecognitionCaptainPage() {
  return (
    <div>
      <CaptainsTopBar
        title="Recognition Captain"
        description="Upload KPI exports, auto-build award leaderboards, and push decks for District MVP, Car Count Crusher, Ticket Hawk, and CSI Guardian."
      />
      <RecognitionCaptainWorkspace />
    </div>
  );
}
