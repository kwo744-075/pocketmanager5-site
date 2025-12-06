import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

async function main() {
  const repo = process.cwd();
  const samplesDir = path.join(repo, 'PocketManager5_sitetmpupload_samples');
  const fileName = 'GC Region Labor 12.06.25.xlsx';
  const filePath = path.join(samplesDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.error('Workbook not found at', filePath);
    process.exit(1);
  }

  const buffer = await fs.promises.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const patch: Record<string, any[]> = {};

  for (const day of weekdays) {
    const sheet = workbook.Sheets[day];
    const tasks: any[] = [];
    if (sheet) {
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
      // iterate rows and look for task labels in first column (column A)
      let taskIndex = 0;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const cell = row[0];
        if (cell == null) continue;
        const text = String(cell).trim();
        if (!text) continue;
        // skip common header labels
        const skipLabel = ['Task','Tasks','Day','Hours','WTD'].some(k => text.toLowerCase().includes(k.toLowerCase()));
        if (skipLabel) continue;
        taskIndex++;
        const id = `gen-${day.toLowerCase()}-${taskIndex}`;
        const task: any = {
          id,
          label: text,
          category: 'core',
          allowedRoles: ['RD','VP','ADMIN'],
        };
        // if this task references labor, link to the daily labor portal and add a pill
        if (/labor/i.test(text)) {
          task.linkHref = '/pocket-manager5/features/daily-labor';
          task.linkLabel = 'Daily Labor Portal';
        }
        tasks.push(task);
      }
    }
    if (tasks.length === 0) {
      // fallback placeholder
      tasks.push({ id: `gen-${day.toLowerCase()}-1`, label: `Daily ${day} placeholder task`, category: 'core', allowedRoles: ['RD','VP','ADMIN'] });
    }
    patch[day] = tasks;
  }

  const outPath = path.join(repo, 'scripts', 'cadence_tasks_patch.json');
  await fs.promises.writeFile(outPath, JSON.stringify(patch, null, 2), 'utf-8');
  console.log('Wrote patch to', outPath);
}

main().catch(err => { console.error(err); process.exit(1); });
