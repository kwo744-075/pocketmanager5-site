import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { InventoryCaptainWorkspace } from "./components/InventoryCaptainWorkspace";

export default function InventoryCaptainPage() {
  return (
    <div>
      <CaptainsTopBar title="Inventory Captain" description="Monitor coverage, accuracy, and replenishment health across your route." />
      <InventoryCaptainWorkspace />
    </div>
  );
}
