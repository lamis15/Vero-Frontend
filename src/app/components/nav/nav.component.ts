import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { ForumService } from '../../services/forum.service';
import { AuthService } from '../../services/auth.service';
import { CartService, CartItem } from '../../services/cart.service';
import { PaymentService, PaymentRequest } from '../../services/payment.service';
import { Notification } from '../../services/forum.models';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount = 0;
  showDropdown = false;
  private pollInterval: any;

  // Cart properties
  cartItems: CartItem[] = [];
  cartCount = 0;
  showCartDropdown = false;
  cartAnimate = false;

  // Profile dropdown
  showProfileDropdown = false;
  currentUserRole: string | null = null;

  // Checkout modal properties
  showCheckoutModal = false;
  deliveryAddress = '';
  orderNotes = '';
  paymentLoading = false;
  paymentError: string | null = null;
  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  cardElement: StripeCardElement | null = null;

  constructor(
    private forumService: ForumService,
    public authService: AuthService,
    private cartService: CartService,
    private paymentService: PaymentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    if (this.authService.isLoggedIn) {
      this.fetchNotifications();
      this.pollInterval = setInterval(() => this.fetchNotifications(), 30000);
      
      // Get current user role
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          console.log('Fetched user info:', user);
          this.currentUserRole = user.role;
          this.cdr.markForCheck(); // Trigger change detection
        },
        error: (err) => {
          console.error('Error getting user role:', err);
        }
      });
    }

    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.cdr.markForCheck();
    });

    this.cartService.cartCount$.subscribe(count => {
      if (count > this.cartCount) {
        this.triggerCartAnimation();
      }
      this.cartCount = count;
      this.cdr.markForCheck();
    });

    // Initialize Stripe
    try {
      this.paymentService.getConfig().subscribe(async (config) => {
        this.stripe = await loadStripe(config.publishableKey);
      });
    } catch (err) {
      console.error('Error loading Stripe:', err);
    }
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  fetchNotifications() {
    this.forumService.getUnreadNotifications().subscribe(nots => {
      this.notifications = nots.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.unreadCount = this.notifications.filter(n => !n.isRead).length;
      this.cdr.markForCheck();
    });
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    this.showCartDropdown = false;
    this.showProfileDropdown = false;
    if (this.showDropdown) {
      this.fetchNotifications();
    }
  }

  markAsRead(n: Notification, event: Event) {
    event.stopPropagation();
    this.forumService.markNotificationAsRead(n.id).subscribe(() => {
      n.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.cdr.markForCheck();
    });
  }

  toggleCartDropdown(event: Event) {
    event.stopPropagation();
    this.showCartDropdown = !this.showCartDropdown;
    this.showDropdown = false;
    this.showProfileDropdown = false;
  }

  toggleProfileDropdown(event: Event) {
    event.stopPropagation();
    this.showProfileDropdown = !this.showProfileDropdown;
    this.showDropdown = false;
    this.showCartDropdown = false;
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.showProfileDropdown = false;
        this.currentUserRole = null;
        // Clear any cached data
        this.cartService.clearCart();
        // Force page reload to clear all state
        window.location.href = '/';
      },
      error: (err) => {
        console.error('Logout error:', err);
        // Even if backend fails, logout locally
        this.authService.logoutLocal();
        this.showProfileDropdown = false;
        this.currentUserRole = null;
        this.cartService.clearCart();
        window.location.href = '/';
      }
    });
  }

  isAdmin(): boolean {
    return this.currentUserRole?.toUpperCase() === 'ADMIN';
  }

  triggerCartAnimation() {
    this.cartAnimate = true;
    setTimeout(() => {
      this.cartAnimate = false;
    }, 600);
  }

  incrementQuantity(productId: number) {
    this.cartService.incrementQuantity(productId);
  }

  decrementQuantity(productId: number) {
    this.cartService.decrementQuantity(productId);
  }

  removeFromCart(productId: number) {
    this.cartService.removeFromCart(productId);
  }

  clearCart() {
    if (confirm('Are you sure you want to clear your cart?')) {
      this.cartService.clearCart();
    }
  }

  getCartTotal(): number {
    return this.cartService.getTotal();
  }

  async openCheckoutModal() {
    if (this.cartItems.length === 0) return;
    
    this.showCartDropdown = false;
    this.showCheckoutModal = true;
    this.deliveryAddress = '';
    this.orderNotes = '';
    this.paymentError = null;

    // Initialize Stripe Elements
    if (this.stripe && !this.elements) {
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
          }
        }
      });
      
      setTimeout(() => {
        this.cardElement?.mount('#modal-card-element');
      }, 100);
    }
  }

  closeCheckoutModal() {
    this.showCheckoutModal = false;
    if (this.cardElement) {
      this.cardElement.unmount();
      this.cardElement = null;
    }
    if (this.elements) {
      this.elements = null;
    }
  }

  async handlePayment() {
    if (!this.deliveryAddress.trim()) {
      this.paymentError = 'Please enter a delivery address';
      return;
    }

    if (!this.stripe || !this.cardElement) {
      this.paymentError = 'Payment system not ready';
      return;
    }

    this.paymentLoading = true;
    this.paymentError = null;

    try {
      // Get current user ID
      this.authService.getCurrentUser().subscribe({
        next: async (user) => {
          const paymentRequest: PaymentRequest = {
            userId: user.id,
            items: this.cartItems.map(item => ({
              productId: item.product.id,
              quantity: item.quantity
            })),
            deliveryAddress: this.deliveryAddress,
            notes: this.orderNotes
          };

          this.paymentService.createPaymentIntent(paymentRequest).subscribe({
            next: async (response) => {
              const { error: stripeError, paymentIntent } = await this.stripe!.confirmCardPayment(
                response.clientSecret,
                {
                  payment_method: {
                    card: this.cardElement!
                  }
                }
              );

              if (stripeError) {
                this.paymentError = stripeError.message || 'Payment failed';
                this.paymentLoading = false;
              } else if (paymentIntent?.status === 'succeeded') {
                this.paymentService.confirmPayment(response.orderId).subscribe({
                  next: () => {
                    this.cartService.clearCart();
                    this.closeCheckoutModal();
                    this.router.navigate(['/orders'], { 
                      queryParams: { success: true, orderId: response.orderId } 
                    });
                  },
                  error: (err) => {
                    console.error('Error confirming payment:', err);
                    this.paymentLoading = false;
                  }
                });
              }
            },
            error: (err) => {
              console.error('Error creating payment intent:', err);
              this.paymentError = 'Failed to process payment';
              this.paymentLoading = false;
            }
          });
        },
        error: (err) => {
          console.error('Error getting current user:', err);
          this.paymentError = 'Failed to authenticate user';
          this.paymentLoading = false;
        }
      });
    } catch (err) {
      console.error('Payment error:', err);
      this.paymentError = 'An unexpected error occurred';
      this.paymentLoading = false;
    }
  }

  @HostListener('document:click')
  closeDropdown() {
    this.showDropdown = false;
    this.showCartDropdown = false;
    this.showProfileDropdown = false;
  }
}
