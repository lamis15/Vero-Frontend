import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventApiService, Reservation } from '../../services/Event api.service';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './my-reservations.component.html',
  styleUrls: ['./my-reservations.component.css']
})
export class MyReservationsComponent implements OnInit {

  reservations: Reservation[] = [];
  loading = true;
  successMsg = '';
  errorMsg   = '';

  // Cancel confirmation modal
  showConfirmModal   = false;
  cancelTargetId: number | null = null;
  cancelLoading      = false;
  cancelError        = '';   // shown inline inside the modal

  constructor(private api: EventApiService) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;
    this.api.getMyReservations().subscribe({
      next:  res  => { this.reservations = res; this.loading = false; },
      error: ()   => { this.showError('Impossible de charger vos réservations.'); this.loading = false; }
    });
  }

  // Filters
  get activeReservations(): Reservation[] {
    return this.reservations.filter(r => r.status === 'PENDING' || r.status === 'CONFIRMED');
  }
  get pastReservations(): Reservation[] {
    return this.reservations.filter(r => r.status === 'CANCELLED' || r.status === 'REJECTED');
  }

  canCancel(r: Reservation): boolean {
    return r.status === 'PENDING' || r.status === 'CONFIRMED';
  }

  openCancelModal(id: number): void {
    this.cancelTargetId   = id;
    this.cancelError      = '';
    this.showConfirmModal = true;
  }

  closeConfirm(): void {
    this.showConfirmModal = false;
    this.cancelTargetId  = null;
    this.cancelLoading   = false;
    this.cancelError     = '';
  }

  confirmCancel(): void {
    if (this.cancelTargetId === null || this.cancelLoading) return;
    this.cancelLoading = true;
    this.cancelError   = '';
    const id = this.cancelTargetId;

    this.api.cancelReservation(id).subscribe({
      next: () => {
        const r = this.reservations.find(x => x.id === id);
        if (r) r.status = 'CANCELLED';
        this.closeConfirm();
        this.showSuccess('Réservation annulée.');
      },
      error: err => {
        this.cancelLoading = false;
        console.error('Cancel reservation error:', err);
        // Show error inline in the modal (toast is hidden behind the backdrop)
        const status = err.status;
        if (status === 404) {
          this.cancelError = 'Réservation introuvable (404).';
        } else if (status === 403) {
          this.cancelError = 'Permission refusée (403). Vérifiez vos droits.';
        } else if (status === 405) {
          this.cancelError = 'Méthode non autorisée (405). Contactez l\'administrateur.';
        } else {
          this.cancelError = err.error?.message || `Erreur ${status || ''} lors de l\'annulation.`;
        }
      }
    });
  }

  statusLabel(status: Reservation['status']): string {
    const map: Record<string, string> = {
      PENDING:   '⏳ En attente',
      CONFIRMED: '✅ Confirmée',
      CANCELLED: '❌ Annulée',
      REJECTED:  '🚫 Refusée',
    };
    return map[status] ?? status;
  }

  statusClass(status: Reservation['status']): string {
    return 'rs-' + status.toLowerCase();
  }

  showSuccess(msg: string): void {
    this.successMsg = msg; this.errorMsg = '';
    setTimeout(() => this.successMsg = '', 3500);
  }
  showError(msg: string): void {
    this.errorMsg = msg; this.successMsg = '';
    setTimeout(() => this.errorMsg = '', 4500);
  }
}
