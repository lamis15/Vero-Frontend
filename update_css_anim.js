const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace card hover for deeper motion
css = css.replace(
  /\.eco-card:hover \{\s*border-color: [^;]+;\s*box-shadow: [^;]+;\s*transform: [^\}]+\}/,
  .eco-card:hover {
  border-color: rgba(0, 210, 255, 0.25);
  box-shadow: 0 12px 60px rgba(0, 210, 255, 0.12);
  transform: translateY(-4px) scale(1.01);
  z-index: 2;
}
);

// Append Animations
const animCSS = 

/* --- PREMIUM MOTION SYSTEM --- */

@keyframes ecoFadeUp {
  from { opacity: 0; transform: translateY(24px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.eco-anim-stagger-1 { animation: ecoFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
.eco-anim-stagger-2 { animation: ecoFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }
.eco-anim-stagger-3 { animation: ecoFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }
.eco-anim-stagger-4 { animation: ecoFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }

.eco-anim-slide-up {
  animation: ecoFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Enhancing existing glow */
@keyframes slowFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.05); }
}

.eco-scan-glow {
  animation: slowFloat 4s ease-in-out infinite;
}

@keyframes drawStroke {
  to { stroke-dashoffset: 0; }
}

.eco-ring-fill {
  /* It already transitions smoothly from JS, but let's make it snap cooler */
  transition: stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.eco-icon-btn, .eco-pill-btn, .eco-scan-trigger, .eco-submit-btn, .eco-cat-pill, .eco-mini-btn {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.eco-icon-btn:active, .eco-pill-btn:active, .eco-scan-trigger:active, .eco-submit-btn:active, .eco-mini-btn:active {
  transform: scale(0.94) !important;
}

/* Subtle Shimmer for metrics */
.eco-m-val {
  position: relative;
}
;

fs.writeFileSync(cssPath, css + animCSS, 'utf8');
console.log('CSS classes added');
