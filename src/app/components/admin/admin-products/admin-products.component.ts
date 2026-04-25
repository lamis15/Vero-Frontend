import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timeout, catchError, of } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { NotificationService } from '../../../services/notification.service';
import { Product } from '../../../services/product.models';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-products.html',
  styleUrls: ['./admin-products.css']
})
export class AdminProductsComponent implements OnInit {
  @Input() activeTab: 'products' = 'products';
  @Output() tabChange = new EventEmitter<string>();

  products: Product[] = [];
  productsLoading = false;
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '', description: '', price: 0, stock: 0,
    category: 'NATURAL_COSMETICS', image: '', origin: '', isEcological: true
  };
  productSaving = false;
  productImageCache = new Map<number, string>();

  readonly productCategories = [
    'NATURAL_COSMETICS','ECO_FRIENDLY_HOME','SUSTAINABLE_FASHION',
    'KITCHEN_AND_DINING','ECO_GARDENING','ECO_PET_PRODUCTS','ECO_GIFT_SETS'
  ];

  readonly countries = [
    { name: 'Tunisia', flag: '🇹🇳' }, { name: 'France', flag: '🇫🇷' },
    { name: 'Italy', flag: '🇮🇹' }, { name: 'Spain', flag: '🇪🇸' },
    { name: 'Germany', flag: '🇩🇪' }, { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Netherlands', flag: '🇳🇱' }, { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Switzerland', flag: '🇨🇭' }, { name: 'Austria', flag: '🇦🇹' },
    { name: 'Greece', flag: '🇬🇷' }, { name: 'Turkey', flag: '🇹🇷' },
    { name: 'Morocco', flag: '🇲🇦' }, { name: 'Algeria', flag: '🇩🇿' },
    { name: 'Egypt', flag: '🇪🇬' }, { name: 'USA', flag: '🇺🇸' },
    { name: 'Canada', flag: '🇨🇦' }, { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Brazil', flag: '🇧🇷' }, { name: 'Argentina', flag: '🇦🇷' },
    { name: 'UK', flag: '🇬🇧' }, { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Sweden', flag: '🇸🇪' }, { name: 'Norway', flag: '🇳🇴' },
    { name: 'Denmark', flag: '🇩🇰' }, { name: 'Finland', flag: '🇫🇮' },
    { name: 'Poland', flag: '🇵🇱' }, { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Romania', flag: '🇷🇴' }, { name: 'Japan', flag: '🇯🇵' },
    { name: 'China', flag: '🇨🇳' }, { name: 'South Korea', flag: '🇰🇷' },
    { name: 'India', flag: '🇮🇳' }, { name: 'Thailand', flag: '🇹🇭' },
    { name: 'Vietnam', flag: '🇻🇳' }, { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Australia', flag: '🇦🇺' }, { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'South Africa', flag: '🇿🇦' }, { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Local', flag: '🌍' }
  ];

  constructor(
    private productService: ProductService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadImageCache();
    if (this.activeTab === 'products') {
      this.loadProducts();
    }
  }

  private loadImageCache(): void {
    try {
      const raw = localStorage.getItem('vero_product_images');
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, string>;
        Object.entries(obj).forEach(([k, v]) => this.productImageCache.set(Number(k), v));
      }
    } catch { }
  }

  private saveImageCache(): void {
    try {
      const obj: Record<string, string> = {};
      this.productImageCache.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem('vero_product_images', JSON.stringify(obj));
    } catch { }
  }

  getProductImage(p: Product): string | null {
    return this.productImageCache.get(p.id) ?? p.image ?? null;
  }

  loadProducts(): void {
    this.productsLoading = true;
    this.cdr.detectChanges();
    this.productService.getAll().pipe(
      timeout(15000),
      catchError(() => {
        this.notificationService.error('Products request timed out — restart the backend.');
        this.productsLoading = false;
        this.cdr.detectChanges();
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.products = data.map(p => ({ ...p, image: p.image && p.image.length > 200 ? null : p.image })) as any;
        this.productsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notificationService.error('Failed to load products.');
        this.productsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteProduct(id: number): void {
    if (!confirm('Delete this product?')) return;
    this.productService.delete(id).subscribe({
      next: () => { 
        this.products = this.products.filter(p => p.id !== id); 
        this.notificationService.success('Product deleted.'); 
      },
      error: () => this.notificationService.error('Failed to delete product.')
    });
  }

  openProductModal(product?: Product): void {
    this.editingProduct = product ?? null;
    if (product) {
      this.productForm = {
        name: product.name, description: product.description,
        price: product.price, stock: product.stock,
        category: product.category as string,
        image: this.productImageCache.get(product.id) ?? product.image ?? '',
        origin: product.origin ?? '',
        isEcological: product.isEcological
      };
    } else {
      this.productForm = { name: '', description: '', price: 0, stock: 0,
        category: 'NATURAL_COSMETICS', image: '', origin: '', isEcological: true };
    }
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.editingProduct = null;
  }

  onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const file = input.files[0];
    if (file.size > 500 * 1024) { 
      this.notificationService.error('Image must be under 500KB.'); 
      return; 
    }
    const reader = new FileReader();
    reader.onload = () => { this.productForm.image = reader.result as string; };
    reader.readAsDataURL(file);
  }

  saveProduct(): void {
    if (!this.productForm.name.trim()) { this.notificationService.error('Name is required.'); return; }
    if (!this.productForm.price || this.productForm.price <= 0) { this.notificationService.error('Price must be > 0.'); return; }
    
    this.productSaving = true;
    const imageToCache = this.productForm.image;
    const payload: any = { ...this.productForm };
    
    if (this.editingProduct) {
      payload.id = this.editingProduct.id;
      this.productService.update(payload).subscribe({
        next: (updated) => {
          if (imageToCache) { this.productImageCache.set(updated.id, imageToCache); this.saveImageCache(); }
          const idx = this.products.findIndex(p => p.id === updated.id);
          if (idx !== -1) this.products[idx] = updated;
          this.products = [...this.products];
          this.notificationService.success('Product updated.');
          this.closeProductModal();
          this.productSaving = false;
          this.cdr.detectChanges();
        },
        error: () => { this.notificationService.error('Failed to update product.'); this.productSaving = false; }
      });
    } else {
      this.productService.create(payload).subscribe({
        next: (created) => {
          if (imageToCache) { this.productImageCache.set(created.id, imageToCache); this.saveImageCache(); }
          this.products = [created, ...this.products];
          this.notificationService.success('Product created.');
          this.closeProductModal();
          this.productSaving = false;
          this.cdr.detectChanges();
        },
        error: () => { this.notificationService.error('Failed to create product.'); this.productSaving = false; }
      });
    }
  }
}
