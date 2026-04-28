import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  currency: 'EUR' | 'TND' = 'EUR';
  private readonly EUR_TO_TND = 3.37;
  private imageCache = new Map<number, string>();

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadImageCache();
    this.loadCart();
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
    });
  }

  private loadImageCache(): void {
    try {
      const raw = localStorage.getItem('vero_product_images');
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, string>;
        Object.entries(obj).forEach(([k, v]) => this.imageCache.set(Number(k), v));
      }
    } catch { /* ignore */ }
  }

  getImage(productId: number, fallbackImage?: string): string | null {
    return this.imageCache.get(productId) ?? fallbackImage ?? null;
  }

  toggleCurrency() {
    this.currency = this.currency === 'EUR' ? 'TND' : 'EUR';
  }

  formatPrice(price: number): string {
    if (this.currency === 'TND') {
      return (price * this.EUR_TO_TND).toFixed(3) + ' DT';
    }
    return '€' + price.toFixed(2);
  }

  get currencySymbol(): string {
    return this.currency === 'EUR' ? '€' : 'DT';
  }

  loadCart() {
    this.cartItems = this.cartService.getCartItems();
  }

  increaseQuantity(item: CartItem) {
    if (item.quantity < item.product.stock) {
      this.cartService.updateQuantity(item.product.id, item.quantity + 1);
    }
  }

  decreaseQuantity(item: CartItem) {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.product.id, item.quantity - 1);
    }
  }

  removeItem(item: CartItem) {
    this.cartService.removeFromCart(item.product.id);
  }

  getSubtotal(): number {
    return this.cartService.getTotal();
  }

  getDiscount(): number {
    return this.getSubtotal() * 0.1; // 10% discount
  }

  getTotal(): number {
    return this.getSubtotal() - this.getDiscount();
  }

  proceedToCheckout() {
    this.router.navigate(['/checkout']);
  }

  goToShop() {
    this.router.navigate(['/shop']);
  }

  goBack() {
    window.history.back();
  }

  getProductColor(category: string): string {
    const colors: { [key: string]: string } = {
      'natural_cosmetics': 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
      'eco_friendly_home': 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
      'sustainable_fashion': 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)',
      'kitchen_and_dining': 'linear-gradient(135deg, #81ecec 0%, #00b894 100%)',
      'eco_gardening': 'linear-gradient(135deg, #55efc4 0%, #00b894 100%)',
      'eco_pet_products': 'linear-gradient(135deg, #fab1a0 0%, #e17055 100%)',
      'eco_gift_sets': 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)'
    };
    return colors[category] || 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)';
  }

  getProductEmoji(category: string): string {
    const emojis: { [key: string]: string } = {
      'natural_cosmetics': '🌿',
      'eco_friendly_home': '🏠',
      'sustainable_fashion': '👕',
      'kitchen_and_dining': '🍽️',
      'eco_gardening': '🌱',
      'eco_pet_products': '🐾',
      'eco_gift_sets': '🎁'
    };
    return emojis[category] || '🌍';
  }
}
