const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// EcoScore binding replacement
html = html.replace(/\{\{\s*dashboard\.ecoScore\s*\}\}(?!%)/g, "{{ displayMetrics.score | number:'1.0-0' }}");
html = html.replace(/\{\{\s*dashboard\.ecoScore\s*\}\}%/g, "{{ displayMetrics.score | number:'1.0-0' }}%");
html = html.replace(/\[style\.stroke-dashoffset\]="326\.7 - \(326\.7 \* \(dashboard\.ecoScore \/ 100\)\)"/g, '[style.stroke-dashoffset]="326.7 - (326.7 * (displayMetrics.score / 100))"');

// Metrics row binding replacements
html = html.replace(/formatVal\(dashboard\.totalCarbonKg\)/g, "formatVal(displayMetrics.carbon)");
html = html.replace(/formatVal\(dashboard\.totalWaterLiters\)/g, "formatVal(displayMetrics.water)");
html = html.replace(/formatVal\(dashboard\.totalEnergyKwh\)/g, "formatVal(displayMetrics.energy)");
html = html.replace(/formatVal\(dashboard\.totalWasteKg\)/g, "formatVal(displayMetrics.waste)");

// Apply staggered animation classes to cards
html = html.replace(/<div class="eco-card eco-card-lg">/, '<div class="eco-card eco-card-lg eco-anim-stagger-1">');
html = html.replace(/<div class="eco-card eco-card-scan">/, '<div class="eco-card eco-card-scan eco-anim-stagger-2">');
html = html.replace(/<div class="eco-card eco-card-goals">/, '<div class="eco-card eco-card-goals eco-anim-stagger-3">');
html = html.replace(/<div class="eco-card eco-card-history">/, '<div class="eco-card eco-card-history eco-anim-stagger-4">');

// Apply to list items
html = html.replace(/<div class="eco-log-row"/g, '<div class="eco-log-row eco-anim-slide-up" [style.animation-delay]=\"(i * 50) + \'ms\'\"');
html = html.replace(/<div class="eco-goal-item">/g, '<div class="eco-goal-item eco-anim-slide-up">'); // Could add tracking index for delay, but leaving simple

// Write changes
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML updated');
