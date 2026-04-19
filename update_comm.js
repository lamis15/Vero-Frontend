const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'app', 'components', 'community', 'community.component.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Reduce border and visual noise on dispatch cards
css = css.replace(/border: 1px solid rgba\(255, 255, 255, 0\.08\);/g, 'border: 1px solid rgba(255, 255, 255, 0.02);');
css = css.replace(/background: rgba\(255, 255, 255, 0\.04\);/g, 'background: rgba(255, 255, 255, 0.05);');

// Clean up almanac body padding
css = css.replace(/\.almanac-feed \{\s*padding: 48px 48px;/g, '.almanac-feed { padding: 12px 48px;'); // Less top padding since hero is taking it

// Append new Hero Card CSS
css += 
/* -- Community Hero Card -- */
.community-hero-card {
  display: flex;
  background: linear-gradient(135deg, rgba(82, 183, 136, 0.15) 0%, rgba(20, 199, 165, 0.05) 100%);
  border-radius: 24px;
  padding: 40px 48px;
  margin-bottom: 40px;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15), inset 0 2px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  animation: almanacReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
  border: 1px solid rgba(255,255,255,0.06);
  position: relative;
  overflow: hidden;
}

.hero-left {
  flex: 1;
  max-width: 55%;
  z-index: 2;
}

.hero-left h1 {
  font-family: 'DM Sans', sans-serif;
  font-size: clamp(32px, 4vw, 42px);
  font-weight: 700;
  color: #ffffff;
  line-height: 1.1;
  margin-bottom: 16px;
  letter-spacing: -1px;
}

.hero-left p {
  font-family: 'DM Sans', sans-serif;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin-bottom: 28px;
}

.hero-cta-btn {
  background: linear-gradient(90deg, #10b981, #14C7A5);
  color: #021214;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 15px;
  border: none;
  padding: 12px 28px;
  border-radius: 100px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
}

.hero-cta-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(16, 185, 129, 0.4);
}

.hero-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  position: relative;
  z-index: 2;
}

.hero-img {
  max-width: 260px;
  height: auto;
  filter: drop-shadow(0 20px 30px rgba(0,0,0,0.3));
  animation: slowFloat 5s ease-in-out infinite;
}

@media (max-width: 768px) {
  .community-hero-card {
    flex-direction: column;
    padding: 32px 24px;
    text-align: center;
  }
  .hero-left { max-width: 100%; margin-bottom: 32px; }
  .hero-right { justify-content: center; }
  .hero-img { max-width: 220px; }
}
;

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Community CSS updated');
