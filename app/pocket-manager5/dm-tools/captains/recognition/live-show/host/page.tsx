"use client";
import React from 'react';

export default function HostPage({ searchParams }: { searchParams?: Record<string,string> }) {
  const showId = searchParams?.showId ?? 'demo-show';
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-white">Live Show Host</h1>
      <p className="text-sm text-slate-400">Show ID: {showId}</p>
      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          <button className="rounded px-3 py-2 border">Start</button>
          <button className="rounded px-3 py-2 border">Stop</button>
          <button className="rounded px-3 py-2 border">Next</button>
          <button className="rounded px-3 py-2 border">Prev</button>
        </div>
        <div className="mt-4 rounded border p-4 bg-slate-900/50">Stage preview (host)</div>
      </div>
    </div>
  );
}
