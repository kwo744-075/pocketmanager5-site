// Rankings View - district and overall shop rankings

import React from 'react';
import { ShopKPIData } from '../types';

interface RankingsViewProps {
  districtRankings: { district: string; shops: ShopKPIData[] }[];
  overallRankings: ShopKPIData[];
  title?: string;
}

export function RankingsView({ districtRankings, overallRankings, title = 'Shop Rankings' }: RankingsViewProps) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4 text-white text-center">{title}</h2>

      {/* Overall Rankings */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3 text-slate-300">Overall Rankings</h3>
        {overallRankings.map((shop, index) => (
          <div key={shop.shop} className="flex items-center p-2 bg-slate-800/30 mb-1 rounded">
            <span className="text-sm font-bold min-w-8 text-indigo-400">#{index + 1}</span>
            <span className="flex-1 text-sm font-medium text-white">{shop.shop}</span>
            <span className="text-xs text-slate-400">
              {shop.kpis.filter(k => k.status === 'green').length}/{shop.kpis.length} met
            </span>
          </div>
        ))}
      </div>

      {/* District Rankings */}
      {districtRankings.map(({ district, shops }) => (
        <div key={district} className="mb-6">
          <h3 className="text-md font-semibold mb-3 text-slate-300">{district} District</h3>
          {shops.map((shop, index) => (
            <div key={shop.shop} className="flex items-center p-2 bg-slate-800/30 mb-1 rounded">
              <span className="text-sm font-bold min-w-8 text-indigo-400">#{index + 1}</span>
              <span className="flex-1 text-sm font-medium text-white">{shop.shop}</span>
              <span className="text-xs text-slate-400">
                {shop.kpis.filter(k => k.status === 'green').length}/{shop.kpis.length} met
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}