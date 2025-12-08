import * as XLSX from "xlsx";

export type ParsedWorkbook = {
  sheets: Record<string, any[]>;
};

export async function parseWorkbook(arrayBuffer: ArrayBuffer): Promise<ParsedWorkbook> {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheets: Record<string, any[]> = {};

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { defval: null });
    sheets[name] = data as any[];
  }

  return { sheets };
}

export default parseWorkbook;
