import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, NgZone, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { DashboardService } from '../../services/dashboard.service';
import { CarbonActivityService } from '../../services/carbon-activity.service';
import { CarbonGoalService } from '../../services/carbon-goal.service';
import { CarbonAIService } from '../../services/carbon-ai.service';
import { CarbonTipService } from '../../services/carbon-tip.service';
import { AuthService } from '../../services/auth.service';
import { EcoDashboardDTO, DailyCarbon } from '../../services/dashboard.models';
import {
  CarbonActivity, CarbonGoal, ActivityType,
  ACTIVITY_ICONS, ACTIVITY_LABELS, ACTIVITY_COLORS
} from '../../services/carbon.models';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrackerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('trendCanvas', { static: false }) trendCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('islandCanvas', { static: false }) set islandCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    // Re-initialize Three.js when canvas becomes available (after loading state changes)
    if (ref && ref.nativeElement) {
      // Small delay to ensure DOM is ready
      setTimeout(() => this.reinitThreeSceneIfNeeded(ref.nativeElement), 50);
    }
  }

  // ─── Single source of truth ───
  dashboard: EcoDashboardDTO | null = null;
  activities: CarbonActivity[] = [];
  state: 'loading' | 'ready' | 'error' = 'loading';

  // ─── Computed from dashboard ───
  breakdownRows: { type: string; label: string; letter: string; value: number; pct: number; color: string }[] = [];

  // ─── Animated Values ───
  displayMetrics = {
    score: 0,
    carbon: 0,
    water: 0,
    energy: 0,
    waste: 0
  };
  private animFrameId = 0;
  private chartAnimId = 0;

  // ─── Three.js ───
  private threeRenderer: THREE.WebGLRenderer | null = null;
  private threeScene: THREE.Scene | null = null;
  private threeCamera: THREE.PerspectiveCamera | null = null;
  private islandModel: THREE.Group | null = null;
  private threeAnimId = 0;
  private resizeHandler: (() => void) | null = null;
  private islandBaseY = 0;

  // ─── Mouse Interaction ───
  private mousePos = { x: 0, y: 0 };
  private lastMousePos = { x: 0, y: 0 };
  private targetRotation = { x: 0, y: 0 };
  private currentRotation = { x: 0, y: 0 };
  private isDragging = false;
  private dragSensitivity = 0.005;

  // ─── Goals ───
  activeGoals: CarbonGoal[] = [];
  showGoalForm = false;
  newGoal: Partial<CarbonGoal> = {
  activityType: 'TRANSPORT',
  impactType: 'CARBON',  // ADD THIS
  targetValue: 0,        // RENAME from targetCarbonKg
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
};

  // ─── Forms ───
  showAddForm = false;
  submitting = false;
  newActivity: Partial<CarbonActivity> = {
    activityType: 'TRANSPORT',
    description: '',
    carbonKg: 0,
    waterLiters: 0,
    energyKwh: 0,
    wasteKg: 0,
    landM2: 0,
    source: 'MANUAL'
  };

  // ─── AI ───
  aiText = '';
  aiLoading = false;
  aiResult: CarbonActivity | null = null;
  showAIBubble = false;

  // ─── Scan ───
  scanLoading = false;
  scanPreviewUrl: string | ArrayBuffer | null = null;

  // ─── Editing ───
  editingActivityId: number | null = null;
  editActivityData: Partial<CarbonActivity> = {};

  // ─── Helpers ───
  activityTypes: ActivityType[] = ['TRANSPORT', 'FOOD', 'ENERGY', 'SHOPPING', 'WASTE'];
  icons: Record<string, string> = ACTIVITY_ICONS;
  labels: Record<string, string> = ACTIVITY_LABELS;
  colors: Record<string, string> = ACTIVITY_COLORS;

  readonly categoryColors: Record<string, string> = {
    TRANSPORT: '#00E5FF',
    FOOD: '#14b8a6',
    ENERGY: '#34d399',
    SHOPPING: '#06b6d4',
    WASTE: '#0284c7'
  };

  constructor(
    private dashboardService: DashboardService,
    private activityService: CarbonActivityService,
    private goalService: CarbonGoalService,
    private aiService: CarbonAIService,
    private tipService: CarbonTipService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.loadDashboard();
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngAfterViewInit(): void {
    // The ViewChild setter will handle initialization when canvas is available
    // Delay slightly to ensure DOM is fully ready
    setTimeout(() => {
      // Trigger re-check of canvas if available
      const canvas = this.trendCanvas?.nativeElement?.closest('.eco-page')?.querySelector('.dash-island-canvas') as HTMLCanvasElement;
      if (canvas) {
        this.reinitThreeSceneIfNeeded(canvas);
      }
    }, 200);
  }

  ngOnDestroy(): void {
    // Clean up all Three.js resources
    this.cleanupThreeScene();
  }

  // ─── Three.js Re-init ───

  private onMouseDown!: (e: MouseEvent) => void;
  private onMouseMove!: (e: MouseEvent) => void;
  private onMouseUp!: () => void;

  private reinitThreeSceneIfNeeded(canvas: HTMLCanvasElement): void {
    // If we already have a renderer but the canvas is different, we need to re-init
    if (this.threeRenderer) {
      const currentCanvas = this.threeRenderer.domElement;
      if (currentCanvas === canvas) {
        // Same canvas, no need to re-init
        return;
      }
      // Different canvas - cleanup old scene
      this.cleanupThreeScene();
    }
    // Initialize new scene
    this.initThreeSceneForCanvas(canvas);
  }

  private cleanupThreeScene(): void {
    if (this.threeAnimId) {
      cancelAnimationFrame(this.threeAnimId);
      this.threeAnimId = 0;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // Clean up mouse events from old canvas
    if (this.threeRenderer) {
      const oldCanvas = this.threeRenderer.domElement;
      if (oldCanvas) {
        oldCanvas.removeEventListener('mousedown', this.onMouseDown);
        oldCanvas.removeEventListener('mousemove', this.onMouseMove);
        oldCanvas.removeEventListener('mouseup', this.onMouseUp);
        oldCanvas.removeEventListener('mouseleave', this.onMouseUp);
      }
    }

    if (this.threeRenderer) {
      this.threeRenderer.dispose();
      this.threeRenderer = null;
    }
    if (this.threeScene) {
      this.threeScene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
      this.threeScene = null;
    }
    this.islandModel = null;
    this.threeCamera = null;
  }

  private initThreeSceneForCanvas(canvas: HTMLCanvasElement): void {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight || 380;

    // Scene
    this.threeScene = new THREE.Scene();

    // Camera
    this.threeCamera = new THREE.PerspectiveCamera(35, W / H, 0.1, 1000);
    this.threeCamera.position.set(0, 5, 12);
    this.threeCamera.lookAt(0, 0, 0);

    // Renderer
    this.threeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.threeRenderer.setSize(W, H);
    this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.threeScene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffe4c4, 1.5);
    dir.position.set(5, 8, 4);
    this.threeScene.add(dir);

    const rimLight = new THREE.DirectionalLight(0x00E5FF, 0.3);
    rimLight.position.set(-3, 2, -4);
    this.threeScene.add(rimLight);

    // Load GLB
    const loader = new GLTFLoader();
    loader.load('assets/images/low_poly_island.glb', (gltf) => {
      this.islandModel = gltf.scene;

      const box = new THREE.Box3().setFromObject(this.islandModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = 10;
      const scaleFactor = targetSize / maxDim;
      this.islandModel.scale.setScalar(scaleFactor);

      const scaledBox = new THREE.Box3().setFromObject(this.islandModel);
      const center = scaledBox.getCenter(new THREE.Vector3());
      this.islandModel.position.sub(center);
      this.islandBaseY = this.islandModel.position.y;

      this.islandModel.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      this.threeScene!.add(this.islandModel);
    },
    undefined,
    (err) => console.warn('GLB load error:', err)
    );

    // Resize handler
    this.resizeHandler = () => {
      if (!wrap || !this.threeCamera || !this.threeRenderer) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight || 380;
      this.threeCamera.aspect = w / h;
      this.threeCamera.updateProjectionMatrix();
      this.threeRenderer.setSize(w, h);
    };
    window.addEventListener('resize', this.resizeHandler);

    // Mouse events
    this.onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.lastMousePos.x = e.clientX;
      this.lastMousePos.y = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || !this.islandModel) return;
      const deltaX = e.clientX - this.lastMousePos.x;
      const deltaY = e.clientY - this.lastMousePos.y;
      this.targetRotation.y += deltaX * this.dragSensitivity;
      this.targetRotation.x += deltaY * this.dragSensitivity;
      this.targetRotation.x = Math.max(-0.5, Math.min(0.5, this.targetRotation.x));
      this.lastMousePos.x = e.clientX;
      this.lastMousePos.y = e.clientY;
    };

    this.onMouseUp = () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseUp);
    canvas.style.cursor = 'grab';

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      this.threeAnimId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (this.islandModel) {
        const smoothFactor = 0.1;
        this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * smoothFactor;
        this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * smoothFactor;
        this.islandModel.rotation.x = this.currentRotation.x;
        this.islandModel.rotation.y = this.currentRotation.y + Math.sin(elapsed * 0.3) * 0.05;
        this.islandModel.position.y = this.islandBaseY + Math.sin(elapsed * 0.5) * 0.15;
      }

      if (this.threeRenderer && this.threeScene && this.threeCamera) {
        this.threeRenderer.render(this.threeScene, this.threeCamera);
      }
    };
    animate();
  }

  // ─── Data Loading ───

  loadDashboard(): void {
    this.state = 'loading';
    this.dashboardService.getDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.computeBreakdown();
        this.state = 'ready';
        this.cdr.markForCheck();
        // Load detail data not in dashboard DTO
        this.loadActivities();
        this.loadGoals();
        // Trigger animations
        setTimeout(() => {
          this.animateValues();
          this.renderTrendChart();
        }, 50);
      },
      error: () => {
        this.state = 'error';
        this.cdr.markForCheck();
      }
    });
  }

  private loadActivities(): void {
    this.activityService.getAll().subscribe({
      next: (acts) => {
        this.activities = acts ?? [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadGoals(): void {
    this.goalService.getAll().subscribe({
      next: (goals) => {
        this.activeGoals = (goals ?? []).map(g => ({
          ...g,
          progressPct: Math.min(g.progressPct || 0, 100)
        }));
        this.cdr.markForCheck();
      }
    });
  }

  private computeBreakdown(): void {
    if (!this.dashboard?.carbonByType) { this.breakdownRows = []; return; }
    const entries = Object.entries(this.dashboard.carbonByType);
    const total = entries.reduce((s, [, v]) => s + (v || 0), 0) || 1;

    this.breakdownRows = entries
      .map(([type, value]) => ({
        type,
        label: ACTIVITY_LABELS[type as ActivityType] || type,
        letter: ACTIVITY_ICONS[type as ActivityType] || '?',
        value: value || 0,
        pct: Math.round(((value || 0) / total) * 100),
        color: this.categoryColors[type] || '#666'
      }))
      .sort((a, b) => b.value - a.value);
  }

  /** Generate a 20-element boolean array for the dot matrix visualization */
  getDotGrid(pct: number): boolean[] {
    const total = 20;
    const filled = Math.round((pct / 100) * total);
    return Array.from({ length: total }, (_, i) => i < filled);
  }

  // ─── Animation Engines ───

  private MathPow = Math.pow;

  private easeOutQuart(t: number): number {
    return 1 - this.MathPow(1 - t, 4);
  }

  private animateValues(): void {
    if (!this.dashboard) return;

    this.displayMetrics = { score: 0, carbon: 0, water: 0, energy: 0, waste: 0 };
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const targets = {
      score: this.dashboard.ecoScore || 0,
      carbon: this.dashboard.totalCarbonKg || 0,
      water: this.dashboard.totalWaterLiters || 0,
      energy: this.dashboard.totalEnergyKwh || 0,
      waste: this.dashboard.totalWasteKg || 0
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
          energy: targets.energy * eased,
          waste: targets.waste * eased
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

    const duration = 1800;
    const start = performance.now();

    const draw = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeOutQuart(progress);

      ctx.clearRect(0, 0, W, H);

      const currentSegments = Math.max(1, Math.floor(eased * points.length));

      ctx.beginPath();
      for (let i = 0; i < currentSegments; i++) {
        const p = points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }

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

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      for (let i = 0; i < currentSegments; i++) {
        const p = points[i];

        const dotAge = (eased - (i / points.length)) * 5;
        const dotScale = Math.min(Math.max(dotAge, 0), 1);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 * dotScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 * dotScale, 0, Math.PI * 2);
        ctx.fillStyle = '#00E5FF';
        ctx.fill();
      }

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

  // ─── EcoScore helpers ───

  get scoreColor(): string {
    const s = this.dashboard?.ecoScore ?? 0;
    if (s >= 80) return '#00E5FF';
    if (s >= 60) return '#14b8a6';
    if (s >= 40) return '#34d399';
    return '#f43f5e';
  }

  // ─── Formatting ───

  formatVal(val: number | undefined | null): string {
    if (!val || !isFinite(val)) return '0';
    if (val >= 10000) return (val / 1000).toFixed(0) + 'k';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    if (val >= 100) return val.toFixed(0);
    return val.toFixed(1);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ─── Activity CRUD ───

  submitActivity(): void {
    if (!this.newActivity.description?.trim()) return;
    this.submitting = true;

    const payload: Partial<CarbonActivity> = {
      ...this.newActivity,
      carbonKg: this.newActivity.carbonKg || 0,
      waterLiters: this.newActivity.waterLiters || 0,
      energyKwh: this.newActivity.energyKwh || 0,
      wasteKg: this.newActivity.wasteKg || 0,
      landM2: this.newActivity.landM2 || 0,
      date: new Date().toISOString().split('T')[0]
    };

    this.activityService.create(payload).pipe(
      finalize(() => { this.submitting = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: () => {
        this.showAddForm = false;
        this.newActivity = { activityType: 'TRANSPORT', description: '', carbonKg: 0, waterLiters: 0, energyKwh: 0, wasteKg: 0, landM2: 0, source: 'MANUAL' };
        this.loadDashboard();
      }
    });
  }

  startEditActivity(a: CarbonActivity): void {
    this.editingActivityId = a.id!;
    this.editActivityData = { ...a };
  }

  cancelEditActivity(): void {
    this.editingActivityId = null;
    this.editActivityData = {};
  }

  saveEditActivity(): void {
    if (!this.editingActivityId || !this.editActivityData.description?.trim()) return;
    this.submitting = true;

    this.activityService.update(this.editingActivityId, this.editActivityData).pipe(
      finalize(() => { this.submitting = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: () => {
        this.editingActivityId = null;
        this.loadDashboard();
      }
    });
  }

  deleteActivity(id: number): void {
    this.activities = this.activities.filter(a => a.id !== id);
    this.cdr.markForCheck();
    this.activityService.delete(id).subscribe({
      next: () => this.loadDashboard(),
      error: () => this.loadDashboard()
    });
  }

  // ─── AI Analysis ───

  analyzeWithAI(): void {
    if (!this.aiText.trim()) return;
    this.aiLoading = true;
    this.aiResult = null;
    this.aiService.analyze(this.aiText).subscribe({
      next: result => {
        this.aiResult = result;
        this.aiLoading = false;
        this.aiText = '';
        this.showAIBubble = false; // Close bubble after success
        this.loadDashboard();
      },
      error: () => {
        this.aiLoading = false;
        this.aiResult = null;
      }
    });
  }

  // ─── Vero Lens ───

  triggerFileSelect(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.scanLoading = true;
    this.cdr.markForCheck();

    const reader = new FileReader();
    reader.onload = (e) => {
      this.ngZone.run(() => {
        this.scanPreviewUrl = e.target?.result as string;
        this.cdr.markForCheck();
      });
    };
    reader.readAsDataURL(file);

    this.activityService.scanReceipt(file).pipe(
      finalize(() => {
        this.scanLoading = false;
        setTimeout(() => { this.scanPreviewUrl = null; this.cdr.markForCheck(); }, 4000);
      })
    ).subscribe({
      next: (result) => {
        this.aiResult = result;
        this.loadDashboard();
      },
      error: (err) => {
        console.error('Scan failed', err);
        this.scanPreviewUrl = null;
        this.cdr.markForCheck();
      }
    });

    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  // ─── Export ───

  downloadReport(): void {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.dashboardService.downloadReport(month).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eco-report-${month}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  // ─── Goal CRUD ───

  submitGoal(): void {
  if (!this.newGoal.targetValue || !this.newGoal.startDate || !this.newGoal.endDate) return;  // FIX targetCarbonKg → targetValue
  this.submitting = true;
 
  this.goalService.create(this.newGoal).pipe(
    finalize(() => { this.submitting = false; this.cdr.markForCheck(); })
  ).subscribe({
    next: (created) => {
      this.activeGoals.push({ ...created, progressPct: 0 });
      this.showGoalForm = false;
      this.newGoal = {
        activityType: 'TRANSPORT',
        impactType: 'CARBON',  // ADD THIS
        targetValue: 0,        // FIX targetCarbonKg → targetValue
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
      };
      this.loadDashboard();
    }
  });
}

  deleteGoal(id: number): void {
    this.activeGoals = this.activeGoals.filter(g => g.id !== id);
    this.cdr.markForCheck();
    this.goalService.delete(id).subscribe({
      next: () => this.loadDashboard(),
      error: () => this.loadDashboard()
    });
  }
}
