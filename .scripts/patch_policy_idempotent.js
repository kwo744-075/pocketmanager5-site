#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = [
  'supabase/setup',
  'supabase/migrations',
  'supabase/rls'
].map((p) => path.join(root, p));

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && full.toLowerCase().endsWith('.sql')) out.push(full);
  }
  return out;
}

function makeBackup(filePath, content) {
  const backupDir = path.join(root, '.scripts', 'policy-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const rel = path.relative(root, filePath).replace(/\\/g, '-').replace(/\//g, '-');
  const dest = path.join(backupDir, rel + '.orig.sql');
  fs.writeFileSync(dest, content, 'utf8');
  return dest;
}

const policyRegex = /CREATE\s+POLICY\s+IF\s+NOT\s+EXISTS\s+("([^"]+)"|([\w\-\.]+))\s+ON\s+([\w\.]+)\s+([\s\S]*?);/ig;

let totalFiles = 0;
let patchedFiles = 0;

for (const t of targets) {
  const files = walk(t);
  for (const f of files) {
    totalFiles++;
    const src = fs.readFileSync(f, 'utf8');
    let m;
    let out = src;
    const matches = [];
    while ((m = policyRegex.exec(src)) !== null) {
      matches.push(m);
    }
    if (matches.length === 0) continue;
    // backup
    const backup = makeBackup(f, src);
    console.log(`Patching ${f} (backup -> ${backup})`);
    // perform replacements from last to first to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const fullMatch = m[0];
      const quoted = m[2];
      const plain = m[3];
      const policyName = quoted || plain;
      const onTarget = m[4]; // maybe schema.table or table
      const remainder = m[5]; // rest of policy body
      // compute schema and table
      let schema = 'public';
      let table = onTarget;
      if (onTarget.includes('.')) {
        const parts = onTarget.split('.');
        schema = parts[0];
        table = parts[1];
      }
      // unquote policyName for comparison
      const policyNameUnq = policyName.replace(/^"|"$/g, '');

      // build the DO $$ block
      const createStmt = `CREATE POLICY ${policyName} ON ${onTarget} ${remainder}`;
      const doBlock = `DO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM pg_policies WHERE schemaname = '${schema}' AND tablename = '${table}' AND policyname = '${policyNameUnq}'\n  ) THEN\n    EXECUTE $$${createStmt}$$;\n  END IF;\nEND $$;`;

      // replace the specific full match with doBlock
      const idx = out.lastIndexOf(fullMatch);
      if (idx !== -1) {
        out = out.slice(0, idx) + doBlock + out.slice(idx + fullMatch.length);
      }
    }
    if (out !== src) {
      fs.writeFileSync(f, out, 'utf8');
      patchedFiles++;
    }
  }
}

console.log(`Scanned ${totalFiles} files; patched ${patchedFiles} files.`);
if (patchedFiles > 0) process.exitCode = 0; else process.exitCode = 0;
