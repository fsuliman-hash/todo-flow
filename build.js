'use strict';
const fs = require('fs');
const path = require('path');

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

const out = files.map(f => {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  return `/* ---- ${f} ---- */\n${src}`;
}).join('\n');

const dest = path.join(__dirname, 'app.bundle.js');
fs.writeFileSync(dest, out, 'utf8');
const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
console.log(`[build] app.bundle.js  ${kb} KB  (${files.length} files)`);
