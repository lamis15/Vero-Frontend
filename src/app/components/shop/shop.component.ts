import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FadeInDirective } from '../../fade-in.directive';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { RecommendationService } from '../../services/recommendation.service';
import { AuthService } from '../../services/auth.service';
import { Product, ProductCategory } from '../../services/product.models';
import { Observable } from 'rxjs';
import * as QRCode from 'qrcode';

interface ProductDisplay extends Product {
  added?: boolean;
  qrCodeUrl?: string;
}

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css'
})
export class ShopComponent implements OnInit, AfterViewInit {

  @ViewChild('heroVideo') heroVideoRef!: ElementRef<HTMLVideoElement>;
  currentCategory: string = 'all';
  products: ProductDisplay[] = [];
  filteredProducts: ProductDisplay[] = [];
  loading = true;
  error: string | null = null;

  // Search and filter properties
  searchKeyword = '';
  minPrice = 0;
  maxPrice = 200;
  priceMin = 0;
  priceMax = 200;
  sortOrder: 'asc' | 'desc' | 'none' = 'none';
  showFilters = true;

  // Product details modal
  selectedProduct: ProductDisplay | null = null;
  showProductDetails = false;

  // Category mapping for display
  categoryEmojis: Record<string, string> = {
    'NATURAL_COSMETICS': '🌿',
    'ECO_FRIENDLY_HOME': '🏠',
    'SUSTAINABLE_FASHION': '👕',
    'KITCHEN_AND_DINING': '🍽️',
    'ECO_GARDENING': '🌱',
    'ECO_PET_PRODUCTS': '🐾',
    'ECO_GIFT_SETS': '🎁'
  };

