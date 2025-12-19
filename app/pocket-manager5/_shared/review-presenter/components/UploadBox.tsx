// Upload Box Component - handles Excel file upload and parsing

"use client";

import React, { useRef } from 'react';
import { parseExcelFile, getAvailableColumns } from '../ReviewPresenterEngine';
import { ParsedRow } from '../types';

interface UploadBoxProps {
  onDataParsed: (data: ParsedRow[], columns: string[]) => void;
  onNext: () => void;
}

export function UploadBox({ onDataParsed, onNext }: UploadBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    try {
      const parsedData = await parseExcelFile(file);
      const columns = getAvailableColumns(parsedData);

      if (parsedData.length === 0) {
        alert('No data found in the Excel file');
        return;
      }

      onDataParsed(parsedData, columns);
      onNext();
    } catch (error) {
      console.error('File processing error:', error);
      alert('Failed to process the file');
    }
  };

  return (
    <div className="text-center p-6">
      <h2 className="text-xl font-semibold mb-3 text-white">Upload Excel File</h2>
      <p className="text-slate-300 mb-6 text-sm leading-relaxed max-w-md mx-auto">
        Select an Excel file (.xlsx) containing your KPI data.
        The file should have columns for shop information and KPI metrics.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFilePick}
        className="hidden"
        aria-label="Upload KPI Excel file"
      />

      <button
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        Choose File
      </button>

      <p className="mt-4 text-xs text-slate-400">
        Supported formats: .xlsx, .xls
      </p>
    </div>
  );
}
