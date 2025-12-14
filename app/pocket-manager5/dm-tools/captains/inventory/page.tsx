import { Boxes, ClipboardList, FileWarning, Package } from "lucide-react";
import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { CaptainLanding, type CaptainLandingCard } from "../components/CaptainLanding";

const INVENTORY_CARDS: CaptainLandingCard[] = [
  {
    title: "Inventory Adjustments",
    description: "Launch the adjustment workspace to review counts, gaps, and required approvals.",
    href: "/pocket-manager5/dm-tools/captains/inventory/adjustments",
    badge: "LIVE",
    badgeTone: "text-emerald-200 border-emerald-400/70",
    status: "Ready to launch",
    icon: Boxes,
  },
  {
    title: "Missing Inventory",
    description: "Surface exception queues that flag missing serialized parts, cores, or supply transfers.",
    badge: "PLANNING",
    badgeTone: "text-amber-200 border-amber-400/70",
    status: "In design",
    icon: FileWarning,
    disabled: true,
  },
  {
    title: "Cycle Count Insights",
    description: "Placeholder for automated recount prompts and coverage metrics.",
    badge: "HOLD",
    badgeTone: "text-slate-200 border-slate-500/70",
    status: "Placeholder",
    icon: ClipboardList,
    disabled: true,
  },
  {
    title: "Replenishment Sandbox",
    description: "Future slot for predictive replenishment tests and vendor syncs.",
    badge: "HOLD",
    badgeTone: "text-slate-200 border-slate-500/70",
    status: "Placeholder",
    icon: Package,
    disabled: true,
  },
];

export default function InventoryCaptainPage() {
  return (
    <div className="space-y-8">
      <CaptainsTopBar
        title="Inventory Captain"
        description="Monitor coverage, accuracy, and replenishment health across your route."
      />
      <CaptainLanding
        eyebrow="Inventory hub"
        title="Pick a workspace"
        description="Adjustments are live today. Additional cards will unlock as we wire their data feeds."
        cards={INVENTORY_CARDS}
      />
    </div>
  );
}
