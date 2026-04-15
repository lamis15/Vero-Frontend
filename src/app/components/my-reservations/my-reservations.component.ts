import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EventApiService, Reservation } from '../../services/Event api.service';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './my-reservations.component.html',
  styleUrls: ['./my-reservations.component.css']
})
export class MyReservationsComponent implements OnInit {

  reservations: Reservation[] = [];
  loading = true;
  successMsg = '';
  errorMsg   = '';

  // ── UI state ──────────────────────────────────────────────────────────────
  expandedId:   number | null = null;   // accordion-style card expand
  smsEnabled    = new Set<number>();
  ratings:      { [eventId: number]: number } = {};
  comments:     { [eventId: number]: string } = {};
  commentDraft: { [eventId: number]: string } = {};
  submittedRatings = new Set<number>();

  // ── Summary stats ─────────────────────────────────────────────────────────
  get totalCo2(): number {
    return this.reservations.reduce((s, r) => s + r.event.capacity * 3, 0);
  }
  get totalParticipants(): number {
    return this.reservations.reduce((s, r) => s + r.event.capacity, 0);
  }
  get activeCount(): number {
    return this.reservations.filter(r => r.status === 'PENDING' || r.status === 'CONFIRMED').length;
  }

  // ── Cancel modal ──────────────────────────────────────────────────────────
  showConfirmModal = false;
  cancelTargetId: number | null = null;
  cancelLoading = false;

  // ── Map modal ─────────────────────────────────────────────────────────────
  showMapModal  = false;
  mapLocation   = '';
  mapEmbedUrl   = '';

  constructor(private api: EventApiService) {}

  ngOnInit(): void { this.loadReservations(); }

  loadReservations(): void {
    this.loading = true;
    this.api.getMyReservations().subscribe({
      next: res => { this.reservations = res; this.loading = false; },
      error: () => { this.showError('Impossible de charger vos réservations.'); this.loading = false; }
    });
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  get activeReservations(): Reservation[] {
    return this.reservations.filter(r => r.status === 'PENDING' || r.status === 'CONFIRMED');
  }
  get pastReservations(): Reservation[] {
    return this.reservations.filter(r => r.status === 'CANCELLED' || r.status === 'REJECTED');
  }
  canCancel(r: Reservation): boolean { return r.status === 'PENDING' || r.status === 'CONFIRMED'; }

  isExpanded(id: number): boolean { return this.expandedId === id; }
  toggleExpand(id: number): void { this.expandedId = this.expandedId === id ? null : id; }

  // ── QR Code ───────────────────────────────────────────────────────────────
  getQrCodeUrl(r: Reservation): string {
    const link = `https://votre-site.com/api/tickets/${r.id}/pdf`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}&color=1e6b45&bgcolor=f2efe8&margin=8`;
  }

  // ── PDF Download (simulation) ─────────────────────────────────────────────
  downloadPdf(r: Reservation, e: MouseEvent): void {
    e.stopPropagation();
    this.showSuccess(`📄 Generating PDF ticket for "${r.event.title}"…`);
    // Real: window.open(`/api/tickets/${r.id}/pdf`, '_blank');
  }

  // ── SMS Toggle ────────────────────────────────────────────────────────────
  toggleSms(id: number, e: MouseEvent): void {
    e.stopPropagation();
    if (this.smsEnabled.has(id)) {
      this.smsEnabled.delete(id);
      this.showSuccess('🔕 SMS reminder disabled.');
    } else {
      this.smsEnabled.add(id);
      this.showSuccess('🔔 SMS reminder set! You\'ll receive a message 24h before the event.');
    }
  }
  isSmsEnabled(id: number): boolean { return this.smsEnabled.has(id); }

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

  // ── Rating & Comment ──────────────────────────────────────────────────────
  rateEvent(eventId: number, star: number): void {
    this.ratings[eventId] = star;
  }

  submitRating(eventId: number): void {
    const rating  = this.ratings[eventId];
    const comment = this.commentDraft[eventId] || '';
    if (!rating) { this.showError('Please select a rating.'); return; }
    this.comments[eventId] = comment;
    this.submittedRatings.add(eventId);
    this.showSuccess(`⭐ Thank you! Your ${rating}-star review has been submitted.`);
    // Real: this.api.rateEvent(eventId, rating, comment).subscribe(...)
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
        this.showSuccess('✅ Reservation cancelled. Your ticket has been invalidated.');
      },
      error: () => {
        this.cancelLoading = false;
        this.showError('Error during cancellation. Please try again.');
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  statusLabel(status: string): string {
    const m: any = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', REJECTED: 'Rejected', COMPLETED: 'Completed' };
    return m[status] || status;
  }
  statusClass(status: string): string { return 'rs-' + status.toLowerCase(); }

  showSuccess(msg: string): void { this.successMsg = msg; this.errorMsg = ''; setTimeout(() => this.successMsg = '', 5000); }
  showError(msg: string):   void { this.errorMsg = msg; this.successMsg = ''; setTimeout(() => this.errorMsg = '', 5000); }
}