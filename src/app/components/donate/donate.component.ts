import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewEncapsulation,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { DonationService, Donation, RecurringDonationResponse } from '../../services/donation.service';
import { EventApiService, Event } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';

export type DonorProfile =
  | 'OCCASIONNEL'
  | 'REGULIER'
  | 'MATERIEL'
  | 'BENEVOLE'
  | 'PHILANTHROPE'
  | 'ECO_WARRIOR';

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

  @ViewChild('cardElementContainer') cardElementContainer!: ElementRef<HTMLDivElement>;

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

  stripe: Stripe | null = null;
  private stripeElements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;
  showPaymentModal = false;
  paymentError = '';

  deletingId: number | null = null;
  validatingId: number | null = null;
  activeTab: 'browse' | 'donate' | 'history' = 'browse';
  currentStep = 1;

  readonly pageSize = 6;
  eventsPage = 1;
  historyPage = 1;
  showConfirmModal = false;
  showSuccessModal = false;
  pendingDonation: Donation | null = null;
  historyFilter: 'all' | 'MONEY' | 'MATERIAL' | 'TIME' = 'all';
  Math = Math;

  currentDonorProfile: DonorProfile = 'OCCASIONNEL';
  donorProfileConfig = DONOR_PROFILES['OCCASIONNEL'];
  userDonationHistory: Donation[] = [];
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
    private cdr: ChangeDetectorRef,
    private paymentService: PaymentService
  ) {}

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
    this.loadUserDonationHistory();
    this.initStripe();

    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const recurringId = urlParams.get('recurringId');
    const sessionId = urlParams.get('session_id');

    if (status === 'success' && recurringId) {
      this.donationService.confirmRecurringDonation(
        Number(recurringId),
        sessionId || undefined
      ).subscribe({
        next: () => {
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
    this.cardElement?.destroy();
  }

  private initStripe(): void {
    this.paymentService.getConfig().subscribe({
      next: async (config) => {
        this.stripe = await loadStripe(config.publishableKey);

        if (this.stripe) {
          this.stripeElements = this.stripe.elements();
        }
      },
      error: () => {
        this.paymentError = 'Impossible de charger Stripe.';
      }
    });
  }

  openPaymentModal(): void {
    this.showConfirmModal = false;
    this.donateState = 'idle';
    this.paymentError = '';
    this.showPaymentModal = true;

    this.cdr.detectChanges();

    setTimeout(() => {
      this.mountCardElement();
    }, 0);
  }

  private mountCardElement(): void {
    if (!this.stripeElements) {
      this.paymentError = 'Stripe n’est pas encore initialisé.';
      return;
    }

    if (!this.cardElementContainer?.nativeElement) {
      this.paymentError = 'Champ de carte introuvable.';
      return;
    }

    if (this.cardElement) {
      this.cardElement.destroy();
      this.cardElement = null;
    }

    this.cardElementContainer.nativeElement.innerHTML = '';

    this.cardElement = this.stripeElements.create('card', {
      hidePostalCode: true,
      style: {
        base: {
          fontSize: '16px',
          color: '#ffffff',
          fontFamily: '"DM Sans", sans-serif',
          iconColor: '#14C7A5',
          '::placeholder': {
            color: '#9ca3af'
          }
        },
        invalid: {
          color: '#ef4444',
          iconColor: '#ef4444'
        }
      }
    });

    this.cardElement.mount(this.cardElementContainer.nativeElement);

    this.cardElement.on('change', (event: any) => {
      this.paymentError = event.error?.message || '';
      this.cdr.markForCheck();
    });
  }

  async processPayment(): Promise<void> {
    if (!this.stripe || !this.cardElement || !this.pendingDonation) {
      this.paymentError = 'Stripe ou donation non prêt.';
      return;
    }

    const ev = this.selectedEvent;
    if (!ev?.id) {
      this.paymentError = 'Événement introuvable.';
      return;
    }

    this.donateState = 'processing';
    this.paymentError = '';

    const snapshot = { ...this.pendingDonation };

    this.donationService.createDonationForEvent(snapshot, ev.id).subscribe({
      next: (donation: Donation) => {
        if (!donation?.id) {
          this.paymentError = 'Impossible de créer la donation.';
          this.donateState = 'idle';
          return;
        }

        this.donationService.createDonationPaymentIntent(donation.id, snapshot.amount).subscribe({
          next: async (res) => {
            const { error, paymentIntent } = await this.stripe!.confirmCardPayment(
              res.clientSecret,
              {
                payment_method: {
                  card: this.cardElement!
                }
              }
            );

            if (error) {
              this.paymentError = error.message || 'Paiement échoué.';
              this.donateState = 'idle';
              this.cdr.markForCheck();
              return;
            }

            if (paymentIntent?.status === 'succeeded') {
              this.showPaymentModal = false;

              this.allDonations = [donation, ...this.allDonations];
              this.donations = this.visibleDonations;

              this.donateState = 'confirmed';
              this.showSuccessModal = true;
              this.successMessage = 'Donation confirmée ! Merci 💚';

              this.refreshProfileAfterDonation();
              this.resetForm();

              setTimeout(() => {
                this.donateState = 'idle';
                this.successMessage = '';
              }, 3000);

              this.cdr.markForCheck();
            }
          },
          error: () => {
            this.paymentError = 'Initialisation du paiement échouée.';
            this.donateState = 'idle';
            this.cdr.markForCheck();
          }
        });
      },
      error: (err: any) => {
        this.paymentError = this._extractError(err);
        this.donateState = 'idle';
        this.cdr.markForCheck();
      }
    });
  }

  cancelPaymentModal(): void {
    this.showPaymentModal = false;
    this.paymentError = '';
    this.donateState = 'idle';

    if (this.cardElement) {
      this.cardElement.destroy();
      this.cardElement = null;
    }
  }

  loadUserDonationHistory(): void {
    if (!this.isLoggedIn || !this.currentUserId) return;

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

  computeDonorProfile(): void {
    const history = this.userDonationHistory;

    if (history.length === 0) {
      this.currentDonorProfile = 'OCCASIONNEL';
      this.donorProfileConfig = DONOR_PROFILES['OCCASIONNEL'];
      return;
    }

    const moneyCount = history.filter(d => d.type === 'MONEY').length;
    const materialCount = history.filter(d => d.type === 'MATERIAL').length;
    const timeCount = history.filter(d => d.type === 'TIME').length;
    const totalMoney = history
      .filter(d => d.type === 'MONEY')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
    const avgAmount = history.length > 0 ? totalMoney / history.length : 0;
    const totalDonations = history.length;

    let profile: DonorProfile = 'OCCASIONNEL';

    if (this.isAdmin || totalMoney > 500 || avgAmount > 100) {
      profile = 'PHILANTHROPE';
    } else if (moneyCount >= 2 && materialCount >= 2 && timeCount >= 2) {
      profile = 'ECO_WARRIOR';
    } else if (timeCount >= 3 && timeCount > moneyCount && timeCount > materialCount) {
      profile = 'BENEVOLE';
    } else if (materialCount >= 3 && materialCount > moneyCount && materialCount > timeCount) {
      profile = 'MATERIEL';
    } else if (moneyCount >= 3 && moneyCount > materialCount && moneyCount > timeCount) {
      profile = 'REGULIER';
    } else if (totalDonations <= 2) {
      profile = 'OCCASIONNEL';
    } else if (moneyCount > materialCount && moneyCount > timeCount) {
      profile = 'REGULIER';
    }

    this.currentDonorProfile = profile;
    this.donorProfileConfig = DONOR_PROFILES[profile];
  }

  refreshProfileAfterDonation(): void {
    this.loadUserDonationHistory();
  }

  get isAdmin(): boolean {
    return this.currentRole === 'ADMIN';
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

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
          setTimeout(() => {
            this.donateState = 'idle';
          }, 3000);
        }
      },
      error: (err: any) => {
        this.donateState = 'error';
        this.errorMessage = err?.error?.message || 'Erreur activation donation mensuelle';
        setTimeout(() => {
          this.donateState = 'idle';
        }, 5000);
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
      this.openPaymentModal();
      return;
    }

    this.donationService.createDonationForEvent(snapshot, ev.id).subscribe({
      next: (donation: Donation) => {
        this.allDonations = [donation, ...this.allDonations];
        this.donations = this.visibleDonations;
        this.donateState = 'confirmed';
        this.showSuccessModal = true;
        this.successMessage = 'Donation confirmed! Thank you 💚';

        this.refreshProfileAfterDonation();
        this.resetForm();

        setTimeout(() => {
          this.donateState = 'idle';
          this.successMessage = '';
        }, 3000);

        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this._showError(this._extractError(err));
      }
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
        this.refreshProfileAfterDonation();
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

    this.allDonations = this.allDonations.map(d =>
      d.id === donation.id ? { ...d, status: 'VALIDATED' } : d
    );
    this.donations = this.visibleDonations;

    this.successMessage = 'Donation validated! ✅';
    setTimeout(() => this.successMessage = '', 3000);

    this.donationService.validate(donation.id).subscribe({
      next: () => {
        this.validatingId = null;
      },
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

  isOwner(donation: Donation): boolean {
    if (this.currentUserId && donation.userId) {
      return donation.userId === this.currentUserId;
    }

    return !!(this.currentUserEmail && donation.userName === this.currentUserEmail);
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

  getFraudClass(score: number): string {
    if (score == null) return '';
    if (score < 0.3) return 'fraud-low';
    if (score < 0.7) return 'fraud-medium';
    return 'fraud-high';
  }

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
    const icons: Record<string, string> = {
      MONEY: '💶',
      MATERIAL: '📦',
      TIME: '⏰'
    };

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

  filterMoneyTotal(history: any[]): number {
    if (!history) return 0;

    return history
      .filter(d => d.type === 'MONEY')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }

  get pagedEvents(): Event[] {
    const start = (this.eventsPage - 1) * this.pageSize;
    return this.events.slice(start, start + this.pageSize);
  }

  get eventsTotal(): number {
    return Math.max(1, Math.ceil(this.events.length / this.pageSize));
  }

  get eventsPageNumbers(): number[] {
    return this.buildPages(this.eventsPage, this.eventsTotal);
  }

  goToEventsPage(p: number): void {
    if (p >= 1 && p <= this.eventsTotal) this.eventsPage = p;
  }

  get pagedHistory(): Donation[] {
    const start = (this.historyPage - 1) * this.pageSize;
    return this.donations.slice(start, start + this.pageSize);
  }

  get historyTotal(): number {
    return Math.max(1, Math.ceil(this.donations.length / this.pageSize));
  }

  get historyPageNumbers(): number[] {
    return this.buildPages(this.historyPage, this.historyTotal);
  }

  goToHistoryPage(p: number): void {
    if (p >= 1 && p <= this.historyTotal) this.historyPage = p;
  }

  private buildPages(current: number, total: number): number[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [1];

    if (current > 3) pages.push(-1);

    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }

    if (current < total - 2) pages.push(-1);

    pages.push(total);

    return pages;
  }
}