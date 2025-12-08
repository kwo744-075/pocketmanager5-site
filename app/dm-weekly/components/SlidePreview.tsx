"use client";
import React, { useEffect, useState } from "react";

type WeeklyApi = {
  slides: string[];
  slideFolder: string;
  excel: { headers: string[]; rows: Record<string, unknown>[] } | null;
  excelName?: string;
};

export default function SlidePreview() {
  const [data, setData] = useState<WeeklyApi | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/samples/weekly");
      if (!res.ok) return;
      const payload = (await res.json()) as WeeklyApi;
      if (!cancelled) setData(payload);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <div className="text-sm text-slate-400">Loading slides...</div>;
  if (!data.slides.length) return <div className="text-sm text-slate-400">No slides found.</div>;

  const current = data.slides[index % data.slides.length];
  const imgUrl = `/api/samples/weekly/slide?name=${encodeURIComponent(current)}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-300">{data.excelName ?? "Sample Weekly review"}</div>
        <div className="text-xs text-slate-500">Slide {index + 1} / {data.slides.length}</div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          className="rounded border px-3 py-1 text-sm text-slate-200"
          onClick={() => setIndex((i) => (i - 1 + data.slides.length) % data.slides.length)}
        >
          Prev
        </button>
        <div className="flex-1 overflow-hidden rounded bg-black/20 p-3">
          <img src={imgUrl} alt={`Slide ${index + 1}`} className="w-full rounded-md object-contain" />
        </div>
        <button
          className="rounded border px-3 py-1 text-sm text-slate-200"
          onClick={() => setIndex((i) => (i + 1) % data.slides.length)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
