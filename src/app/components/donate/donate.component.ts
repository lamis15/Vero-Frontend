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

  // ── Hero animated text ────────────────────────────────────────────────────
  heroTexts = [
    'Save Our Environment.',
    'Take Action.',
    'Make a Difference.'
  ];
  heroTextIndex = 0;
  heroTextExit = -1;
  private heroInterval: any;

  events: Event[] = [];
  selectedEventIndex = -1;
  eventsLoading = true;

  selectedAmount: number | null = 20;
  customAmount: number | null = null;
  donateState: 'idle' | 'processing' | 'confirmed' | 'error' = 'idle';
  fullName = '';
  email = '';
  message = '';
  isAnonymous = false;
  errorMessage = '';
  successMessage = '';

  donationType: 'MONEY' | 'MATERIAL' | 'TIME' = 'MONEY';
  materialQuantity = '';
  volunteerHours: number | null = null;

  donations: Donation[] = [];
  donationsLoading = false;
  totalDonated = 0;

  editingDonation: Donation | null = null;
  editAmount = 0;
  editMessage = '';
  editAnonymous = false;
  editType: 'MONEY' | 'MATERIAL' | 'TIME' = 'MONEY';
  editQuantity = '';
  editState: 'idle' | 'processing' | 'confirmed' = 'idle';

  currentRole: string | null = null;
  currentUserEmail: string | null = null;
  private roleSub!: Subscription;

  deletingId: number | null = null;
  validatingId: number | null = null;

  activeTab: 'browse' | 'donate' | 'history' = 'browse';

  // UX Refactor States
  currentStep = 1;
  showConfirmModal = false;
  showSuccessModal = false;
  pendingDonation: Donation | null = null;

  donationSteps = [
    { title: 'You donate', desc: 'Choose an event, select an amount or volunteer your time.' },
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
    this.startHeroAnimation();
    this.loadEvents();

    // Also re-fetch if login state changes (e.g. user logs in/out)
   
  }

  ngOnDestroy(): void {
    clearInterval(this.heroInterval);
    this.roleSub?.unsubscribe();
  }

  scrollToForm(): void {
    document.querySelector('.donate-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

  loadEvents(): void {
  this.eventsLoading = true;
  this.eventService.getAll().subscribe({
    next: (data) => {
      this.events = data;
      this.eventsLoading = false;
      this.cdr.markForCheck(); // ← AJOUTE cette ligne
    },
    error: () => {
      this.eventsLoading = false;
      this.cdr.markForCheck(); // ← AJOUTE cette ligne
    }
  });
}

  selectEvent(index: number): void {
    this.selectedEventIndex = index;
    this.currentStep = 2; // Move to Step 2 when event is selected
    this.goToDonate();
    this.loadDonationsForEvent();
  }

  goToDonate(): void {
    if (this.selectedEventIndex === -1) return;
    this.activeTab = 'donate';
    setTimeout(() => {
      document.querySelector('.donate-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  goToBrowse(): void {
    this.activeTab = 'browse';
    setTimeout(() => {
      document.querySelector('.donate-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

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

  selectAmount(amount: number): void {
    this.selectedAmount = amount;
    this.customAmount = null;
  }

  getFinalAmount(): number {
    return this.customAmount || this.selectedAmount || 0;
  }

  handleDonate(): void {
    if (this.donateState !== 'idle') return;

    const ev = this.selectedEvent;
    if (!ev?.id) {
      this.errorMessage = 'Please select an event';
      this.autoClearError();
      return;
    }

    const amount = this.getFinalAmount();

    if (this.donationType === 'MONEY' && amount <= 0) {
      this.errorMessage = 'Please select an amount';
      this.autoClearError();
      return;
    }
    if (this.donationType === 'MATERIAL' && !this.materialQuantity.trim()) {
      this.errorMessage = 'Please describe what you are donating';
      this.autoClearError();
      return;
    }
    if (this.donationType === 'TIME' && (!this.volunteerHours || this.volunteerHours <= 0)) {
      this.errorMessage = 'Please select volunteer hours';
      this.autoClearError();
      return;
    }
     if (!this.isAnonymous) {
    if (!this.fullName.trim()) {
      this.errorMessage = 'Please enter your name';
      this.autoClearError();
      return;
    }
    if (!this.email.trim() || !this.isValidEmail(this.email)) {
      this.errorMessage = 'Please enter a valid email';
      this.autoClearError();
      return;
    }
  }

    this.errorMessage = '';
    this.errorMessage = '';

    // Create pending donation object and show confirmation modal
    this.pendingDonation = {
      amount: amount,
      type: this.donationType,
      message: this.isAnonymous
        ? `Anonymous donation`
        : `Don de ${this.fullName}`,
      anonymous: this.isAnonymous,
      transactionId: `TXN-${Date.now()}`
    };
    
    this.showConfirmModal = true;
  }

  cancelDonation(): void {
    this.showConfirmModal = false;
    this.pendingDonation = null;
  }

  confirmDonation(): void {
    const ev = this.selectedEvent;
    if (!ev?.id || !this.pendingDonation) return;

    this.showConfirmModal = false;
    this.donateState = 'processing';

    // ── Pour les dons MONEY → passer par Stripe ──────────────────────────
    if (this.pendingDonation.type === 'MONEY') {
      this.donationService.createDonationForEvent(
        this.pendingDonation, ev.id
      ).subscribe({
        next: (donation) => {
          // Ouvrir Stripe Checkout
          if (!donation.id) return;
          this.donationService.createStripeCheckout(
            this.pendingDonation!.amount,
            donation.id
          ).subscribe({
            next: (res) => {
              // ✅ Redirection vers Stripe
              window.location.href = res.url;
            },
            error: () => {
              this.donateState = 'error';
              this.errorMessage = 'Payment initialization failed.';
            }
          });
        },
        error: () => {
          this.donateState = 'error';
          this.errorMessage = 'Donation failed.';
        }
      });
      return;
    }

    // ── Pour MATERIAL et TIME → pas de paiement ──────────────────────────
    this.donationService.createDonationForEvent(
      this.pendingDonation, ev.id
    ).subscribe({
      next: () => {
        this.donateState = 'confirmed';
        this.showSuccessModal = true;
        this.resetForm();
        this.loadDonationsForEvent();
      },
      error: () => {
        this.donateState = 'error';
        this.errorMessage = 'Donation failed.';
      }
    });
  }

  viewMyDonations(): void {
    this.showSuccessModal = false;
    this.currentStep = 1;
    this.activeTab = 'history';
  }

  openEdit(donation: Donation): void {
    this.editingDonation = { ...donation };
    this.editAmount = donation.amount;
    this.editMessage = donation.message || '';
    this.editAnonymous = donation.anonymous;
    this.editType = (donation.type as any) || 'MONEY';
    this.editQuantity = donation.quantity || '';
    this.editState = 'idle';
    this.errorMessage = '';
  }

  cancelEdit(): void {
    this.editingDonation = null;
    this.errorMessage = '';
  }

  submitEdit(): void {
    if (this.editState !== 'idle' || !this.editingDonation?.id) return;

    if (this.editType === 'MONEY' && this.editAmount <= 0) {
      this.errorMessage = 'Amount must be greater than 0';
      this.autoClearError();
      return;
    }

    this.errorMessage = '';
    this.editState = 'processing';

    this.donationService.update(this.editingDonation.id, {
      amount: this.editAmount,
      message: this.editMessage,
      anonymous: this.editAnonymous,
      type: this.editType,
      quantity: this.editType === 'MATERIAL' ? this.editQuantity : undefined
    }).subscribe({
      next: () => {
        this.editState = 'confirmed';
        this.successMessage = 'Donation updated!';
        setTimeout(() => {
          this.editState = 'idle';
          this.successMessage = '';
          this.editingDonation = null;
          this.loadDonationsForEvent();
        }, 1500);
      },
      error: (err: any) => {
        this.editState = 'idle';
        this.errorMessage = err.error?.message || 'Update failed.';
      }
    });
  }

  deleteDonation(donation: Donation): void {
    if (!donation.id || this.deletingId === donation.id) return;
    if (!confirm('Delete this donation?')) return;

    this.deletingId = donation.id;
    this.donations = this.donations.filter(d => d.id !== donation.id);

    this.donationService.delete(donation.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.successMessage = 'Donation deleted!';
        setTimeout(() => this.successMessage = '', 3000);
        this.loadDonationsForEvent();
      },
      error: () => {
        this.deletingId = null;
        this.loadDonationsForEvent();
      }
    });
  }

  validateDonation(donation: Donation): void {
    if (!donation.id || this.validatingId === donation.id) return;

    this.validatingId = donation.id;
    this.donationService.validate(donation.id).subscribe({
      next: () => {
        this.validatingId = null;
        this.successMessage = 'Donation validated!';
        setTimeout(() => this.successMessage = '', 3000);
        this.loadDonationsForEvent();
      },
      error: (err: any) => {
        this.validatingId = null;
        this.errorMessage = err.error?.message || 'Validation failed.';
      }
    });
  }

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
    this.donationType = 'MONEY';
    this.materialQuantity = '';
    this.volunteerHours = null;
  }

  getTimeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getDonorInitials(donation: Donation): string {
    if (donation.anonymous) return '?';
    const name = donation.userName || 'U';
    return name.charAt(0).toUpperCase();
  }

  getDonorName(donation: Donation): string {
    if (donation.anonymous) return 'Anonymous';
    return donation.userName || 'User';
  }

  getDonationTypeIcon(type: string): string {
    switch (type) {
      case 'MONEY': return '💶';
      case 'MATERIAL': return '📦';
      case 'TIME': return '⏰';
      default: return '💚';
    }
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
  startHeroAnimation(): void {
  this.heroInterval = setInterval(() => {
    this.heroTextExit = this.heroTextIndex;
    setTimeout(() => {
      this.heroTextExit = -1;
      this.heroTextIndex =
        (this.heroTextIndex + 1) % this.heroTexts.length;
    }, 600);
  }, 4500);
}


  historyFilter: 'all' | 'MONEY' | 'MATERIAL' | 'TIME' = 'all';
 
  // Expose Math for template use
  Math = Math;
 
  // ─── ADD THESE HELPER METHODS ──────────────────────────────────────
 
  getMoneyCount(): number {
    return this.donations.filter(d => d.type === 'MONEY').length;
  }
 
  getMaterialCount(): number {
    return this.donations.filter(d => d.type === 'MATERIAL').length;
  }
 
  getTimeCount(): number {
    return this.donations.filter(d => d.type === 'TIME').length;
  }
 
  getValidatedCount(): number {
    return this.donations.filter(d => d.status === 'VALIDATED').length;
  }
}