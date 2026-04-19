const fs = require('fs');
const path = require('path');

const tsPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.ts');
let tsContent = fs.readFileSync(tsPath, 'utf8');

// 1. Insert displayMetrics
const target1 =   // --- Goals ---;
const replacement1 =   // --- Animated Values ---
  displayMetrics = {
    score: 0,
    carbon: 0,
    water: 0,
    energy: 0
  };
  private animFrameId: number | null = null;
  private chartAnimId: number | null = null;

  // --- Goals ---;
tsContent = tsContent.replace(target1, replacement1);

// 2. Insert animateValues trigger at loadDashboard
const target2 =         // Render chart after view updates
        setTimeout(() => this.renderTrendChart(), 50);;
const replacement2 =         // Trigger animations
        setTimeout(() => {
          this.animateValues();
          this.renderTrendChart();
        }, 50);;
tsContent = tsContent.replace(target2, replacement2);

// 3. New easing and animation loops
const newAnims = 
  // --- Animation Engines ---
  
  private easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  private animateValues(): void {
    if (!this.dashboard) return;
    
    // reset
    this.displayMetrics = { score: 0, carbon: 0, water: 0, energy: 0 };
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const targets = {
      score: this.dashboard.ecoScore || 0,
      carbon: this.dashboard.totalCarbonKg || 0,
      water: this.dashboard.totalWaterLiters || 0,
      energy: this.dashboard.totalEnergyKwh || 0
    };

    const duration = 1500;
    const start = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeOutQuart(progress);

      this.ngZone.run(() => {
        this.displayMetrics = {
          score: targets.score * eased,
          carbon: targets.carbon * eased,
          water: targets.water * eased,
          energy: targets.energy * eased
        };
        this.cdr.markForCheck();
      });

      if (progress < 1) {
        this.animFrameId = requestAnimationFrame(animate);
      }
    };
    
    this.animFrameId = requestAnimationFrame(animate);
  }

  private renderTrendChart(): void {
    const canvas = this.trendCanvas?.nativeElement;
    if (!canvas || !this.dashboard?.weeklyTrend?.length) return;

    if (this.chartAnimId) cancelAnimationFrame(this.chartAnimId);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const data = this.dashboard.weeklyTrend;
    const values = data.map(d => d.carbonKg || 0);
    const maxVal = Math.max(...values, 1);

    const padTop = 20;
    const padBot = 28;
    const padLeft = 16;
    const padRight = 16;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBot;

    const points = values.map((v, i) => ({
      x: padLeft + (i / (values.length - 1)) * chartW,
      y: padTop + chartH - (v / maxVal) * chartH
    }));

    const duration = 1800; // 1.8s drawing
    const start = performance.now();

    const draw = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeOutQuart(progress);
      
      ctx.clearRect(0, 0, W, H);
      
      const currentSegments = Math.max(1, Math.floor(eased * points.length));
      
      // Draw organic trailing line
      ctx.beginPath();
      for (let i = 0; i < currentSegments; i++) {
        const p = points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      
      // If we are between points, interpolate
      if (currentSegments < points.length && currentSegments > 0) {
        const prev = points[currentSegments - 1];
        const next = points[currentSegments];
        const segDist = 1 / (points.length - 1);
        const startRawProgress = (currentSegments - 1) * segDist;
        const localProgress = (eased - startRawProgress) / segDist;
        
        ctx.lineTo(
          prev.x + (next.x - prev.x) * localProgress,
          prev.y + (next.y - prev.y) * localProgress
        );
      }

      ctx.strokeStyle = 'rgba(0, 210, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Glowing dots revealing
      for (let i = 0; i < currentSegments; i++) {
        const p = points[i];
        
        // Scale dot based on how long it's been alive
        const dotAge = (eased - (i / points.length)) * 5;
        const dotScale = Math.min(Math.max(dotAge, 0), 1);
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 * dotScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 210, 255, 0.1)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 * dotScale, 0, Math.PI * 2);
        ctx.fillStyle = '#00d2ff';
        ctx.fill();
      }

      // X-axis labels
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px "DM Mono", monospace';
      ctx.textAlign = 'center';
      data.forEach((d, i) => {
        const dayIdx = new Date(d.date).getDay();
        const label = dayNames[(dayIdx + 6) % 7];
        ctx.fillText(label, points[i].x, H - 8);
      });

      if (progress < 1) {
        this.chartAnimId = requestAnimationFrame(draw);
      }
    };
    
    this.chartAnimId = requestAnimationFrame(draw);
  }
;

// use regex to replace old renderTrendChart
tsContent = tsContent.replace(/private renderTrendChart\(\): void \{[\s\S]*?(?=^  \/\/ --- EcoScore helpers ---)/m, newAnims);

// In analyzeText replace 'loadDashboard()' with an intelligent re-animation if needed, or leave it. Wait, the HTML requires analyzeText which uses aiText.
// Rename text 'analyzeText' -> 'analyzeWithAI' since HTML uses analyzeText. Wait! I changed the HTML to use analyzeText but TS is analyzeWithAI!
// I must align HTML analyzeText to analyzeWithAI.
// Let's replace 'analyzeText()' with 'analyzeWithAI()' in HTML.
tsContent = tsContent.replace(/analyzeText/g, 'analyzeWithAI');

fs.writeFileSync(tsPath, tsContent, 'utf8');

const htmlPath = path.join(__dirname, 'src', 'app', 'components', 'tracker', 'tracker.component.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');
htmlContent = htmlContent.replace(/analyzeText/g, 'analyzeWithAI');
fs.writeFileSync(htmlPath, htmlContent, 'utf8');

console.log('Update Complete');
