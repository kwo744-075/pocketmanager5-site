import { CaptainsTopBar } from "../../components/CaptainsTopBar";
import { InventoryCaptainWorkspace } from "../components/InventoryCaptainWorkspace";

export default function InventoryAdjustmentsPage() {
  return (
    <div className="space-y-6">
      <CaptainsTopBar
        title="Inventory Captain"
        description="Monitor coverage, accuracy, and replenishment health across your route."
      />
      <InventoryCaptainWorkspace />
    </div>
  );
}