  categoryColors: Record<string, string> = {
    'NATURAL_COSMETICS': '#f0ece4',
    'ECO_FRIENDLY_HOME': '#e8f4e8',
    'SUSTAINABLE_FASHION': '#e8e4dc',
    'KITCHEN_AND_DINING': '#e4ede4',
    'ECO_GARDENING': '#dce8dc',
    'ECO_PET_PRODUCTS': '#ece8e4',
    'ECO_GIFT_SETS': '#f4e8e8'
  };

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private recommendationService: RecommendationService,
    private authService: AuthService
  ) {}

  ngAfterViewInit() {
    const video = this.heroVideoRef?.nativeElement;
    if (video) {
      video.muted = true;
      video.loop = true;
      video.play().catch(() => {});
    }
  }

  ngOnInit() {
    this.loadImageCache();
    this.loadProducts();
  }

  private imageCache = new Map<number, string>();

  private loadImageCache(): void {
    try {
      const raw = localStorage.getItem('vero_product_images');
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, string>;
        Object.entries(obj).forEach(([k, v]) => this.imageCache.set(Number(k), v));
      }
    } catch { /* ignore */ }
  }

  getImage(product: Product): string | null {
    return this.imageCache.get(product.id) ?? product.image ?? null;
  }

  loadProducts() {
    this.loading = true;
    this.error = null;
    
    this.productService.getAll().subscribe({
      next: async (products) => {
        this.products = await Promise.all(
          products.map(async (p) => {
            const qrCodeUrl = await this.generateQRCode(p);
            return { ...p, added: false, qrCodeUrl };
          })
        );
        this.filteredProducts = [...this.products];
        this.calculatePriceRange();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.error = 'Failed to load products. Please try again later.';
        this.loading = false;
      }
    });
  }

  async generateQRCode(product: Product): Promise<string> {
    try {
      const productData = JSON.stringify({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        origin: product.origin,
        isEcological: product.isEcological
      });
      return await QRCode.toDataURL(productData, {
        width: 200,
        margin: 1,
        color: {
          dark: '#2c5f2d',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Error generating QR code:', err);
      return '';
    }
  }

  calculatePriceRange() {
    if (this.products.length > 0) {
      const prices = this.products.map(p => p.price);
      this.priceMin = Math.floor(Math.min(...prices));
      this.priceMax = Math.ceil(Math.max(...prices));
      this.minPrice = this.priceMin;
      this.maxPrice = this.priceMax;
    }
  }

  applyFilters() {
    this.loading = true;
    
    // Determine which backend endpoint to use based on active filters
    let request: Observable<Product[]>;

    if (this.searchKeyword.trim()) {
      // Use search endpoint
      request = this.productService.search(this.searchKeyword);
    } else if (this.currentCategory !== 'all') {
      // Use category endpoint
      const categoryEnum = this.currentCategory.toUpperCase() as ProductCategory;
      request = this.productService.getByCategory(categoryEnum);
    } else if (this.minPrice !== this.priceMin || this.maxPrice !== this.priceMax) {
      // Use price range endpoint
      request = this.productService.getByPriceRange(this.minPrice, this.maxPrice);
    } else {
      // Use getAll endpoint
      request = this.productService.getAll();
    }

    request.subscribe({
      next: (products) => {
        let filtered = products.map(p => ({ ...p, added: false }));

        // Apply client-side price filter if not already filtered by backend
        if (this.searchKeyword.trim() || this.currentCategory !== 'all') {
          filtered = filtered.filter(p =>
            p.price >= this.minPrice && p.price <= this.maxPrice
          );
        }

        // Apply client-side sorting
        if (this.sortOrder === 'asc') {
          filtered.sort((a, b) => a.price - b.price);
        } else if (this.sortOrder === 'desc') {
          filtered.sort((a, b) => b.price - a.price);
        }

        this.filteredProducts = filtered;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error filtering products:', err);
        this.error = 'Failed to filter products. Please try again.';
        this.loading = false;
      }
    });
  }

  onSearchChange() {
    this.applyFilters();
  }

  onPriceChange() {
    this.applyFilters();
  }

  onSortChange() {
    this.applyFilters();
  }

  filterProducts(cat: string) {
    this.currentCategory = cat;
    this.applyFilters();
  }

  resetFilters() {
    this.searchKeyword = '';
    this.minPrice = this.priceMin;
    this.maxPrice = this.priceMax;
    this.sortOrder = 'none';
    this.currentCategory = 'all';
    this.loadProducts();
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  addToCart(product: ProductDisplay) {
    if (product.stock <= 0) {
      alert('This product is out of stock');
      return;
    }
    
    this.cartService.addToCart(product);
    
    product.added = true;
    setTimeout(() => {
      product.added = false;
    }, 1800);
  }

  getProductEmoji(category: string): string {
    return this.categoryEmojis[category] || '📦';
  }

  getProductColor(category: string): string {
    return this.categoryColors[category] || '#f0f0f0';
  }

  getEcoBadge(product: Product): string {
    return product.isEcological ? 'Eco-Friendly' : 'Standard';
  }

  openProductDetails(product: ProductDisplay) {
    this.selectedProduct = product;
    this.showProductDetails = true;
  }

  closeProductDetails() {
    this.showProductDetails = false;
    this.selectedProduct = null;
  }

  downloadQRCode(product: ProductDisplay) {
    if (!product.qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.href = product.qrCodeUrl;
    link.download = `qrcode-${product.name.replace(/\s+/g, '-')}.png`;
    link.click();
  }

  // Currency
  currency: 'EUR' | 'TND' = 'EUR';
  private readonly EUR_TO_TND = 3.37;

  toggleCurrency() {
    this.currency = this.currency === 'EUR' ? 'TND' : 'EUR';
  }

  formatPrice(price: number): string {
    if (this.currency === 'TND') {
      return (price * this.EUR_TO_TND).toFixed(3) + ' DT';
    }
    return '€' + price.toFixed(2);
  }

  getRecommendations() {
    if (!this.authService.isLoggedIn) {
      return;
    }

    this.loading = true;

    this.recommendationService.getRecommendationsForCurrentUser().subscribe({
      next: (recommendedProducts) => {
        this.loading = false;

        if (recommendedProducts.length === 0) {
          return;
        }

        this.filteredProducts = this.products.filter(p =>
          recommendedProducts.some(rp => rp.id === p.id)
        ).map(p => ({ ...p, added: false }));

        setTimeout(() => {
          document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      error: (err) => {
        this.loading = false;
        console.error('Error getting recommendations:', err);
      }
    });
  }
}
