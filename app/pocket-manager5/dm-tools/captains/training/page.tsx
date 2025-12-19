"use client";

import { CalendarClock, GraduationCap, LayoutList, Users } from "lucide-react";
import { CaptainsTopBar } from "../components/CaptainsTopBar";
import { CaptainLanding, type CaptainLandingCard } from "../components/CaptainLanding";

const TRAINING_CARDS: CaptainLandingCard[] = [
  {
    title: "Completion Tracker",
    description: "Placeholder for CTT / LMS module completion with overdue callouts.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-rose-200 border-rose-400/70",
    icon: GraduationCap,
    disabled: true,
  },
  {
    title: "Bench Readiness",
    description: "Future matrix for ASM → GM progression and readiness tags.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-rose-200 border-rose-400/70",
    icon: Users,
    disabled: true,
  },
  {
    title: "Ride-along Scheduling",
    description: "Reserved for ride-along + certification scheduling tools.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-rose-200 border-rose-400/70",
    icon: CalendarClock,
    disabled: true,
  },
  {
    title: "Coaching Plans",
    description: "Placeholder for shareable coaching plan templates per store.",
    status: "Concept",
    badge: "SOON",
    badgeTone: "text-rose-200 border-rose-400/70",
    icon: LayoutList,
    disabled: true,
  },
];

export default function TrainingCaptainPage() {
  return (
    <div className="space-y-8">
      <CaptainsTopBar
        title="Training & Development Captain"
        description="Track certification pipelines and coaching plans in one space."
      />
      <CaptainLanding
        eyebrow="Training hub"
        title="Development modules warming up"
        description="We will light up each card as LMS + coaching feeds are wired."
        cards={TRAINING_CARDS}
      />
    </div>
  );
}
