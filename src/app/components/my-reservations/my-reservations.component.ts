import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { EventApiService, Reservation } from '../../services/Event api.service';
import { EventRatingComponent } from '../my-reservations/Event rating.component';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, EventRatingComponent],
  templateUrl: './my-reservations.component.html',
  styleUrls: ['./my-reservations.component.css']
})
export class MyReservationsComponent implements OnInit, OnDestroy {

  reservations: Reservation[] = [];
  loading = true;
  successMsg = '';
  errorMsg   = '';

  expandedId: number | null = null;

  histPage     = 0;
  histPageSize = 3;

  showConfirmModal  = false;
  cancelTargetId: number | null = null;
  cancelLoading     = false;

  showMapModal     = false;
  mapLocation      = '';
  mapEmbedUrl: SafeResourceUrl | string = '';
  mapDistanceLabel = '';

  private successTimer: any;
  private errorTimer:   any;

  constructor(
    private api:       EventApiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void { this.loadReservations(); }

  ngOnDestroy(): void {
    clearTimeout(this.successTimer);
    clearTimeout(this.errorTimer);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────────────────────

  loadReservations(): void {
    this.loading = true;
    const guard = setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.showError('Unable to load reservations. Please refresh.');
      }
    }, 8000);

    this.api.getMyReservations().subscribe({
      next: res => {
        clearTimeout(guard);
        this.reservations = res || [];
        this.loading = false;
      },
      error: () => {
        clearTimeout(guard);
        this.loading = false;
        this.showError('Unable to load your reservations.');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NORMALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  private norm(v: any): string { return String(v ?? '').trim().toUpperCase(); }

  getEventStatus(r: any): string {
    return this.norm(r?.event?.status ?? r?.eventStatus ?? r?.statusEvent ?? r?.event?.eventStatus);
  }
  getEventCapacity(r: any): number {
    return Number(r?.event?.capacity ?? r?.eventCapacity ?? r?.capacity ?? 0);
  }
  getEventId(r: any): number {
    return Number(r?.event?.id ?? r?.eventId ?? r?.idEvent ?? 0);
  }
  getEventTitle(r: any): string {
    return r?.event?.title ?? r?.event?.name ?? r?.event?.nom ??
      r?.event?.eventName ?? r?.event?.eventTitle ?? r?.event?.titre ??
      r?.eventTitle ?? r?.eventName ?? r?.event_name ??
      r?.title ?? r?.name ?? r?.nom ?? 'Untitled Event';
  }
  getEventLocation(r: any): string {
    return r?.event?.location ?? r?.eventLocation ?? r?.location ?? 'Location not specified';
  }
  getEventStartDate(r: any): any {
    return r?.event?.startDate ?? r?.event?.start_date ?? r?.eventStartDate ?? r?.startDate ?? null;
  }
  getReservationStatus(r: any): string { return this.norm(r?.status); }
  isEventCompleted(r: any): boolean    { return this.getEventStatus(r) === 'COMPLETED'; }
  canRateReservation(r: any): boolean  {
    return this.getReservationStatus(r) === 'CONFIRMED' && this.isEventCompleted(r);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTS
  // ─────────────────────────────────────────────────────────────────────────

  get activeReservations(): Reservation[] {
    return this.reservations.filter(r =>
      ['PENDING', 'CONFIRMED'].includes(this.getReservationStatus(r)) && !this.isEventCompleted(r)
    );
  }
  get pastReservations(): Reservation[] {
    return this.reservations.filter(r =>
      ['CANCELLED', 'REJECTED'].includes(this.getReservationStatus(r)) || this.canRateReservation(r)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGINATION
  // ─────────────────────────────────────────────────────────────────────────

  get histTotalPages(): number { return Math.ceil(this.pastReservations.length / this.histPageSize); }
  get pagedPastReservations(): Reservation[] {
    const start = this.histPage * this.histPageSize;
    return this.pastReservations.slice(start, start + this.histPageSize);
  }
  get histPagesArray(): number[] { return Array.from({ length: this.histTotalPages }, (_, i) => i); }
  nextPage(): void { if (this.histPage < this.histTotalPages - 1) this.histPage++; }
  prevPage(): void { if (this.histPage > 0) this.histPage--; }
  goToHistPage(page: number): void { this.histPage = page; }

  // ─────────────────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────────────────

  get totalCo2(): number         { return this.reservations.reduce((s, r) => s + Number(r.event?.capacity || 0) * 3, 0); }
  get totalParticipants(): number { return this.reservations.reduce((s, r) => s + Number(r.event?.capacity || 0), 0); }
  get activeCount(): number       { return this.activeReservations.length; }

  // ─────────────────────────────────────────────────────────────────────────
  // ACCORDION
  // ─────────────────────────────────────────────────────────────────────────

  canCancel(r: Reservation): boolean {
    return ['PENDING', 'CONFIRMED'].includes(this.getReservationStatus(r)) && !this.isEventCompleted(r);
  }
  isExpanded(id: number): boolean { return this.expandedId === id; }
  toggleExpand(id: number): void  { this.expandedId = this.expandedId === id ? null : id; }

  // ─────────────────────────────────────────────────────────────────────────
  // QR CODE
  // ─────────────────────────────────────────────────────────────────────────

  getQrCodeUrl(r: Reservation): string {
    if (!r?.id) return '';
    const h = window.location.hostname;
    const apiHost = (h === 'localhost' || h === '127.0.0.1') ? '172.20.10.4' : h;
    const ticketUrl = `http://${apiHost}:8080/api/tickets/${r.id}/pdf`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ticketUrl)}&color=06bde8&bgcolor=eafaff&margin=8`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAP
  // ─────────────────────────────────────────────────────────────────────────

  openMaps(location: string, e: MouseEvent): void {
    e.stopPropagation();
    this.mapLocation      = location;
    this.mapDistanceLabel = 'Calculating route...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const url = `https://maps.google.com/maps?saddr=${pos.coords.latitude},${pos.coords.longitude}&daddr=${encodeURIComponent(location)}&output=embed`;
        this.mapEmbedUrl      = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.mapDistanceLabel = 'Route from your current position to the event';
        this.showMapModal     = true;
      },
      () => {
        const url = `https://maps.google.com/maps?q=${encodeURIComponent(location)}&output=embed&z=15`;
        this.mapEmbedUrl      = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.mapDistanceLabel = 'Enable location to see route distance';
        this.showMapModal     = true;
      }
    );
  }

  openDirectMaps(location: string, e: MouseEvent): void {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`, '_blank');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CANCEL — setTimeout(0) force Angular à fermer le modal après le 200
  // ─────────────────────────────────────────────────────────────────────────

  openCancelModal(id: number, e: MouseEvent): void {
    e.stopPropagation();
    this.cancelTargetId   = id;
    this.cancelLoading    = false;
    this.showConfirmModal = true;
  }

  closeConfirm(): void {
  this.showConfirmModal = false;
  this.cancelTargetId = null;
  this.cancelLoading = false;
}

 confirmCancel(): void {
  if (!this.cancelTargetId) return;

  const id = this.cancelTargetId;

  // Fermer directement le modal
  this.showConfirmModal = false;
  this.cancelTargetId = null;
  this.cancelLoading = false;

  // Afficher cancelled directement
  this.reservations = this.reservations.map(r =>
    r.id === id ? { ...r, status: 'CANCELLED' } : r
  );

  this.showSuccess('✅ Reservation cancelled successfully.');

  // Appel backend après mise à jour UI
  this.api.cancelReservation(id).subscribe({
    next: () => {},
    error: err => {
      console.error('Cancel error:', err);
      this.showError('Cancelled locally. Refresh to verify server status.');
    }
  });
}
  // ─────────────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────────────

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pending', CONFIRMED: 'Confirmed',
      CANCELLED: 'Cancelled', REJECTED: 'Rejected', COMPLETED: 'Completed'
    };
    return labels[this.norm(status)] || status;
  }
  statusClass(status: string): string { return 'rs-' + this.norm(status).toLowerCase(); }

  // ─────────────────────────────────────────────────────────────────────────
  // TOASTS
  // ─────────────────────────────────────────────────────────────────────────

  showSuccess(msg: string): void {
    clearTimeout(this.successTimer);
    this.successMsg = msg; this.errorMsg = '';
    this.successTimer = setTimeout(() => this.successMsg = '', 5000);
  }

  showError(msg: string): void {
    clearTimeout(this.errorTimer);
    this.errorMsg = msg; this.successMsg = '';
    this.errorTimer = setTimeout(() => this.errorMsg = '', 5000);
  }
}