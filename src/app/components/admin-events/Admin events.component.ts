import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { EventApiService, Event } from '../../services/Event api.service';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './Admin events.component.html',
  styleUrls: ['./Admin events.component.css'],
})
export class AdminEventsComponent implements OnInit, OnDestroy {

  events: Event[] = [];
  filteredEvents: Event[] = [];
  loading = true;

  searchQuery = '';
  selectedStatus = '';

  successMessage = '';
  errorMessage = '';

  eventsMenuOpen = true;

  private destroy$ = new Subject<void>();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    public router: Router,
    private eventApi: EventApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEvents();
    this.refreshInterval = setInterval(() => this.silentRefresh(), 30_000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

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

  loadEvents(): void {
    this.loading = true;

    this.eventApi.getAll()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          this.events = data ?? [];
          this.applyFilters();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Events load error:', err);
          this.events = [];
          this.filteredEvents = [];
          this.showError(err?.error?.message || 'Failed to load events.');
          this.cdr.detectChanges();
        }
      });
  }

  private silentRefresh(): void {
    this.eventApi.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.events = data ?? [];
          this.applyFilters();
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  private applyFilters(): void {
    let list = [...this.events];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();

      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
      );
    }

    if (this.selectedStatus) {
      list = list.filter(e => e.status === this.selectedStatus);
    }

    this.filteredEvents = list;
  }

  get totalEvents(): number {
    return this.events.length;
  }

  get upcomingCount(): number {
    return this.events.filter(e => e.status === 'UPCOMING').length;
  }

  get ongoingCount(): number {
    return this.events.filter(e => e.status === 'ONGOING').length;
  }

  get completedCount(): number {
    return this.events.filter(e => e.status === 'COMPLETED').length;
  }

  editEvent(event: Event): void {
    this.router.navigate(['/admin/events/edit', event.id]);
  }

  cancelEvent(event: Event): void {
    if (!event.id) return;

    this.eventApi.cancel(event.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.events.findIndex(e => e.id === updated.id);

          if (idx !== -1) {
            this.events[idx] = updated;
            this.applyFilters();
          }

          this.showSuccess('Event cancelled.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.showError(err?.error?.message || 'Failed to cancel event.');
          this.cdr.detectChanges();
        }
      });
  }

  deleteEvent(id: number | undefined): void {
    if (!id) return;

    const backup = [...this.events];

    this.events = this.events.filter(e => e.id !== id);
    this.applyFilters();
    this.cdr.detectChanges();

    this.eventApi.delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Event deleted.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.events = backup;
          this.applyFilters();
          this.showError(err?.error?.message || 'Failed to delete event.');
          this.cdr.detectChanges();
        }
      });
  }

  statusClass(status?: string): string {
    const map: Record<string, string> = {
      UPCOMING: 'ok',
      ONGOING: 'warn',
      COMPLETED: '',
      CANCELLED: 'bad'
    };

    return map[status ?? ''] ?? '';
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