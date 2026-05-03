'use strict';
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const files = [
  'js/constants.js',
  'js/utils.js',
  'js/habits-routines.js',
  'js/shifts.js',
  'js/time-templates.js',
  'js/calendar-stats.js',
  'js/actions.js',
  'js/features.js',
  'js/core.js',
  'js/views/nav.js',
  'js/views/dashboard.js',
  'js/views/tasks.js',
  'js/views/myday-habits.js',
  'js/views/settings-forms.js',
  'js/views/kids.js',
  'js/views/health-money.js',
  'js/views/bills.js',
  'js/views/shifts-timeline.js',
  'js/views/whatnow-dispatch.js',
  'js/init.js',
  'js/chat.js',
];

async function build() {
  const raw = files.map(f => {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    return `/* ---- ${f} ---- */\n${src}`;
  }).join('\n');

  const rawKb = (Buffer.byteLength(raw, 'utf8') / 1024).toFixed(1);

  const result = await minify(raw, {
    compress: {
      passes: 2,
      drop_debugger: true,
    },
    // toplevel:false (default) — top-level function names are NOT mangled.
    // This is critical: inline HTML handlers like onclick="toggleComp(...)"
    // reference these names as strings, so they must stay unchanged.
    mangle: { toplevel: false },
    format: { comments: false },
  });

  const dest = path.join(__dirname, 'app.bundle.js');
  fs.writeFileSync(dest, result.code, 'utf8');

  const minKb = (Buffer.byteLength(result.code, 'utf8') / 1024).toFixed(1);
  const pct = (100 - (parseFloat(minKb) / parseFloat(rawKb) * 100)).toFixed(0);
  console.log(`[build] app.bundle.js  ${rawKb} KB → ${minKb} KB  (${pct}% reduction, ${files.length} files)`);
}

build().catch(err => {
  console.error('[build] FAILED:', err.message || err);
  process.exit(1);
});
