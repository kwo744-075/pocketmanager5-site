// Heat Grid View - red/green KPI status grid

import React from 'react';
import { ShopKPIData } from '../types';

interface HeatGridViewProps {
  data: ShopKPIData[];
  title?: string;
}

export function HeatGridView({ data, title = 'KPI Heat Grid' }: HeatGridViewProps) {
  if (data.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">{title}</h2>
        <p className="text-slate-400 text-center">No data to display</p>
      </div>
    );
  }

  const kpiNames = data[0].kpis.map(kpi => kpi.name);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4 text-white">{title}</h2>

      {/* Header */}
      <div className="flex border-b border-slate-600 mb-2">
        <div className="flex-1 p-2 text-sm font-semibold text-slate-300 bg-slate-700/50">Shop</div>
        {kpiNames.map(kpi => (
          <div key={kpi} className="w-20 p-2 text-xs font-semibold text-slate-300 bg-slate-700/50 text-center border-l border-slate-600">{kpi}</div>
        ))}
      </div>

      {/* Data Rows */}
      {data.map((shop, index) => (
        <div key={shop.shop} className={`flex ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'} border-b border-slate-700`}>
          <div className="flex-1 p-2 text-sm text-white font-medium">{shop.shop}</div>
          {shop.kpis.map((kpi, kpiIndex) => (
            <div key={kpi.name} className={`w-20 p-2 text-center border-l border-slate-600 ${getStatusClass(kpi.status)}`}>
              <span className="text-xs font-medium">
                {kpi.value !== null ? kpi.value.toFixed(1) : '-'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function getStatusClass(status: string) {
  switch (status) {
    case 'green': return 'bg-green-900/50 text-green-300';
    case 'red': return 'bg-red-900/50 text-red-300';
    default: return 'bg-yellow-900/50 text-yellow-300';
  }
}