import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { EventApiService, Event } from '../../services/Event api.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
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

  pageSize = 5;
  currentPage = 0;

  readonly statuses = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];

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

  goTo(path: string): void {
    this.router.navigateByUrl(path);
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
          this.applyFilters(false);
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  onSearchChange(): void {
    this.applyFilters(true);
  }

  onStatusFilterChange(): void {
    this.applyFilters(true);
  }

  private applyFilters(resetPage = false): void {
    let list = [...this.events];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();

      list = list.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        this.creatorName(e).toLowerCase().includes(q)
      );
    }

    if (this.selectedStatus) {
      list = list.filter(e => e.status === this.selectedStatus);
    }

    this.filteredEvents = list;

    if (resetPage) {
      this.currentPage = 0;
    }

    if (this.currentPage > this.totalPages - 1) {
      this.currentPage = Math.max(this.totalPages - 1, 0);
    }
  }

  get pagedEvents(): Event[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredEvents.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(Math.ceil(this.filteredEvents.length / this.pageSize), 1);
  }

  get canGoPrev(): boolean {
    return this.currentPage > 0;
  }

  get canGoNext(): boolean {
    return this.currentPage < this.totalPages - 1;
  }

  prevPage(): void {
    if (!this.canGoPrev) return;
    this.currentPage--;
    this.cdr.detectChanges();
  }

  nextPage(): void {
    if (!this.canGoNext) return;
    this.currentPage++;
    this.cdr.detectChanges();
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

  updateStatus(event: Event, newStatus: string, domEvent?: Event | any): void {
    domEvent?.stopPropagation?.();

    if (!event.id || !newStatus || event.status === newStatus) return;

    const previousStatus = event.status;
    const previousEvents = [...this.events];

    event.status = newStatus as any;
    this.applyFilters(false);
    this.cdr.detectChanges();

    const payload = {
      ...event,
      status: newStatus
    } as any;

    this.eventApi.update(event.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.events.findIndex(e => e.id === event.id);

          if (idx !== -1) {
            this.events[idx] = updated;
          }

          this.applyFilters(false);
          this.showSuccess('Event status updated.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.events = previousEvents;

          const current = this.events.find(e => e.id === event.id);
          if (current) {
            current.status = previousStatus;
          }

          this.applyFilters(false);

          const msg =
            err?.error?.message ||
            (typeof err?.error === 'string' ? err.error : '') ||
            'Failed to update event status.';

          this.showError(msg);
          this.cdr.detectChanges();
        }
      });
  }

  cancelEvent(event: Event, domEvent?: MouseEvent): void {
    domEvent?.stopPropagation();

    if (!event.id) return;

    this.updateStatus(event, 'CANCELLED', domEvent);
  }

  deleteEvent(id: number | undefined, domEvent?: MouseEvent): void {
    domEvent?.stopPropagation();

    if (!id) return;

    const confirmed = window.confirm('Delete this event permanently?');
    if (!confirmed) return;

    const backup = [...this.events];

    this.events = this.events.filter(e => e.id !== id);
    this.applyFilters(false);
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
          this.applyFilters(false);

          const msg =
            err?.error?.message ||
            (typeof err?.error === 'string' ? err.error : '') ||
            'Failed to delete event. This event may already have reservations.';

          this.showError(msg);
          this.cdr.detectChanges();
        }
      });
  }

  statusClass(status?: string): string {
    const map: Record<string, string> = {
      UPCOMING: 'ok',
      ONGOING: 'warn',
      COMPLETED: 'done',
      CANCELLED: 'bad'
    };

    return map[status ?? ''] ?? '';
  }

  creatorName(event: Event): string {
    const e = event as any;

    return (
      e.createdBy?.fullName ||
      e.creator?.fullName ||
      e.user?.fullName ||
      e.organizer?.fullName ||
      e.organizerName ||
      e.createdByName ||
      'Admin'
    );
  }

  getEventImage(event: Event, index = 0): string {
    const e = event as any;

    const imageUrl =
      e.imageUrl ||
      e.image ||
      e.photoUrl ||
      e.pictureUrl ||
      e.coverImageUrl;

    if (imageUrl) {
      return imageUrl.startsWith('http') ? imageUrl : `${environment.apiUrl}${imageUrl}`;
    }

    return `assets/images/events/${(index % 13) + 1}.png`;
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
}
