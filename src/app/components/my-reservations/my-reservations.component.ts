import { Component, OnInit } from '@angular/core';
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
export class MyReservationsComponent implements OnInit {

  reservations: Reservation[] = [];
  loading = true;
  successMsg = '';
  errorMsg = '';

  expandedId: number | null = null;

  histPage = 0;
  histPageSize = 3;

  showConfirmModal = false;
  cancelTargetId: number | null = null;
  cancelLoading = false;

  showMapModal = false;
  mapLocation = '';
  mapEmbedUrl: SafeResourceUrl | string = '';
  mapDistanceLabel = '';

  constructor(
    private api: EventApiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;

    this.api.getMyReservations().subscribe({
      next: res => {
        this.reservations = res || [];
        this.loading = false;
      },
      error: () => {
        this.showError('Unable to load your reservations.');
        this.loading = false;
      }
    });
    
  }

  private norm(v: any): string {
    return String(v ?? '').trim().toUpperCase();
  }

  getEventStatus(r: any): string {
    return this.norm(
      r?.event?.status ??
      r?.eventStatus ??
      r?.statusEvent ??
      r?.event?.eventStatus
    );
  }
  getEventCapacity(r: any): number {
  return Number(
    r?.event?.capacity ??
    r?.eventCapacity ??
    r?.capacity ??
    0
  );
}

getEventId(r: any): number {
  return Number(
    r?.event?.id ??
    r?.eventId ??
    r?.idEvent ??
    0
  );
}
 getEventTitle(r: any): string {
  return (
    r?.event?.title ??
    r?.event?.name ??
    r?.event?.nom ??
    r?.event?.eventName ??
    r?.event?.eventTitle ??
    r?.event?.titre ??
    r?.eventTitle ??
    r?.eventName ??
    r?.event_name ??
    r?.title ??
    r?.name ??
    r?.nom ??
    'Untitled Event'
  );
}

getEventLocation(r: any): string {
  return (
    r?.event?.location ??
    r?.eventLocation ??
    r?.location ??
    'Location not specified'
  );
}

getEventStartDate(r: any): any {
  return (
    r?.event?.startDate ??
    r?.event?.start_date ??
    r?.eventStartDate ??
    r?.startDate ??
    null
  );
}

  getReservationStatus(r: any): string {
    return this.norm(r?.status);
  }

  isEventCompleted(r: any): boolean {
    return this.getEventStatus(r) === 'COMPLETED';
  }

  canRateReservation(r: any): boolean {
    return this.getReservationStatus(r) === 'CONFIRMED' && this.isEventCompleted(r);
  }

  get activeReservations(): Reservation[] {
    return this.reservations.filter(r =>
      ['PENDING', 'CONFIRMED'].includes(this.getReservationStatus(r)) &&
      !this.isEventCompleted(r)
    );
  }

  get pastReservations(): Reservation[] {
    return this.reservations.filter(r =>
      ['CANCELLED', 'REJECTED'].includes(this.getReservationStatus(r)) ||
      this.canRateReservation(r)
    );
  }

  get histTotalPages(): number {
    return Math.ceil(this.pastReservations.length / this.histPageSize);
  }

  get pagedPastReservations(): Reservation[] {
    const start = this.histPage * this.histPageSize;
    return this.pastReservations.slice(start, start + this.histPageSize);
  }

  get histPagesArray(): number[] {
    return Array.from({ length: this.histTotalPages }, (_, i) => i);
  }

  nextPage(): void {
    if (this.histPage < this.histTotalPages - 1) {
      this.histPage++;
    }
  }

  prevPage(): void {
    if (this.histPage > 0) {
      this.histPage--;
    }
  }

  goToHistPage(page: number): void {
    this.histPage = page;
  }

  get totalCo2(): number {
    return this.reservations.reduce((s, r) => s + Number(r.event?.capacity || 0) * 3, 0);
  }

  get totalParticipants(): number {
    return this.reservations.reduce((s, r) => s + Number(r.event?.capacity || 0), 0);
  }

  get activeCount(): number {
    return this.activeReservations.length;
  }

  canCancel(r: Reservation): boolean {
    return ['PENDING', 'CONFIRMED'].includes(this.getReservationStatus(r)) && !this.isEventCompleted(r);
  }

  isExpanded(id: number): boolean {
    return this.expandedId === id;
  }

  toggleExpand(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  getQrCodeUrl(r: Reservation): string {
    if (!r || !r.id) return '';

    const currentHost = window.location.hostname;

    const apiHost =
      currentHost === 'localhost' || currentHost === '127.0.0.1'
        ? '172.20.10.4'
        : currentHost;

    const ticketUrl = `http://${apiHost}:8080/api/tickets/${r.id}/pdf`;

    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ticketUrl)}&color=06bde8&bgcolor=eafaff&margin=8`;
  }

  openMaps(location: string, e: MouseEvent): void {
    e.stopPropagation();

    this.mapLocation = location;
    this.mapDistanceLabel = 'Calculating route...';

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const url =
          `https://maps.google.com/maps?saddr=${lat},${lng}&daddr=${encodeURIComponent(location)}&output=embed`;

        this.mapEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.mapDistanceLabel = 'Route from your current position to the event';
        this.showMapModal = true;
      },
      () => {
        const url =
          `https://maps.google.com/maps?q=${encodeURIComponent(location)}&output=embed&z=15`;

        this.mapEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.mapDistanceLabel = 'Enable location to see route distance';
        this.showMapModal = true;
      }
    );
  }

  openDirectMaps(location: string, e: MouseEvent): void {
    e.stopPropagation();
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`,
      '_blank'
    );
  }

  openCancelModal(id: number, e: MouseEvent): void {
    e.stopPropagation();
    this.cancelTargetId = id;
    this.showConfirmModal = true;
  }

  closeConfirm(): void {
    if (this.cancelLoading) return;

    this.showConfirmModal = false;
    this.cancelTargetId = null;
  }

  confirmCancel(): void {
    if (!this.cancelTargetId || this.cancelLoading) return;

    const id = this.cancelTargetId;
    this.cancelLoading = true;

    this.api.cancelReservation(id).subscribe({
      next: () => {
        const r = this.reservations.find(x => x.id === id);

        if (r) {
          r.status = 'CANCELLED';
        }

        this.cancelLoading = false;
        this.showConfirmModal = false;
        this.cancelTargetId = null;
        this.showSuccess('✅ Reservation cancelled.');
      },
      error: () => {
        this.cancelLoading = false;
        this.showError('Error during cancellation. Please try again.');
      }
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pending',
      CONFIRMED: 'Confirmed',
      CANCELLED: 'Cancelled',
      REJECTED: 'Rejected',
      COMPLETED: 'Completed'
    };

    return labels[this.norm(status)] || status;
  }

  statusClass(status: string): string {
    return 'rs-' + this.norm(status).toLowerCase();
  }

  showSuccess(msg: string): void {
    this.successMsg = msg;
    this.errorMsg = '';
    setTimeout(() => this.successMsg = '', 5000);
  }

  showError(msg: string): void {
    this.errorMsg = msg;
    this.successMsg = '';
    setTimeout(() => this.errorMsg = '', 5000);
  }
}