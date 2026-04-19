const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Colors
css = css.replace(/#4ade80/gi, '#00d2ff'); // main cyber cyan
css = css.replace(/#22c55e/gi, '#0088ff'); // darker blue for buttons
css = css.replace(/#0f2b1a/gi, '#0b1a30'); // bg gradient inner
css = css.replace(/#091a12/gi, '#050e1f'); // bg gradient mid
css = css.replace(/#07130d/gi, '#02050c'); // bg gradient outer
css = css.replace(/rgba\(74,\s*222,\s*128,/g, 'rgba(0, 210, 255,'); // green rgba -> cyan rgba
css = css.replace(/rgba\(14,\s*38,\s*24,/g, 'rgba(12, 24, 44,'); // dark green glass panel rgba -> navy glass
css = css.replace(/rgba\(9,\s*26,\s*18,/g, 'rgba(8, 16, 28,'); // input strip back
css = css.replace(/#0a1a12/gi, '#030a14'); // dark text on buttons
css = css.replace(/#0a2a18/gi, '#05142b'); // history bg 1
css = css.replace(/#143828/gi, '#0a1d3d'); // history bg 2

// Let's add the animated ecoGradientFlow to the .eco-page background.
// Look for '.eco-page {' block and replace 'radial-gradient(...)' 
css = css.replace(
  /background:\s*radial-gradient\([^;]+;/g, 
  "background: radial-gradient(ellipse at 20% 0%, #0b1a30 0%, #050e1f 40%, #02050c 100%);\n  background-size: 150% 150%;\n  animation: ecoGradientFlow 12s ease-in-out infinite alternate;"
);

// Add keyframes at the top
const flowAnim = "\n@keyframes ecoGradientFlow {\n  0% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n  100% { background-position: 0% 50%; }\n}\n";
css = flowAnim + css;

fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS updated successfully');
