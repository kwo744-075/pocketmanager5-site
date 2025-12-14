"use client";

import { Trophy, TrendingUp, ClipboardList, Lightbulb } from "lucide-react";
import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { CaptainLanding, type CaptainLandingCard } from "../components/CaptainLanding";

const LANDING_CARDS: CaptainLandingCard[] = [
  {
    title: "Awards Show Workflow",
    description: "Guide DMs and RDs through qualifiers, KPI uploads, manual awards, review, and exports.",
    href: "/pocket-manager5/dm-tools/captains/recognition/awards",
    badge: "LIVE",
    badgeTone: "text-emerald-200 border-emerald-400/70",
    status: "Ready to launch",
    icon: Trophy,
    disabled: false,
  },
  {
    title: "Recognition Tracking",
    description: "Coming soon • track confirmations, celebrate birthdays, and monitor readiness at a glance.",
    href: "#",
    badge: "SOON",
    badgeTone: "text-amber-200 border-amber-400/70",
    status: "In design",
    icon: TrendingUp,
    disabled: true,
  },
  {
    title: "Culture Moments",
    description: "Placeholder for future culture shout-outs, photo uploads, and celebration feeds.",
    href: "#",
    badge: "HOLD",
    badgeTone: "text-slate-200 border-slate-500/70",
    status: "Planning",
    icon: ClipboardList,
    disabled: true,
  },
  {
    title: "Automation Sandbox",
    description: "Reserved for test harnesses that help preview exporter or PPT changes before launch.",
    href: "#",
    badge: "HOLD",
    badgeTone: "text-slate-200 border-slate-500/70",
    status: "Planning",
    icon: Lightbulb,
    disabled: true,
  },
];

export default function RecognitionCaptainLandingPage() {
  return (
    <div className="space-y-8">
      <CaptainsTopBar title="Recognition Captain" />
      <CaptainLanding
        eyebrow="Recognition hub"
        title="Pick a workspace"
        description="Awards are live today. Tracking, culture, and automation cards will light up as we finish wiring them."
        cards={LANDING_CARDS}
      />
    </div>
  );
}
