import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, NgZone, ElementRef, QueryList, ViewChildren, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { CarbonActivityService } from '../../services/carbon-activity.service';
import { CarbonGoalService } from '../../services/carbon-goal.service';
import { CarbonTipService } from '../../services/carbon-tip.service';
import { CarbonAIService } from '../../services/carbon-ai.service';
import { AuthService } from '../../services/auth.service';
import {
  CarbonActivity, CarbonGoal, ActivityType,
  ACTIVITY_ICONS, ACTIVITY_LABELS, ACTIVITY_COLORS
} from '../../services/carbon.models';
import { EcosystemScene } from './scene-manager';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.css'
})
export class TrackerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ecoCanvas', { static: false }) ecoCanvas!: ElementRef<HTMLDivElement>;
  private ecoScene!: EcosystemScene;
  
  ecoHealth = 0;
  ecoLabel = '';
  ecoLoading = true;

  // ─── Data ───
  carbonByType: Record<string, number> = {};
  totalCarbon = 0;
  activities: CarbonActivity[] = [];
  activeGoals: CarbonGoal[] = [];
  tips: string[] = [];

  // ─── UI State ───
  loading = false;
  loadError = '';

  // ─── Computed ───
  categoryRows: { type: ActivityType; icon: string; label: string; value: number; pct: number; color: string }[] = [];
  ringOffset = 816.81;
  displayCarbon = 0;   // animated counter value
  heroReady = false;   // controls CSS class for hero entrance

  // ─── Forms ───
  showAddForm = false;
  showGoalForm = false;
  submitting = false;
  newActivity: Partial<CarbonActivity> = {
    activityType: 'TRANSPORT',
    description: '',
    carbonKg: 0,
    source: 'MANUAL'
  };

  newGoal: Partial<CarbonGoal> = {
    activityType: 'TRANSPORT',
    targetCarbonKg: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
  };

  aiText = '';
  aiLoading = false;
  aiResult: CarbonActivity | null = null;

  // ─── Editing ───
  editingActivityId: number | null = null;
  editActivityData: Partial<CarbonActivity> = {};

  // ─── Helpers ───
  activityTypes: ActivityType[] = ['TRANSPORT', 'FOOD', 'ENERGY', 'SHOPPING'];
  icons = ACTIVITY_ICONS;
  labels = ACTIVITY_LABELS;
  colors = ACTIVITY_COLORS;

  constructor(
    private activityService: CarbonActivityService,
    private goalService: CarbonGoalService,
    private tipService: CarbonTipService,
    private aiService: CarbonAIService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.loadData();
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngAfterViewInit(): void {
    if (this.ecoCanvas) {
      this.ngZone.runOutsideAngular(() => {
        this.ecoScene = new EcosystemScene(this.ecoCanvas.nativeElement);
      });
    }

    // Trigger hero entrance animation slightly after paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.heroReady = true;
          this.cdr.markForCheck();
        });
      }, 80);
    });

    // Intersection Observer for scroll-reveal on body cards
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.08 }
    );
    // Observe after data renders — slight delay
    setTimeout(() => {
      document.querySelectorAll('.vt-observe').forEach(el => observer.observe(el));
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.ecoScene) this.ecoScene.dispose();
  }

  loadData(): void {
    this.loading = true;
    this.loadError = '';

    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate   = `${year}-12-31`;

    // 1. Instantly load the fast database queries
    forkJoin({
      activities: this.activityService.getAll().pipe(catchError(() => of([] as CarbonActivity[]))),
      total:      this.activityService.getTotal(startDate, endDate).pipe(catchError(() => of(0))),
      byType:     this.activityService.getCarbonByType().pipe(catchError(() => of({} as Record<string, number>))),
      goals:      this.goalService.getAll().pipe(catchError(() => of([] as CarbonGoal[])))
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: ({ activities, total, byType, goals }) => {
        this.ngZone.run(() => {
          this.activities   = activities ?? [];
          this.totalCarbon  = typeof total === 'number' && isFinite(total)
            ? Math.round(total * 100) / 100 : 0;
          this.carbonByType = byType ?? {};
          // Display all goals belonging to the user, ensure progress is capped at 100% visually
          this.activeGoals  = (goals ?? []).map(g => ({
            ...g,
            progressPct: Math.min(g.progressPct || 0, 100)
          }));
          this.computeCategories();
          this.computeRing();
          this.computeEcoHealth();
          this.cdr.markForCheck();

          // 2. Fetch AI tips asynchronously so it doesn't block the instant UI render
          this.tipService.getRecommended().subscribe({
            next: (tipsResponse) => {
              this.ngZone.run(() => {
                this.tips = tipsResponse || [];
                this.cdr.markForCheck();
              });
            },
            error: () => {
              this.ngZone.run(() => {
                this.tips = ['Reduce car travel this week.', 'Opt for plant-based meals to save 4kg of CO2.']; // Default fallbacks
                this.cdr.markForCheck();
              });
            }
          });

        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadError = 'Failed to load data. Please try refreshing.';
          this.cdr.markForCheck();
        });
      }
    });

    // 2. Load the slow AI personalized tips asynchronously in the background
    this.tipService.getRecommended().pipe(catchError(() => of([] as string[]))).subscribe(tips => {
      this.ngZone.run(() => {
        this.tips = tips ?? [];
        this.cdr.markForCheck();
      });
    });
  }

  computeCategories(): void {
    const vals  = Object.values(this.carbonByType).filter(v => typeof v === 'number' && isFinite(v));
    const maxVal = vals.length > 0 ? Math.max(...vals) : 1;
    this.categoryRows = this.activityTypes.map(type => ({
      type,
      icon:  ACTIVITY_ICONS[type],
      label: ACTIVITY_LABELS[type],
      value: this.carbonByType[type] ?? 0,
      pct:   maxVal > 0 ? ((this.carbonByType[type] ?? 0) / maxVal) * 100 : 0,
      color: ACTIVITY_COLORS[type]
    }));
  }

  computeRing(): void {
    const CIRC = 816.81;
    const pct  = Math.min((this.totalCarbon || 0) / 10000, 1);
    this.ringOffset = CIRC * (1 - pct);

    // Animated counter: count up from 0 to totalCarbon with throttled updates
    const target   = this.totalCarbon;
    const duration = 1500;
    const start    = performance.now();
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    let lastUpdate = 0;
    const tick = (now: number) => {
      const elapsed  = Math.min(now - start, duration);
      const progress = easeOutQuart(elapsed / duration);
      const val = Math.round(progress * target * 10) / 10;
      
      // Throttle angular updates to 20fps instead of 60fps+ for the number dial
      if (now - lastUpdate > 50 || elapsed === duration) {
        this.displayCarbon = val;
        this.cdr.detectChanges(); // Use localized detection instead of entire tree
        lastUpdate = now;
      }
      if (elapsed < duration) requestAnimationFrame(tick);
    };
    // Run loop entirely outside angular, only ticking the local view
    this.ngZone.runOutsideAngular(() => requestAnimationFrame(tick));
  }

  // ─── Eco Health ───
  computeEcoHealth(): void {
    if (this.activeGoals.length === 0) {
      const ratio = Math.min(this.totalCarbon / 5000, 1);
      this.ecoHealth = Math.round((1 - ratio) * 100);
    } else {
      let totalScore = 0;
      let counted = 0;
      for (const goal of this.activeGoals) {
        const pct = goal.progressPct || 0;
        totalScore += Math.max(0, 100 - pct);
        counted++;
      }
      this.ecoHealth = counted > 0 ? Math.round(totalScore / counted) : 70;
    }

    if (this.ecoHealth >= 80)      this.ecoLabel = 'Thriving';
    else if (this.ecoHealth >= 60) this.ecoLabel = 'Stable';
    else if (this.ecoHealth >= 35) this.ecoLabel = 'Stressed';
    else                           this.ecoLabel = 'Declining';

    if (this.ecoScene) {
      this.ecoScene.setHealth(this.ecoHealth);
    }
  }

  // ─── CRUD ───
  submitGoal(): void {
    if (!this.newGoal.targetCarbonKg || !this.newGoal.startDate || !this.newGoal.endDate) return;
    this.submitting = true;
    
    const payload: Partial<CarbonGoal> = { ...this.newGoal };

    this.goalService.create(payload)
      .pipe(finalize(() => { this.submitting = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (created) => {
          this.activeGoals.push({ ...created, progressPct: 0 });
          this.showGoalForm = false;
          // Reset form
          this.newGoal = { 
            activityType: 'TRANSPORT', 
            targetCarbonKg: 0,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
          };
        },
        error: (err) => console.error('Goal submission failed', err)
      });
  }

  deleteGoal(id: number): void {
    this.activeGoals = this.activeGoals.filter(g => g.id !== id);
    this.goalService.delete(id).subscribe({
      error: () => this.loadData() // Revert on failure
    });
  }

  submitActivity(): void {
    if (!this.newActivity.description?.trim() || !this.newActivity.carbonKg) return;
    this.submitting = true;

    const payload: Partial<CarbonActivity> = {
      ...this.newActivity,
      date: new Date().toISOString().split('T')[0]
    };

    // ── Optimistic update: show item instantly before server confirms ──
    const optimistic: CarbonActivity = {
      activityType: (payload.activityType ?? 'TRANSPORT') as ActivityType,
      description:  payload.description ?? '',
      carbonKg:     payload.carbonKg ?? 0,
      date:         payload.date ?? '',
      source:       'MANUAL'
    };
    this.activities    = [optimistic, ...this.activities];
    this.totalCarbon   = Math.round((this.totalCarbon + optimistic.carbonKg) * 100) / 100;
    this.carbonByType  = {
      ...this.carbonByType,
      [optimistic.activityType]: (this.carbonByType[optimistic.activityType] ?? 0) + optimistic.carbonKg
    };
    this.computeCategories();
    this.cdr.markForCheck();

    // Close & reset form immediately
    this.showAddForm = false;
    this.newActivity  = { activityType: 'TRANSPORT', description: '', carbonKg: 0, source: 'MANUAL' };

    // Then persist and reconcile with server truth
    this.activityService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.loadData();
      },
      error: () => {
        // Roll back optimistic update on server failure
        this.submitting = false;
        this.loadData();
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

    this.activityService.update(this.editingActivityId, this.editActivityData).subscribe({
      next: () => {
        this.submitting = false;
        this.editingActivityId = null;
        this.loadData();
      },
      error: () => {
        this.submitting = false;
        this.loadData();
      }
    });
  }

  deleteActivity(id: number): void {
    // Optimistic removal
    this.activities   = this.activities.filter(a => a.id !== id);
    this.cdr.markForCheck();
    this.activityService.delete(id).subscribe({
      next:  () => this.loadData(),
      error: () => this.loadData() // restore on failure
    });
  }

  // ─── AI ───
  analyzeWithAI(): void {
    if (!this.aiText.trim()) return;
    this.aiLoading = true;
    this.aiResult  = null;
    this.aiService.analyze(this.aiText).subscribe({
      next: result => {
        this.aiResult  = result;
        this.aiLoading = false;
        this.aiText    = '';
        this.loadData();
      },
      error: () => {
        this.aiLoading = false;
        this.aiResult  = null;
      }
    });
  }

  formatKg(kg: number): string {
    if (!kg || !isFinite(kg)) return '0 kg';
    if (kg >= 1000) return (kg / 1000).toFixed(1) + 't';
    return kg.toFixed(1) + ' kg';
  }
}
