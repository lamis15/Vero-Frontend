import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ScoringService } from '../../services/Scoring.service';
import { environment } from '../../../environments/environment';
import {
  ScoredRow,
  ScoreStats,
  FilterKey,
  SortKey,
  toProfile,
  computeStats
} from '../../models/reservation-score.model';

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './Admin reservations.component.html',
  styleUrls: ['./Admin reservations.component.css'],
})
export class AdminReservationsComponent implements OnInit, OnDestroy {

  allScored: ScoredRow[] = [];
  filteredScored: ScoredRow[] = [];
  scoringLoading = true;
  stats!: ScoreStats;

  activeFilter: FilterKey = 'all';
  activeSortKey: SortKey = 'score-desc';

  private eventId: number | null = null;
  eventTitle = '';

  expandedId: number | null = null;
  processedIds = new Set<number>();

  successMessage = '';
  errorMessage = '';

  eventsMenuOpen = true;

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private http: HttpClient,
    public router: Router,
    private route: ActivatedRoute,
    private scoring: ScoringService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.eventId = params['eventId'] ? +params['eventId'] : null;
      this.eventTitle = params['eventTitle'] ?? '';
      this.loadScored();
    });

    this.refreshInterval = setInterval(() => this.silentRefresh(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  toggleEventsMenu(): void {
    this.eventsMenuOpen = !this.eventsMenuOpen;
  }

  goTo(path: string): void {
    this.router.navigateByUrl(path);
  }

  goToAdminTab(tab: 'messages' | 'add'): void {
    this.router.navigate(['/admin'], { queryParams: { tab } });
  }

  loadScored(): void {
    this.scoringLoading = true;

    const obs$ = this.eventId
      ? this.scoring.getScoredPendingByEvent(this.eventId)
      : this.scoring.getScoredPending();

    obs$
      .pipe(
        finalize(() => {
          this.scoringLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          const fresh = (data ?? []).map(d => ({
            ...d,
            profile: toProfile(d.globalScore)
          }));

          this.mergeFreshData(fresh);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Scoring load error:', err);
          this.allScored = [];
          this.filteredScored = [];
          this.stats = computeStats([]);
          this.showError(err?.error?.message || 'Impossible de charger les scores.');
          this.cdr.detectChanges();
        }
      });
  }

  private silentRefresh(): void {
    const obs$ = this.eventId
      ? this.scoring.getScoredPendingByEvent(this.eventId)
      : this.scoring.getScoredPending();

    obs$.subscribe({
      next: (data) => {
        const fresh = (data ?? []).map(d => ({
          ...d,
          profile: toProfile(d.globalScore)
        }));

        this.mergeFreshData(fresh);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private mergeFreshData(fresh: ScoredRow[]): void {
    const processedRows = this.allScored.filter(r =>
      this.processedIds.has(r.reservation.id)
    );

    const freshIds = new Set(fresh.map(r => r.reservation.id));

    const onlyProcessed = processedRows.filter(r =>
      !freshIds.has(r.reservation.id)
    );

    this.allScored = [...fresh, ...onlyProcessed];
    this.stats = computeStats(fresh);
    this.applyFilters();
  }

  setFilter(f: FilterKey): void {
    this.activeFilter = f;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  setSort(s: SortKey): void {
    this.activeSortKey = s;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  private applyFilters(): void {
    let list = [...this.allScored];

    switch (this.activeFilter) {
      case 'reliable':
        list = list.filter(r => r.globalScore >= 75);
        break;
      case 'cancel-high':
        list = list.filter(r => r.cancelRate >= 40);
        break;
      case 'eco':
        list = list.filter(r => r.ecoScore >= 8);
        break;
      case 'new':
        list = list.filter(r => r.newMember);
        break;
    }

    switch (this.activeSortKey) {
      case 'score-desc':
        list.sort((a, b) => b.globalScore - a.globalScore);
        break;
      case 'score-asc':
        list.sort((a, b) => a.globalScore - b.globalScore);
        break;
      case 'eco-desc':
        list.sort((a, b) => b.ecoScore - a.ecoScore);
        break;
      case 'cancel-desc':
        list.sort((a, b) => b.cancelRate - a.cancelRate);
        break;
      case 'events-desc':
        list.sort((a, b) => b.confirmedReservations - a.confirmedReservations);
        break;
    }

    this.filteredScored = list;
  }

  countForFilter(f: FilterKey): number {
    switch (f) {
      case 'reliable':
        return this.allScored.filter(r => r.globalScore >= 75).length;
      case 'cancel-high':
        return this.allScored.filter(r => r.cancelRate >= 40).length;
      case 'eco':
        return this.allScored.filter(r => r.ecoScore >= 8).length;
      case 'new':
        return this.allScored.filter(r => r.newMember).length;
      default:
        return this.allScored.length;
    }
  }

  toggleExpand(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
    this.cdr.detectChanges();
  }

  isExpanded(id: number): boolean {
    return this.expandedId === id;
  }

  get reliablePct(): number {
    return this.stats?.total
      ? Math.round((this.stats.reliableCount / this.stats.total) * 100)
      : 0;
  }

  get moderatePct(): number {
    return this.stats?.total
      ? Math.round((this.stats.moderateCount / this.stats.total) * 100)
      : 0;
  }

  get riskPct(): number {
    return this.stats?.total
      ? Math.round((this.stats.riskCount / this.stats.total) * 100)
      : 0;
  }

  isProcessed(id: number): boolean {
    return this.processedIds.has(id);
  }

  getProcessedStatus(id: number): string {
    const row = this.allScored.find(r => r.reservation.id === id);
    return row?.reservation?.status ?? '';
  }

  confirmReservation(row: ScoredRow): void {
    const id = row.reservation.id;

    this.http.put<any>(`${environment.apiUrl}/api/reservations/${id}/confirm`, {})
      .subscribe({
        next: (updated) => {
          const idx = this.allScored.findIndex(r => r.reservation.id === id);

          if (idx !== -1) {
            this.allScored[idx] = {
              ...this.allScored[idx],
              reservation: {
                ...this.allScored[idx].reservation,
                status: 'CONFIRMED',
                processedAt: updated.processedAt
              }
            };
          }

          this.processedIds.add(id);
          this.applyFilters();
          this.showSuccess('Réservation confirmée.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.showError(err?.error?.message || 'Impossible de confirmer.');
          this.cdr.detectChanges();
        }
      });
  }

  rejectReservation(row: ScoredRow): void {
    const id = row.reservation.id;

    this.http.put<any>(`${environment.apiUrl}/api/reservations/${id}/reject`, {})
      .subscribe({
        next: (updated) => {
          const idx = this.allScored.findIndex(r => r.reservation.id === id);

          if (idx !== -1) {
            this.allScored[idx] = {
              ...this.allScored[idx],
              reservation: {
                ...this.allScored[idx].reservation,
                status: 'REJECTED',
                processedAt: updated.processedAt
              }
            };
          }

          this.processedIds.add(id);
          this.applyFilters();
          this.showSuccess('Réservation rejetée.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.showError(err?.error?.message || 'Impossible de rejeter.');
          this.cdr.detectChanges();
        }
      });
  }

  deleteReservation(id: number): void {
    const backup = [...this.allScored];

    this.allScored = this.allScored.filter(r => r.reservation.id !== id);
    this.processedIds.delete(id);
    this.applyFilters();
    this.cdr.detectChanges();

    this.http.delete(`${environment.apiUrl}/api/reservations/${id}`)
      .subscribe({
        next: () => {
          this.showSuccess('Réservation supprimée.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.allScored = backup;
          this.applyFilters();
          this.showError(err?.error?.message || 'Impossible de supprimer.');
          this.cdr.detectChanges();
        }
      });
  }

  clearEventFilter(): void {
    this.eventId = null;
    this.eventTitle = '';
    this.router.navigate([], { queryParams: {} });
    this.loadScored();
  }

  scoreClass(score: number): string {
    if (score >= 75) return 'ok';
    if (score >= 50) return 'warn';
    return 'bad';
  }

  scoreLabel(score: number): string {
    if (score >= 75) return 'Fiable';
    if (score >= 50) return 'Modéré';
    return 'Risqué';
  }

  ecoColor(eco: number): string {
    if (eco >= 8) return 'var(--vc-ok)';
    if (eco >= 5) return 'var(--vc-warn)';
    return 'var(--vc-danger)';
  }

  cancelClass(rate: number): string {
    if (rate >= 50) return 'bad';
    if (rate >= 25) return 'warn';
    return 'ok';
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      PENDING: 'warn',
      CONFIRMED: 'ok',
      REJECTED: 'bad',
      CANCELLED: ''
    };

    return m[status] ?? '';
  }

  ringOffset(score: number): number {
    const circ = 2 * Math.PI * 18;
    return circ - (score / 100) * circ;
  }

  ringColor(score: number): string {
    if (score >= 75) return 'var(--vc-ok)';
    if (score >= 50) return 'var(--vc-warn)';
    return 'var(--vc-danger)';
  }

  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';

    setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges();
    }, 4000);
  }

  showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = '';

    setTimeout(() => {
      this.errorMessage = '';
      this.cdr.detectChanges();
    }, 6000);
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }
}