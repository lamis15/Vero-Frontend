import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { FormationService } from '../../services/formation.service';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Formation } from '../../services/formation.models';

@Component({
  selector: 'app-formation-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formation-checkout.component.html',
  styleUrl: './formation-checkout.component.css'
})
export class FormationCheckoutComponent implements OnInit, AfterViewInit, OnDestroy {
  formationId = 0;
  formation: Formation | null = null;
  currentUser: any = null;
  loading = true;
  processing = false;
  error: string | null = null;
  success = false;

  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  cardElement: StripeCardElement | null = null;
  private stripeInitialized = false;
  private viewInitialized = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private paymentService: PaymentService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.formationId = +this.route.snapshot.params['id'];
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.loadFormation();
      },
      error: () => this.router.navigate(['/login'])
    });
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    // Try to initialize Stripe if formation is already loaded
    if (this.formation && this.isPaid() && !this.stripeInitialized) {
      this.initializeStripe();
    }
  }

  ngOnDestroy(): void {
    if (this.cardElement) {
      try {
        this.cardElement.destroy();
      } catch (e) {
        console.error('Error destroying card element:', e);
      }
    }
  }

  loadFormation(): void {
    this.formationService.getById(this.formationId).subscribe({
      next: (f) => {
        this.formation = f;
        this.loading = false;
        this.cdr.detectChanges(); // Force change detection
        
        // Initialize Stripe after view is ready - give Angular time to render the @if block
        if (this.isPaid() && this.viewInitialized && !this.stripeInitialized) {
          // Use longer delay to ensure Angular has rendered the conditional block
          setTimeout(() => this.initializeStripe(), 1000);
        }
      },
      error: () => {
        this.error = 'Formation introuvable';
        this.loading = false;
      }
    });
  }

  isPaid(): boolean {
    return !!(this.formation?.price && this.formation.price > 0);
  }

  isAlreadyRegistered(): boolean {
    if (!this.formation || !this.currentUser) return false;
    return this.formation.participantIds?.includes(this.currentUser.id) || false;
  }

  private async initializeStripe(retryCount = 0): Promise<void> {
    if (this.stripeInitialized) {
      console.log('Stripe already initialized');
      return;
    }

    // Check if container exists
    const container = document.getElementById('card-element');
    if (!container) {
      if (retryCount < 5) {
        console.log(`Card element container not found, retry ${retryCount + 1}/5 in 800ms...`);
        setTimeout(() => this.initializeStripe(retryCount + 1), 800);
      } else {
        console.error('Card element container not found after 5 retries');
        this.error = 'Impossible de charger le formulaire de paiement. Veuillez rafraîchir la page.';
      }
      return;
    }

    try {
      console.log('Initializing Stripe for formation payment...');
      
      const config = await this.paymentService.getConfig().toPromise();
      if (!config) {
        this.error = 'Impossible de charger la configuration de paiement';
        return;
      }

      this.stripe = await loadStripe(config.publishableKey);
      if (!this.stripe) {
        this.error = 'Impossible de charger Stripe';
        console.error('Stripe object is null');
        return;
      }

      console.log('Stripe loaded successfully');
      this.elements = this.stripe.elements();
      this.cardElement = this.elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#2c2c28',
            fontFamily: '"DM Sans", sans-serif',
            '::placeholder': {
              color: '#9ca3af'
            }
          },
          invalid: {
            color: '#ef4444'
          }
        },
        hidePostalCode: true
      });
      
      // Mount the card element
      this.cardElement.mount('#card-element');
      console.log('Card element mounted successfully');
      this.stripeInitialized = true;
      this.error = null;
      this.cdr.detectChanges();
      
      // Listen for errors
      this.cardElement.on('change', (event: any) => {
        if (event.error) {
          this.error = event.error.message;
        } else {
          this.error = null;
        }
        this.cdr.detectChanges();
      });

      this.cardElement.on('ready', () => {
        console.log('Card element is ready for input');
      });

    } catch (err) {
      console.error('Error initializing Stripe:', err);
      this.error = 'Impossible de charger le système de paiement. Veuillez réessayer.';
    }
  }

  async registerFree(): Promise<void> {
    this.processing = true;
    this.error = null;
    
    this.formationService.register(this.formationId, this.currentUser.id).subscribe({
      next: () => {
        this.success = true;
        this.notificationService.show('Inscription réussie !', 'success');
        setTimeout(() => this.router.navigate(['/formations', this.formationId]), 2000);
      },
      error: (err) => {
        this.error = err.error?.message || "Erreur lors de l'inscription";
        this.processing = false;
      }
    });
  }

  async payAndRegister(): Promise<void> {
    if (!this.stripe || !this.cardElement) {
      this.error = 'Système de paiement non prêt. Veuillez patienter...';
      return;
    }

    if (!this.stripeInitialized) {
      this.error = 'Le formulaire de paiement n\'est pas encore prêt. Veuillez patienter...';
      return;
    }

    this.processing = true;
    this.error = null;

    try {
      // Create payment intent for formation
      const response = await this.paymentService.createFormationPaymentIntent(
        this.formationId, 
        this.currentUser.id
      ).toPromise();

      if (!response || !response.clientSecret) {
        this.error = 'Erreur lors de la création du paiement';
        this.processing = false;
        return;
      }

      // Confirm card payment
      const { error: stripeError, paymentIntent } = await this.stripe.confirmCardPayment(
        response.clientSecret,
        { payment_method: { card: this.cardElement } }
      );

      if (stripeError) {
        this.error = stripeError.message || 'Paiement échoué';
        this.processing = false;
      } else if (paymentIntent?.status === 'succeeded') {
        // Register after successful payment
        this.formationService.register(this.formationId, this.currentUser.id).subscribe({
          next: () => {
            this.success = true;
            this.notificationService.show('Paiement et inscription réussis !', 'success');
            setTimeout(() => this.router.navigate(['/formations', this.formationId]), 2000);
          },
          error: () => {
            this.error = 'Paiement réussi mais inscription échouée. Contactez le support.';
            this.processing = false;
          }
        });
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      this.error = err?.message || 'Erreur lors du paiement';
      this.processing = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/formations', this.formationId]);
  }
}
