import React from 'react';

export default function AudiencePage({ params }: { params: { showId: string } }) {
  const { showId } = params;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-white">Live Show</h1>
      <p className="text-sm text-slate-400">Viewing show: {showId}</p>
      <div className="mt-4 rounded border p-4 bg-slate-900/50">Stage preview (audience)</div>
      <div className="mt-4 flex gap-2">
        <button className="rounded px-3 py-2 border">👏 Cheer</button>
        <button className="rounded px-3 py-2 border">🎉 Applause</button>
      </div>
    </div>
  );
}
