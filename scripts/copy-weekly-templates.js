const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'PocketManager5_sitetmpupload_samples', 'period 11 12.1.25 GC DM Monthly Biz Review - NEW TEMPLATE - May 2025 1');
const destDir = path.join(repoRoot, 'public', 'weekly-templates');

if (!fs.existsSync(srcDir)) {
  console.error('Source template directory not found:', srcDir);
  process.exit(1);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const files = ['Slide1.PNG','Slide2.PNG','Slide3.PNG','Slide4.PNG','Slide5.PNG','Slide6.PNG','Slide7.PNG'];
let copied = 0;
for (const f of files) {
  const src = path.join(srcDir, f);
  const dest = path.join(destDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Copied', f);
    copied++;
  } else {
    console.warn('Missing template file, skipping:', src);
  }
}

console.log(`Done. Copied ${copied}/${files.length} files to ${destDir}`);
