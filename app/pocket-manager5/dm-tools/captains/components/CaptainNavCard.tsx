"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CaptainNavCardProps {
  title: string;
  subtitle: string;
  href: string;
  comingSoon?: boolean;
}

export function CaptainNavCard({ title, subtitle, href, comingSoon = false }: CaptainNavCardProps) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
      <Link
        href={href}
        className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
      >
        <div>
          <p className="text-sm text-slate-400">{comingSoon ? "Coming soon" : "Available"}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-emerald-200">
          <span>{comingSoon ? "Preview" : "Launch"}</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </div>
      </Link>
    </motion.div>
  );
}
