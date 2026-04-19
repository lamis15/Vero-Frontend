const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.css');
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace(/#00d2ff/gi, '#00E5FF'); // Cyan focus
css = css.replace(/#0088ff/gi, '#10b981'); // Emerald
css = css.replace(/#0b1a30/gi, '#093B42'); // Deep Teal inner
css = css.replace(/#050e1f/gi, '#07272D'); // Deep teal mid
css = css.replace(/#02050c/gi, '#04161B'); // Deep teal outer
css = css.replace(/rgba\(0,\s*210,\s*255,/g, 'rgba(0, 229, 255,');
css = css.replace(/rgba\(12,\s*24,\s*44,/g, 'rgba(9, 36, 40,');
css = css.replace(/rgba\(8,\s*16,\s*28,/g, 'rgba(5, 23, 26,');
css = css.replace(/#030a14/gi, '#021214'); 
css = css.replace(/#05142b/gi, '#072A30'); 
css = css.replace(/#0a1d3d/gi, '#0A3A42'); 

fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS updated successfully');
