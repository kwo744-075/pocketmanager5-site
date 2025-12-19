// Mapper Component - user maps Excel columns to shop info and KPIs

"use client";

import React, { useState } from 'react';
import { ColumnMapping, KPIDefinition } from '../types';

interface MapperProps {
  availableColumns: string[];
  mapping: ColumnMapping;
  selectedKPIs: KPIDefinition[];
  onMappingChange: (mapping: ColumnMapping) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Mapper({ availableColumns, mapping, selectedKPIs, onMappingChange, onNext, onPrev }: MapperProps) {
  const [localMapping, setLocalMapping] = useState<ColumnMapping>(mapping);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    const newMapping = { ...localMapping, [field]: value || undefined };
    setLocalMapping(newMapping);
    onMappingChange(newMapping);
  };

  // Auto-set shop number mapping on mount
  React.useEffect(() => {
    if (availableColumns.length > 0 && !localMapping.shopNumber) {
      // Look for common shop number column names
      const shopNumberCandidates = ['shop', 'store', 'number', 'shop_number', 'store_number', 'shop_num', 'store_num'];
      const shopNumberColumn = availableColumns.find(col =>
        shopNumberCandidates.some(candidate =>
          col.toLowerCase().includes(candidate)
        )
      );
      if (shopNumberColumn) {
        handleMappingChange('shopNumber', shopNumberColumn);
      }
    }
  }, [availableColumns]);

  const validateAndProceed = () => {
    if (!localMapping.shopNumber) {
      alert('Please map a shop number column.');
      return;
    }

    const missingKPIs = selectedKPIs.filter(kpi => !localMapping[kpi.name]);
    if (missingKPIs.length > 0) {
      alert(`Please map columns for: ${missingKPIs.map(k => k.name).join(', ')}`);
      return;
    }

    onNext();
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-3 text-white">Map Columns</h2>
      <p className="text-slate-300 mb-6 text-sm">
        Map your Excel columns to KPI metrics. Shop number is automatically mapped.
      </p>

      {/* Shop Information Mapping */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3 text-slate-300">Shop Information</h3>

        <div className="flex items-center p-3 bg-slate-800/50 rounded">
          <span className="text-white font-medium mr-4">Shop Number:</span>
          <span className="text-indigo-400 font-semibold">
            {localMapping.shopNumber || 'Auto-detecting...'}
          </span>
        </div>
      </div>

      {/* KPI Mapping */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3 text-slate-300">KPI Metrics</h3>
        {selectedKPIs.map(kpi => (
          <div key={kpi.name} className="flex items-center p-3 bg-slate-800/50 rounded mb-2">
            <label className="text-white font-medium mr-4 flex-1">{kpi.name}:</label>
            <select
              value={localMapping[kpi.name] || ''}
              onChange={(e) => handleMappingChange(kpi.name, e.target.value)}
              className="bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 flex-1"
              aria-label={`${kpi.name} column mapping`}
            >
              <option value="">Not mapped</option>
              {availableColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          onClick={onPrev}
        >
          Previous
        </button>
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          onClick={validateAndProceed}
        >
          Next
        </button>
      </div>
    </div>
  );
}
