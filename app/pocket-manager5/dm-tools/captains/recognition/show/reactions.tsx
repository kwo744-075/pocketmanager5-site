"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const RATE_LIMIT_MS = 3000;

export default function Reactions({ year, period_no }: { year: number; period_no: number }) {
  const [lastAt, setLastAt] = useState(0);
  const disabledRef = useRef(false);

  const send = async (reaction: string) => {
    const now = Date.now();
    if (now - lastAt < RATE_LIMIT_MS) return;
    setLastAt(now);
    try {
      // local fun: play short sound / confetti in host app (not implemented)
      // optional server insert
      await supabase.from("awards_show_reactions").insert({ year, period_no, reaction });
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => void send("applause")} className="rounded-md px-3 py-1 bg-white/5">👏</button>
      <button onClick={() => void send("cheer")} className="rounded-md px-3 py-1 bg-white/5">🎉</button>
      <button onClick={() => void send("laugh")} className="rounded-md px-3 py-1 bg-white/5">😂</button>
      <button onClick={() => void send("wow")} className="rounded-md px-3 py-1 bg-white/5">😮</button>
    </div>
  );
}
