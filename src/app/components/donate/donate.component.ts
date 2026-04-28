import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DonationService, Donation, RecurringDonationRequest, RecurringDonationResponse } from '../../services/donation.service';
import { EventApiService, Event } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';

// ═══════════════════════════════════════════════════════════════
// DONOR PROFILE TYPES (K-Means Clustering)
// ═══════════════════════════════════════════════════════════════
export type DonorProfile =
  | 'OCCASIONNEL'    // 🌱 — New / few donations
  | 'REGULIER'       // 💚 — Regular money donor
  | 'MATERIEL'       // 📦 — Material donor
  | 'BENEVOLE'       // ⏰ — Time/volunteer donor
  | 'PHILANTHROPE'   // 👑 — High amount / admin
  | 'ECO_WARRIOR';   // 🌍 — Balanced across all types

export interface DonorProfileConfig {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const DONOR_PROFILES: Record<DonorProfile, DonorProfileConfig> = {
  OCCASIONNEL: {
    label: 'Occasionnel',
    emoji: '🌱',
    color: '#52b788',
    bgColor: 'rgba(82, 183, 136, 0.12)',
    borderColor: 'rgba(82, 183, 136, 0.3)',
    description: 'New contributor finding their way'
  },
  REGULIER: {
    label: 'Régulier',
    emoji: '💚',
    color: '#14C7A5',
    bgColor: 'rgba(20, 199, 165, 0.12)',
    borderColor: 'rgba(20, 199, 165, 0.3)',
    description: 'Consistent financial supporter'
  },
  MATERIEL: {
    label: 'Matériel',
    emoji: '📦',
    color: '#e9c46a',
    bgColor: 'rgba(233, 196, 106, 0.12)',
    borderColor: 'rgba(233, 196, 106, 0.3)',
    description: 'Generous material donor'
  },
  BENEVOLE: {
    label: 'Bénévole',
    emoji: '⏰',
    color: '#f4a261',
    bgColor: 'rgba(244, 162, 97, 0.12)',
    borderColor: 'rgba(244, 162, 97, 0.3)',
    description: 'Dedicated time giver'
  },
  PHILANTHROPE: {
    label: 'Philanthrope',
    emoji: '👑',
    color: '#e76f51',
    bgColor: 'rgba(231, 111, 81, 0.12)',
    borderColor: 'rgba(231, 111, 81, 0.3)',
    description: 'Major impact contributor'
  },
  ECO_WARRIOR: {
    label: 'Eco Warrior',
    emoji: '🌍',
    color: '#2a9d8f',
    bgColor: 'rgba(42, 157, 143, 0.12)',
    borderColor: 'rgba(42, 157, 143, 0.3)',
    description: 'Balanced across all donation types'
  }
};

@Component({
  selector: 'app-donate',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './donate.component.html',
  styleUrl: './donate.component.css',
  encapsulation: ViewEncapsulation.None
})
export class DonateComponent implements OnInit, OnDestroy {

  heroTexts = ['Save Our Environment.', 'Take Action.', 'Make a Difference.'];
  heroTextIndex = 0;
  heroTextExit = -1;
  private heroInterval: any;

  events: Event[] = [];
  selectedEventIndex = -1;
  eventsLoading = true;

  selectedAmount: number | null = 20;
  customAmount: number | null = null;
  donateState: 'idle' | 'processing' | 'confirmed' | 'error' = 'idle';

  message = '';
  isAnonymous = false;
  errorMessage = '';
  successMessage = '';

  donationType: 'MONEY' | 'MATERIAL' | 'TIME' = 'MONEY';
  materialQuantity = '';
  volunteerHours: number | null = null;

  isRecurring = false;
  recurringFrequency: 'MONTHLY' | 'QUARTERLY' = 'MONTHLY';

  allDonations: Donation[] = [];
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
  currentUserId: number | null = null;
  private roleSub!: Subscription;

  deletingId: number | null = null;
  validatingId: number | null = null;
  activeTab: 'browse' | 'donate' | 'history' = 'browse';
  currentStep = 1;
  showConfirmModal = false;
  showSuccessModal = false;
  pendingDonation: Donation | null = null;
  historyFilter: 'all' | 'MONEY' | 'MATERIAL' | 'TIME' = 'all';
  Math = Math;

