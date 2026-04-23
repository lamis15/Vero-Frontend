import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  loading    = true;
  successMsg = '';
  errorMsg   = '';

  expandedId: number | null = null;

  // ── History pagination ────────────────────────────────────────────────────
  histPage     = 0;
  histPageSize = 3;

  get histTotalPages(): number {
    return Math.ceil(this.pastReservations.length / this.histPageSize);
  }

  get pagedPastReservations() {
    const start = this.histPage * this.histPageSize;
    return this.pastReservations.slice(start, start + this.histPageSize);
  }

  get histPagesArray(): number[] {
    return Array.from({ length: this.histTotalPages }, (_, i) => i);
  }

  nextPage(): void {
    if (this.histPage < this.histTotalPages - 1) this.histPage++;
  }

  prevPage(): void {
    if (this.histPage > 0) this.histPage--;
  }

  goToHistPage(page: number): void {
    this.histPage = page;
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  get totalCo2():          number { return this.reservations.reduce((s, r) => s + r.event.capacity * 3, 0); }
  get totalParticipants(): number { return this.reservations.reduce((s, r) => s + r.event.capacity, 0); }
  get activeCount():       number { return this.reservations.filter(r => r.status === 'PENDING' || r.status === 'CONFIRMED').length; }

  // ── Cancel modal ──────────────────────────────────────────────────────────
  showConfirmModal  = false;
  cancelTargetId: number | null = null;
  cancelLoading     = false;

  // ── Map modal ─────────────────────────────────────────────────────────────
  showMapModal = false;
  mapLocation  = '';
  mapEmbedUrl  = '';

  constructor(private api: EventApiService) {}

  ngOnInit(): void { this.loadReservations(); }

  loadReservations(): void {
    this.loading = true;
    this.api.getMyReservations().subscribe({
      next:  res => { this.reservations = res; this.loading = false; },
      error: ()  => { this.showError('Unable to load your reservations.'); this.loading = false; }
    });
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  get activeReservations(): Reservation[] {
    return this.reservations.filter(r =>
      (r.status === 'PENDING' || r.status === 'CONFIRMED') &&
      r.event.status !== 'COMPLETED'
    );
  }

  get pastReservations(): Reservation[] {
    return this.reservations.filter(r =>
      r.status === 'CANCELLED' ||
      r.status === 'REJECTED'  ||
      (r.status === 'CONFIRMED' && r.event.status === 'COMPLETED')
    );
  }

  canCancel(r: Reservation): boolean { return r.status === 'PENDING' || r.status === 'CONFIRMED'; }
  isExpanded(id: number): boolean    { return this.expandedId === id; }
  toggleExpand(id: number): void     { this.expandedId = this.expandedId === id ? null : id; }

  // ── QR Code ───────────────────────────────────────────────────────────────
  getQrCodeUrl(r: Reservation): string {
    const link = `http://192.168.1.140:8080/api/tickets/${r.id}/pdf`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}&color=1e6b45&bgcolor=f2efe8&margin=8`;
  }

  // ── Google Maps ───────────────────────────────────────────────────────────
  openMaps(location: string, e: MouseEvent): void {
    e.stopPropagation();
    this.mapLocation = location;
    this.mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(location)}&output=embed&z=15`;
    this.showMapModal = true;
  }
  openDirectMaps(location: string, e: MouseEvent): void {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`, '_blank');
  }

  // ── Cancel modal ──────────────────────────────────────────────────────────
  openCancelModal(id: number, e: MouseEvent): void {
    e.stopPropagation();
    this.cancelTargetId = id;
    this.showConfirmModal = true;
  }
  closeConfirm(): void { this.showConfirmModal = false; this.cancelTargetId = null; }

  confirmCancel(): void {
    if (!this.cancelTargetId) return;
    this.cancelLoading = true;
    this.api.cancelReservation(this.cancelTargetId).subscribe({
      next: () => {
        const r = this.reservations.find(x => x.id === this.cancelTargetId);
        if (r) r.status = 'CANCELLED';
        this.closeConfirm();
        this.cancelLoading = false;
        this.showSuccess('✅ Reservation cancelled.');
      },
      error: () => {
        this.cancelLoading = false;
        this.showError('Error during cancellation. Please try again.');
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  statusLabel(status: string): string {
    const m: any = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', REJECTED: 'Rejected', COMPLETED: 'Completed' };
    return m[status] || status;
  }
  statusClass(status: string): string { return 'rs-' + status.toLowerCase(); }

  showSuccess(msg: string): void { this.successMsg = msg; this.errorMsg   = ''; setTimeout(() => this.successMsg = '', 5000); }
  showError(msg: string):   void { this.errorMsg   = msg; this.successMsg = ''; setTimeout(() => this.errorMsg   = '', 5000); }
}