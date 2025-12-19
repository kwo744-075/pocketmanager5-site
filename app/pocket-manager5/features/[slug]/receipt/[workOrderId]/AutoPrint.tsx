"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function AutoPrint() {
  const searchParams = useSearchParams();
  const auto = searchParams?.get("autoprint") === "1";

  useEffect(() => {
    if (!auto) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [auto]);

  return null;
}