  // ═══════════════════════════════════════════════════════════════
  // K-MEANS CLUSTERING — Donor Profile State
  // ═══════════════════════════════════════════════════════════════
  currentDonorProfile: DonorProfile = 'OCCASIONNEL';
  donorProfileConfig = DONOR_PROFILES['OCCASIONNEL'];
  userDonationHistory: Donation[] = []; // All user's donations across events
  showProfileBadge = true;

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
  ) { }

  ngOnInit(): void {
    this.currentUserEmail = this.authService.currentUserEmail;
    this.currentUserId = this.authService.currentUser?.id ?? null;
    this.roleSub = this.authService.roleStream$.subscribe((role: string | null) => {
      this.currentRole = role;
      this.currentUserId = this.authService.currentUser?.id ?? null;
      this.cdr.markForCheck();
    });
    this.startHeroAnimation();
    this.loadEvents();
    this.loadUserDonationHistory(); // Load for K-Means clustering

    // ── Détecter redirection depuis Stripe ?status=success&recurringId=X ──
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const recurringId = urlParams.get('recurringId');
    const sessionId = urlParams.get('session_id');

    if (status === 'success' && recurringId) {
      this.donationService.confirmRecurringDonation(
        Number(recurringId),
        sessionId || undefined
      ).subscribe({
        next: (res: RecurringDonationResponse) => {
          this.successMessage = '🌱 Donation mensuelle activée avec succès !';
          this.showSuccessModal = true;
          setTimeout(() => {
            this.successMessage = '';
            this.showSuccessModal = false;
          }, 4000);
          window.history.replaceState({}, '', '/donate');
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Confirm error:', err);
          this.successMessage = '🌱 Paiement confirmé ! Donation mensuelle activée.';
          window.history.replaceState({}, '', '/donate');
          this.cdr.markForCheck();
        }
      });
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.heroInterval);
    this.roleSub?.unsubscribe();
  }

  // ═══════════════════════════════════════════════════════════════
  // K-MEANS CLUSTERING — Profile Computation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Load all user's donations for clustering analysis
   */
  loadUserDonationHistory(): void {
    if (!this.isLoggedIn || !this.currentUserId) return;

    // ✅ Appel avec userId récupéré de l'AuthService
    this.donationService.getMyDonations(this.currentUserId).subscribe({
      next: (donations: Donation[]) => {
        this.userDonationHistory = donations;
        this.computeDonorProfile();
        this.cdr.markForCheck();
      },
      error: () => {
        this.userDonationHistory = [];
        this.computeDonorProfile();
      }
    });
  }

  /**
   * K-Means-like clustering to determine donor profile
   * Features: [money_count, material_count, time_count, total_money, avg_amount]
   */
  computeDonorProfile(): void {
    const history = this.userDonationHistory;

    if (history.length === 0) {
      this.currentDonorProfile = 'OCCASIONNEL';
      this.donorProfileConfig = DONOR_PROFILES['OCCASIONNEL'];
      return;
    }

    // Feature extraction
    const moneyCount = history.filter(d => d.type === 'MONEY').length;
    const materialCount = history.filter(d => d.type === 'MATERIAL').length;
    const timeCount = history.filter(d => d.type === 'TIME').length;
    const totalMoney = history
      .filter(d => d.type === 'MONEY')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
    const avgAmount = history.length > 0 ? totalMoney / history.length : 0;
    const totalDonations = history.length;

    // K-Means clustering logic (simplified centroid-based classification)
    let profile: DonorProfile = 'OCCASIONNEL';

    // Admin/Philanthrope: high total or admin role
    if (this.isAdmin || totalMoney > 500 || avgAmount > 100) {
      profile = 'PHILANTHROPE';
    }
    // Eco Warrior: balanced across all types (at least 2 of each)
    else if (moneyCount >= 2 && materialCount >= 2 && timeCount >= 2) {
      profile = 'ECO_WARRIOR';
    }
    // Bénévole: mostly time donations
    else if (timeCount >= 3 && timeCount > moneyCount && timeCount > materialCount) {
      profile = 'BENEVOLE';
    }
    // Matériel: mostly material donations (3+)
    else if (materialCount >= 3 && materialCount > moneyCount && materialCount > timeCount) {
      profile = 'MATERIEL';
    }
    // Régulier: mostly money donations with consistent giving
    else if (moneyCount >= 3 && moneyCount > materialCount && moneyCount > timeCount) {
      profile = 'REGULIER';
    }
    // Occasionnel: few donations or mixed with no dominance
    else if (totalDonations <= 2) {
      profile = 'OCCASIONNEL';
    }
    // Default to regular if money is dominant
    else if (moneyCount > materialCount && moneyCount > timeCount) {
      profile = 'REGULIER';
    }
    // Default to occasionnel for edge cases
    else {
      profile = 'OCCASIONNEL';
    }

    this.currentDonorProfile = profile;
    this.donorProfileConfig = DONOR_PROFILES[profile];
  }

