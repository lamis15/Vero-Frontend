const fs = require('fs');
const path = require('path');

const tsPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.ts');
let ts = fs.readFileSync(tsPath, 'utf8');

ts = ts.replace(/#00d2ff/gi, '#00E5FF'); // Cyan focus
ts = ts.replace(/rgba\(0,\s*210,\s*255,/g, 'rgba(0, 229, 255,');

// Adjust category/score colors to be entirely in the blue-green spectrum
ts = ts.replace(/#3b82f6/gi, '#14b8a6'); // Teal instead of Blue
ts = ts.replace(/#8b5cf6/gi, '#34d399'); // Emerald instead of Purple
ts = ts.replace(/#0ea5e9/gi, '#06b6d4'); // Light cyan instead of Sky
ts = ts.replace(/#6366f1/gi, '#0284c7'); // Soft oceanic blue instead of Indigo
ts = ts.replace(/#fb7185/gi, '#f43f5e'); // Keep rose for alerts

fs.writeFileSync(tsPath, ts, 'utf8');
console.log('TS updated successfully');
