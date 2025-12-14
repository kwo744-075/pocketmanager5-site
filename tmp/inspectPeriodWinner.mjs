import path from "node:path";
import XLSX from "xlsx";

const filePath = path.resolve("..", "Period Winner by shop sample.xlsx");
const workbook = XLSX.readFile(filePath);
const [sheetName] = workbook.SheetNames;
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
const header = data[0];
const preview = data.slice(1, 11);
console.log({ sheetName, header, preview });