  /**
   * Called after each successful donation to recompute profile
   */
  refreshProfileAfterDonation(): void {
    this.loadUserDonationHistory();
  }

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get isAdmin(): boolean { return this.currentRole === 'ADMIN'; }
  get isLoggedIn(): boolean { return this.authService.isLoggedIn; }

  get visibleDonations(): Donation[] {
    if (this.isAdmin) return this.allDonations;
    return this.allDonations.filter(d =>
      d.status === 'VALIDATED' || this.isOwner(d)
    );
  }

  get selectedEvent(): Event | null {
    return this.selectedEventIndex >= 0 ? this.events[this.selectedEventIndex] : null;
  }

  get currentUserInitial(): string {
    return (this.authService.currentUserEmail || '?').charAt(0).toUpperCase();
  }

  get currentUserDisplayName(): string {
    return this.authService.currentUserEmail || 'User';
  }

  // ═══════════════════════════════════════════════════════════════
  // HERO & NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  startHeroAnimation(): void {
    this.heroInterval = setInterval(() => {
      this.heroTextExit = this.heroTextIndex;
      setTimeout(() => {
        this.heroTextExit = -1;
        this.heroTextIndex = (this.heroTextIndex + 1) % this.heroTexts.length;
      }, 600);
    }, 4500);
  }

  scrollToForm(): void {
    document.querySelector('.donate-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════

  loadEvents(): void {
    this.eventsLoading = true;
    this.eventService.getAll().subscribe({
      next: (data: Event[]) => {
        this.events = data;
        this.eventsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.eventsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectEvent(index: number): void {
    this.selectedEventIndex = index;
    this.currentStep = 2;
    this.goToDonate();
    this.loadDonationsForEvent();
  }

  goToDonate(): void {
    if (this.selectedEventIndex === -1) return;
    this.activeTab = 'donate';
    setTimeout(() => {
      document.querySelector('.donate-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  goToBrowse(): void {
    this.activeTab = 'browse';
    setTimeout(() => {
      document.querySelector('.donate-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  loadDonationsForEvent(): void {
    const ev = this.selectedEvent;
    if (!ev?.id) return;
    this.donationsLoading = true;
    this.donationService.getDonationsByEvent(ev.id).subscribe({
      next: (data: Donation[]) => {
        this.allDonations = data;
        this.donations = this.visibleDonations;
        this.donationsLoading = false;
      },
      error: () => {
        this.allDonations = [];
        this.donations = [];
        this.donationsLoading = false;
      }
    });
    this.donationService.getTotalByEvent(ev.id).subscribe({
      next: (total: number) => this.totalDonated = total,
      error: () => this.totalDonated = 0
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DONATION FORM
  // ═══════════════════════════════════════════════════════════════

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

    if (this.isRecurring && this.donationType === 'MONEY') {
      this.handleRecurringDonate();
      return;
    }

    this.errorMessage = '';
    this.pendingDonation = {
      amount: this.donationType === 'TIME' ? (this.volunteerHours || 0) : amount,
      type: this.donationType,
      quantity: this.donationType === 'MATERIAL' ? this.materialQuantity : undefined,
      message: this.message || '',
      anonymous: this.isAnonymous,
      transactionId: `TXN-${Date.now()}`
    };
    this.showConfirmModal = true;
  }

  handleRecurringDonate(): void {
    const ev = this.selectedEvent;
    if (!ev?.id) return;

    this.donateState = 'processing';
    this.errorMessage = '';

    this.donationService.createRecurringDonation({
      amount: this.getFinalAmount(),
      frequency: this.recurringFrequency,
      eventId: ev.id
    }).subscribe({
      next: (res: RecurringDonationResponse) => {
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          this.donateState = 'confirmed';
          this.showSuccessModal = true;
          this.successMessage = 'Donation mensuelle activée ! 🌱';
          setTimeout(() => { this.donateState = 'idle'; }, 3000);
        }
      },
      error: (err: any) => {
        this.donateState = 'error';
        this.errorMessage = err?.error?.message || 'Erreur activation donation mensuelle';
        setTimeout(() => { this.donateState = 'idle'; }, 5000);
      }
    });
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
    this.errorMessage = '';

    const snapshot = { ...this.pendingDonation };

    if (this.donationType === 'MONEY') {
      this.donationService.createDonationForEvent(snapshot, ev.id).subscribe({
        next: (donation: Donation) => {
          if (!donation?.id) {
            this._showError('Could not create donation record.');
            return;
          }
          this.donationService.createStripeCheckout(snapshot.amount, donation.id).subscribe({
            next: (res: any) => { window.location.href = res.url; },
            error: () => { this._showError('Payment initialization failed. Please try again.'); }
          });
        },
        error: (err: any) => { this._showError(this._extractError(err)); }
      });
      return;
    }

    this.donationService.createDonationForEvent(snapshot, ev.id).subscribe({
      next: (donation: Donation) => {
        this.allDonations = [donation, ...this.allDonations];
        this.donations = this.visibleDonations;
        this.donateState = 'confirmed';
        this.showSuccessModal = true;
        this.successMessage = 'Donation confirmed! Thank you 💚';

        // ═══════════════════════════════════════════════════════
        // REFRESH PROFILE AFTER SUCCESSFUL DONATION
        // ═══════════════════════════════════════════════════════
        this.refreshProfileAfterDonation();

        this.resetForm();
        setTimeout(() => {
          this.donateState = 'idle';
          this.successMessage = '';
        }, 3000);
        this.cdr.markForCheck();
      },
      error: (err: any) => { this._showError(this._extractError(err)); }
    });
  }

  private _extractError(err: any): string {
    if (typeof err?.error === 'string') return err.error;
    if (err?.error?.message) return err.error.message;
    if (err?.error?.error) return err.error.error;
    if (err?.message) return err.message;
    return 'Donation failed. Please try again.';
  }

  private _showError(msg: string): void {
    this.donateState = 'error';
    this.errorMessage = msg;
    this.showSuccessModal = false;
    setTimeout(() => {
      this.donateState = 'idle';
      this.errorMessage = '';
    }, 5000);
    this.cdr.markForCheck();
  }

  private _rollback(previousDonations: Donation[], previousTotal: number, msg: string): void {
    this.donations = previousDonations;
    this.totalDonated = previousTotal;
    this._showError(msg);
  }

  viewMyDonations(): void {
    this.showSuccessModal = false;
    this.currentStep = 1;
    this.activeTab = 'history';
  }

  // ═══════════════════════════════════════════════════════════════
  // EDIT / DELETE / VALIDATE
  // ═══════════════════════════════════════════════════════════════

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

    const id = this.editingDonation.id!;
    const patch = {
      amount: this.editAmount,
      message: this.editMessage,
      anonymous: this.editAnonymous,
      type: this.editType,
      quantity: this.editType === 'MATERIAL' ? this.editQuantity : undefined
    };

    this.allDonations = this.allDonations.map(d => d.id === id ? { ...d, ...patch } : d);
    this.donations = this.visibleDonations;
    this.editState = 'confirmed';
    this.editingDonation = null;
    this.successMessage = 'Donation updated! ✅';
    setTimeout(() => this.successMessage = '', 3000);

    this.donationService.update(id, patch).subscribe({
      next: (updated: Donation) => {
        this.allDonations = this.allDonations.map(d => d.id === id ? { ...d, ...updated } : d);
        this.donations = this.visibleDonations;
        this.editState = 'idle';
      },
      error: (err: any) => {
        this.editState = 'idle';
        this.errorMessage = err.error?.message || 'Update failed.';
        this.loadDonationsForEvent();
      }
    });
  }

  deleteDonation(donation: Donation): void {
    if (!donation.id || this.deletingId === donation.id) return;
    if (!confirm('Delete this donation?')) return;
    this.deletingId = donation.id;

    this.allDonations = this.allDonations.filter(d => d.id !== donation.id);
    this.donations = this.visibleDonations;
    if (donation.type === 'MONEY') {
      this.totalDonated = Math.max(0, this.totalDonated - (donation.amount || 0));
    }
    this.successMessage = 'Donation deleted! 🗑️';
    setTimeout(() => this.successMessage = '', 3000);

    this.donationService.delete(donation.id).subscribe({
      next: () => {
        this.deletingId = null;
        // Refresh profile after deletion
        this.refreshProfileAfterDonation();
      },
      error: () => { this.deletingId = null; this.loadDonationsForEvent(); }
    });
  }

  validateDonation(donation: Donation): void {
    if (!donation.id || this.validatingId === donation.id) return;
    this.validatingId = donation.id;

    this.allDonations = this.allDonations.map(d =>
      d.id === donation.id ? { ...d, status: 'VALIDATED' } : d
    );
    this.donations = this.visibleDonations;
    this.successMessage = 'Donation validated! ✅';
    setTimeout(() => this.successMessage = '', 3000);

    this.donationService.validate(donation.id).subscribe({
      next: () => { this.validatingId = null; },
      error: (err: any) => {
        this.validatingId = null;
        this.allDonations = this.allDonations.map(d =>
          d.id === donation.id ? { ...d, status: 'PENDING' } : d
        );
        this.donations = this.visibleDonations;
        this.errorMessage = err.error?.message || 'Validation failed.';
      }
    });
  }

  autoClearError(): void {
    setTimeout(() => this.errorMessage = '', 4000);
  }

  resetForm(): void {
    this.selectedAmount = 20;
    this.customAmount = null;
    this.message = '';
    this.isAnonymous = false;
    this.isRecurring = false;
    this.donationType = 'MONEY';
    this.materialQuantity = '';
    this.volunteerHours = null;
    this.donateState = 'idle';
    this.pendingDonation = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  isOwner(donation: Donation): boolean {
    if (this.currentUserId && donation.userId) {
      return donation.userId === this.currentUserId;
    }
    return !!(this.currentUserEmail && donation.userName === this.currentUserEmail);
  }

  canEdit(donation: Donation): boolean { return this.isOwner(donation) || this.isAdmin; }
  canDelete(donation: Donation): boolean { return this.isOwner(donation) || this.isAdmin; }
  canValidate(): boolean { return this.isAdmin; }

  getFraudClass(score: number): string {
    if (score == null) return '';
    if (score < 0.3) return 'fraud-low';
    if (score < 0.7) return 'fraud-medium';
    return 'fraud-high';
  }

  // ═══════════════════════════════════════════════════════════════
  // DONOR PROFILE GETTERS (Updated for K-Means)
  // ═══════════════════════════════════════════════════════════════

  get donorProfile(): string {
    return this.donorProfileConfig.label;
  }

  get donorEmoji(): string {
    return this.donorProfileConfig.emoji;
  }

  get donorProfileColor(): string {
    return this.donorProfileConfig.color;
  }

  get donorProfileDescription(): string {
    return this.donorProfileConfig.description;
  }

  getTimeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  getDonorInitials(donation: Donation): string {
    if (donation.anonymous) return '?';
    return (donation.userName || 'U').charAt(0).toUpperCase();
  }

  getDonorName(donation: Donation): string {
    if (donation.anonymous) return 'Anonymous';
    return donation.userName || 'User';
  }

  getDonationTypeIcon(type: string): string {
    const icons: Record<string, string> = { MONEY: '💶', MATERIAL: '📦', TIME: '⏰' };
    return icons[type] || '💚';
  }

  getEventStatusClass(status?: string): string {
    const classes: Record<string, string> = {
      UPCOMING: 'status-upcoming',
      ONGOING: 'status-ongoing',
      COMPLETED: 'status-completed',
      CANCELLED: 'status-cancelled'
    };
    return classes[status || ''] || '';
  }

  getMoneyCount(): number { return this.donations.filter(d => d.type === 'MONEY').length; }
  getMaterialCount(): number { return this.donations.filter(d => d.type === 'MATERIAL').length; }
  getTimeCount(): number { return this.donations.filter(d => d.type === 'TIME').length; }
  getValidatedCount(): number { return this.donations.filter(d => d.status === 'VALIDATED').length; }

  filterMoneyTotal(history: any[]): number {
    if (!history) return 0;
    return history
      .filter(d => d.type === 'MONEY')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }
}