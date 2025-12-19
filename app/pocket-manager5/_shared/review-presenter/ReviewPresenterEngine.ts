// Review Presenter Engine - parsing, mapping, KPI normalization

import * as XLSX from 'xlsx';
import { ParsedRow, ColumnMapping, KPIDefinition, ShopKPIData } from './types';

export function parseExcelFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Convert to objects with column headers
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        const parsedRows: ParsedRow[] = rows.map(row => {
          const obj: ParsedRow = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || null;
          });
          return obj;
        });

        resolve(parsedRows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function getAvailableColumns(data: ParsedRow[]): string[] {
  if (data.length === 0) return [];
  return Object.keys(data[0]);
}

export function validateMapping(mapping: ColumnMapping, availableColumns: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!mapping.shopNumber && !mapping.shopName) {
    errors.push('Must map at least shop number or shop name');
  }

  Object.entries(mapping).forEach(([kpi, column]) => {
    if (column && !availableColumns.includes(column)) {
      errors.push(`Column "${column}" for ${kpi} not found in data`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function applyMapping(data: ParsedRow[], mapping: ColumnMapping, kpis: KPIDefinition[]): ShopKPIData[] {
  const shopMap = new Map<string, ShopKPIData>();

  data.forEach(row => {
    const shopKey = mapping.shopNumber ? String(row[mapping.shopNumber] || '') :
                   mapping.shopName ? String(row[mapping.shopName] || '') : 'Unknown';

    if (!shopKey || shopKey === 'Unknown') return;

    if (!shopMap.has(shopKey)) {
      shopMap.set(shopKey, {
        shop: shopKey,
        shopNumber: mapping.shopNumber ? Number(row[mapping.shopNumber]) : undefined,
        shopName: mapping.shopName ? String(row[mapping.shopName]) : undefined,
        kpis: kpis.map(kpi => ({
          name: kpi.name,
          value: null,
          goal: kpi.goal,
          comparator: kpi.comparator,
          status: 'neutral'
        }))
      });
    }

    const shopData = shopMap.get(shopKey)!;

    kpis.forEach((kpi, index) => {
      const column = mapping[kpi.name];
      if (column && row[column] != null) {
        const value = Number(row[column]);
        if (!isNaN(value)) {
          shopData.kpis[index].value = value;

          // Calculate status
          const goal = kpi.goal;
          let meets = false;
          switch (kpi.comparator) {
            case '>=': meets = value >= goal; break;
            case '<=': meets = value <= goal; break;
            case '=': meets = value === goal; break;
          }
          shopData.kpis[index].status = meets ? 'green' : 'red';
        }
      }
    });
  });

  return Array.from(shopMap.values());
}

export function calculateRankings(data: ShopKPIData[]): { districtRankings: any[], overallRankings: ShopKPIData[] } {
  // Simple ranking by average KPI performance
  const withScores = data.map(shop => ({
    ...shop,
    score: shop.kpis.reduce((sum, kpi) => sum + (kpi.status === 'green' ? 1 : 0), 0) / shop.kpis.length
  }));

  const overallRankings = withScores.sort((a, b) => b.score - a.score);

  // Group by district (assuming shop name contains district info or we need to enhance this)
  const districtMap = new Map<string, ShopKPIData[]>();
  withScores.forEach(shop => {
    const district = shop.shopName?.split(' ')[0] || 'Unknown'; // Simple extraction
    if (!districtMap.has(district)) districtMap.set(district, []);
    districtMap.get(district)!.push(shop);
  });

  const districtRankings = Array.from(districtMap.entries()).map(([district, shops]) => ({
    district,
    shops: shops.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }));

  return { districtRankings, overallRankings };
}