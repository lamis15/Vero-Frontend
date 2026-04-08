import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DonationService, Donation } from '../../services/donation.service';
import { EventApiService, Event } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-donate',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './donate.component.html',
  styleUrl: './donate.component.css'
})
export class DonateComponent implements OnInit, OnDestroy {

  // ── Events list ────────────────────────────────────────────────────────────
  events: Event[] = [];
  selectedEventIndex = -1;
  eventsLoading = true;

  // ── Donation form ──────────────────────────────────────────────────────────
  selectedAmount: number | null = 20;
  customAmount: number | null = null;
  donateState: 'idle' | 'processing' | 'confirmed' | 'error' = 'idle';
  fullName = '';
  email = '';
  message = '';
  isAnonymous = false;
  errorMessage = '';
  successMessage = '';

  // ── Donations list for selected event ──────────────────────────────────────
  donations: Donation[] = [];
  donationsLoading = false;
  totalDonated = 0;

  // ── Edit state ─────────────────────────────────────────────────────────────
  editingDonation: Donation | null = null;
  editAmount = 0;
  editMessage = '';
  editAnonymous = false;
  editState: 'idle' | 'processing' | 'confirmed' = 'idle';

  // ── Role / Auth ────────────────────────────────────────────────────────────
  currentRole: string | null = null;
  currentUserEmail: string | null = null;
  private roleSub!: Subscription;

  // ── Delete / Validate tracking ─────────────────────────────────────────────
  deletingId: number | null = null;
  validatingId: number | null = null;

  // ── Active view ────────────────────────────────────────────────────────────
  activeTab: 'donate' | 'history' = 'donate';

  // ── Steps (kept from original) ─────────────────────────────────────────────
  donationSteps = [
    { title: 'You donate', desc: 'Choose an event, select an amount, and pay securely.' },
    { title: 'We record it', desc: 'Your transaction is permanently recorded and traceable.' },
    { title: 'Funds reach the event', desc: 'Funds are released directly to verified event organizers.' },
    { title: 'Track your impact', desc: 'Watch real-time updates as your donation creates change.' }
  ];

  constructor(
    private donationService: DonationService,
    private eventService: EventApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUserEmail = this.authService.currentUserEmail;
    this.roleSub = this.authService.roleStream$.subscribe(role => {
      this.currentRole = role;
      this.cdr.markForCheck();
    });
    this.loadEvents();
  }

