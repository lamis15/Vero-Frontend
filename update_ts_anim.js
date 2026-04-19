const fs = require('fs');
const path = require('path');

const tsPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.ts');
let ts = fs.readFileSync(tsPath, 'utf8');

ts = ts.replace(/displayMetrics = \{\s*score: 0,\s*carbon: 0,\s*water: 0,\s*energy: 0\s*\};/, displayMetrics = {
    score: 0,
    carbon: 0,
    water: 0,
    energy: 0,
    waste: 0
  };);

ts = ts.replace(/score: 0, carbon: 0, water: 0, energy: 0 \};/, score: 0, carbon: 0, water: 0, energy: 0, waste: 0 };);

ts = ts.replace(/const targets = \{\s*score: this\.dashboard\.ecoScore \|\| 0,\s*carbon: this\.dashboard\.totalCarbonKg \|\| 0,\s*water: this\.dashboard\.totalWaterLiters \|\| 0,\s*energy: this\.dashboard\.totalEnergyKwh \|\| 0\s*\};/, const targets = {
      score: this.dashboard.ecoScore || 0,
      carbon: this.dashboard.totalCarbonKg || 0,
      water: this.dashboard.totalWaterLiters || 0,
      energy: this.dashboard.totalEnergyKwh || 0,
      waste: this.dashboard.totalWasteKg || 0
    };);

ts = ts.replace(/this\.displayMetrics = \{\s*score: targets\.score \* eased,\s*carbon: targets\.carbon \* eased,\s*water: targets\.water \* eased,\s*energy: targets\.energy \* eased\s*\};/, 	his.displayMetrics = {
          score: targets.score * eased,
          carbon: targets.carbon * eased,
          water: targets.water * eased,
          energy: targets.energy * eased,
          waste: targets.waste * eased
        };);

fs.writeFileSync(tsPath, ts, 'utf8');
console.log('TS animations updated');
