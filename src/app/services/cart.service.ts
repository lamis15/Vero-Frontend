import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from './product.models';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItems.asObservable();

  private cartCount = new BehaviorSubject<number>(0);
  public cartCount$ = this.cartCount.asObservable();

  constructor() {
    // Load cart from localStorage on init
    this.loadCartFromStorage();
  }

  private loadCartFromStorage() {
    const saved = localStorage.getItem('vero_cart');
    if (saved) {
      try {
        const items = JSON.parse(saved);
        this.cartItems.next(items);
        this.updateCartCount();
      } catch (e) {
        console.error('Error loading cart from storage:', e);
      }
    }
  }

  private saveCartToStorage() {
    localStorage.setItem('vero_cart', JSON.stringify(this.cartItems.value));
  }

  private updateCartCount() {
    const count = this.cartItems.value.reduce((sum, item) => sum + item.quantity, 0);
    this.cartCount.next(count);
  }

  addToCart(product: Product, quantity: number = 1): void {
    const currentItems = this.cartItems.value;
    const existingItem = currentItems.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      currentItems.push({ product, quantity });
    }

    this.cartItems.next([...currentItems]);
    this.updateCartCount();
    this.saveCartToStorage();
  }

  removeFromCart(productId: number): void {
    const currentItems = this.cartItems.value.filter(item => item.product.id !== productId);
    this.cartItems.next(currentItems);
    this.updateCartCount();
    this.saveCartToStorage();
  }

  updateQuantity(productId: number, quantity: number): void {
    const currentItems = this.cartItems.value;
    const item = currentItems.find(item => item.product.id === productId);

    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        item.quantity = quantity;
        this.cartItems.next([...currentItems]);
        this.updateCartCount();
        this.saveCartToStorage();
      }
    }
  }

  incrementQuantity(productId: number): void {
    const item = this.cartItems.value.find(item => item.product.id === productId);
    if (item) {
      this.updateQuantity(productId, item.quantity + 1);
    }
  }

  decrementQuantity(productId: number): void {
    const item = this.cartItems.value.find(item => item.product.id === productId);
    if (item) {
      this.updateQuantity(productId, item.quantity - 1);
    }
  }

  clearCart(): void {
    this.cartItems.next([]);
    this.updateCartCount();
    localStorage.removeItem('vero_cart');
  }

  // Reinitialize cart (useful after login/logout)
  reinitializeCart(): void {
    this.cartItems.next([]);
    this.updateCartCount();
    this.loadCartFromStorage();
  }

  getCartItems(): CartItem[] {
    return this.cartItems.value;
  }

  getTotal(): number {
    return this.cartItems.value.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }
}