  ngOnDestroy(): void {
    this.roleSub?.unsubscribe();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  get isAdmin(): boolean { return this.currentRole === 'ADMIN'; }
  get isLoggedIn(): boolean { return this.authService.isLoggedIn; }

  get selectedEvent(): Event | null {
    return this.selectedEventIndex >= 0 ? this.events[this.selectedEventIndex] : null;
  }

  isOwner(donation: Donation): boolean {
    return donation.userName === this.currentUserEmail;
  }
  canEdit(donation: Donation): boolean {
    return this.isOwner(donation) || this.isAdmin;
  }
  canDelete(donation: Donation): boolean {
    return this.isOwner(donation) || this.isAdmin;
  }
  canValidate(): boolean {
    return this.isAdmin;
  }

  // ── Load events ────────────────────────────────────────────────────────────
  loadEvents(): void {
    this.eventsLoading = true;
    this.eventService.getAll().subscribe({
      next: (data) => {
        this.events = data;
        this.eventsLoading = false;
        if (data.length > 0) {
          this.selectEvent(0);
        }
      },
      error: () => { this.eventsLoading = false; }
    });
  }

  selectEvent(index: number): void {
    this.selectedEventIndex = index;
    this.loadDonationsForEvent();
  }

  // ── Load donations for selected event ──────────────────────────────────────
  loadDonationsForEvent(): void {
    const ev = this.selectedEvent;
    if (!ev?.id) return;

    this.donationsLoading = true;
    this.donationService.getDonationsByEvent(ev.id).subscribe({
      next: (data) => {
        this.donations = data;
        this.donationsLoading = false;
      },
      error: () => { this.donations = []; this.donationsLoading = false; }
    });

    this.donationService.getTotalByEvent(ev.id).subscribe({
      next: (total) => this.totalDonated = total,
      error: () => this.totalDonated = 0
    });
  }

  // ── Amount selection ───────────────────────────────────────────────────────
  selectAmount(amount: number): void {
    this.selectedAmount = amount;
    this.customAmount = null;
  }

  getFinalAmount(): number {
    return this.customAmount || this.selectedAmount || 0;
  }

  // ── Create donation ────────────────────────────────────────────────────────
  handleDonate(): void {
    if (this.donateState !== 'idle') return;

    const ev = this.selectedEvent;
    if (!ev?.id) {
      this.errorMessage = 'Veuillez sélectionner un événement';
      this.autoClearError();
      return;
    }

    const amount = this.getFinalAmount();
    if (amount <= 0) {
      this.errorMessage = 'Veuillez sélectionner un montant';
      this.autoClearError();
      return;
    }
    if (!this.fullName.trim()) {
      this.errorMessage = 'Veuillez entrer votre nom';
      this.autoClearError();
      return;
    }
    if (!this.email.trim() || !this.isValidEmail(this.email)) {
      this.errorMessage = 'Veuillez entrer un email valide';
      this.autoClearError();
      return;
    }

    this.errorMessage = '';
    this.donateState = 'processing';

    const donation: Donation = {
      amount,
      type: 'MONEY',
      message: this.message || `Don de ${this.fullName} — ${ev.title}`,
      anonymous: this.isAnonymous,
      transactionId: `TXN-${Date.now()}`
    };

    this.donationService.createDonationForEvent(donation, ev.id).subscribe({
      next: () => {
        this.donateState = 'confirmed';
        this.successMessage = 'Donation effectuée avec succès !';
        this.loadDonationsForEvent();
        setTimeout(() => {
          this.donateState = 'idle';
          this.successMessage = '';
          this.resetForm();
        }, 3000);
      },
      error: (err: any) => {
        this.donateState = 'error';
        this.errorMessage = err.error?.message || 'Échec de la donation. Réessayez.';
        setTimeout(() => { this.donateState = 'idle'; }, 3000);
      }
    });
  }

  // ── Edit donation ──────────────────────────────────────────────────────────
  openEdit(donation: Donation): void {
    this.editingDonation = { ...donation };
    this.editAmount = donation.amount;
    this.editMessage = donation.message || '';
    this.editAnonymous = donation.anonymous;
    this.editState = 'idle';
    this.errorMessage = '';
  }

  cancelEdit(): void {
    this.editingDonation = null;
    this.errorMessage = '';
  }

  submitEdit(): void {
    if (this.editState !== 'idle' || !this.editingDonation?.id) return;

    if (this.editAmount <= 0) {
      this.errorMessage = 'Le montant doit être supérieur à 0';
      this.autoClearError();
      return;
    }

    this.errorMessage = '';
    this.editState = 'processing';

    this.donationService.update(this.editingDonation.id, {
      amount: this.editAmount,
      message: this.editMessage,
      anonymous: this.editAnonymous,
      type: 'MONEY'
    }).subscribe({
      next: () => {
        this.editState = 'confirmed';
        this.successMessage = 'Donation mise à jour !';
        setTimeout(() => {
          this.editState = 'idle';
          this.successMessage = '';
          this.editingDonation = null;
          this.loadDonationsForEvent();
        }, 1500);
      },
      error: (err: any) => {
        this.editState = 'idle';
        this.errorMessage = err.error?.message || 'Échec de la mise à jour.';
      }
    });
  }

  // ── Delete donation ────────────────────────────────────────────────────────
  deleteDonation(donation: Donation): void {
    if (!donation.id || this.deletingId === donation.id) return;
    if (!confirm('Supprimer cette donation ?')) return;

    this.deletingId = donation.id;
    this.donations = this.donations.filter(d => d.id !== donation.id);

    this.donationService.delete(donation.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.successMessage = 'Donation supprimée !';
        setTimeout(() => this.successMessage = '', 3000);
        this.loadDonationsForEvent();
      },
      error: () => {
        this.deletingId = null;
        this.loadDonationsForEvent();
      }
    });
  }

  // ── Validate donation (admin) ──────────────────────────────────────────────
  validateDonation(donation: Donation): void {
    if (!donation.id || this.validatingId === donation.id) return;

    this.validatingId = donation.id;
    this.donationService.validate(donation.id).subscribe({
      next: () => {
        this.validatingId = null;
        this.successMessage = 'Donation validée !';
        setTimeout(() => this.successMessage = '', 3000);
        this.loadDonationsForEvent();
      },
      error: (err: any) => {
        this.validatingId = null;
        this.errorMessage = err.error?.message || 'Échec de la validation.';
      }
    });
  }

  // ── Util ───────────────────────────────────────────────────────────────────
  autoClearError(): void {
    setTimeout(() => this.errorMessage = '', 4000);
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  resetForm(): void {
    this.selectedAmount = 20;
    this.customAmount = null;
    this.fullName = '';
    this.email = '';
    this.message = '';
    this.isAnonymous = false;
  }

  getTimeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `Il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }

  getDonorInitials(donation: Donation): string {
    if (donation.anonymous) return '?';
    const name = donation.userName || 'U';
    return name.charAt(0).toUpperCase();
  }

  getDonorName(donation: Donation): string {
    if (donation.anonymous) return 'Anonyme';
    return donation.userName || 'Utilisateur';
  }

  getEventStatusClass(status?: string): string {
    switch (status) {
      case 'UPCOMING': return 'status-upcoming';
      case 'ONGOING': return 'status-ongoing';
      case 'COMPLETED': return 'status-completed';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }
}