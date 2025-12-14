const fs = require('fs');
(async () => {
  const path = 'C:\\Users\\kwo74\\Desktop\\Take 5\\Apps\\p11 awards files\\P11 NPS.xlsx';
  if (!fs.existsSync(path)) {
    console.error('File not found:', path);
    process.exit(2);
  }
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(path, { cellDates: true });
    console.log('Sheets:', wb.SheetNames);
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      console.log('Sheet', name, 'rows:', rows.length);
    }
  } catch (err) {
    console.error('Failed to read workbook:', err);
    process.exit(1);
  }
})();
