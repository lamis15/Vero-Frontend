import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timeout, catchError, of } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { NotificationService } from '../../../services/notification.service';
import { CloudinaryService } from '../../../services/cloudinary.service';
import { Product } from '../../../services/product.models';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-products.html',
  styleUrls: ['./admin-products.css']
})
export class AdminProductsComponent implements OnInit {
  products: Product[] = [];
  productsLoading = false;
  showProductModal = false;
  editingProduct: Product | null = null;
  productSaving = false;
  productImageCache = new Map<number, string>();
  productToDelete: number | null = null;
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  uploadingImage = false;
  uploadProgress = 0;

  productForm = {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'NATURAL_COSMETICS',
    image: '',
    origin: '',
    isEcological: true
  };

  readonly productCategories = [
    'NATURAL_COSMETICS',
    'ECO_FRIENDLY_HOME',
    'SUSTAINABLE_FASHION',
    'KITCHEN_AND_DINING',
    'ECO_GARDENING',
    'ECO_PET_PRODUCTS',
    'ECO_GIFT_SETS'
  ];

  readonly countries = [
    { name: 'Tunisia', flag: '🇹🇳' },
    { name: 'France', flag: '🇫🇷' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Switzerland', flag: '🇨🇭' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Greece', flag: '🇬🇷' },
    { name: 'Turkey', flag: '🇹🇷' },
    { name: 'Morocco', flag: '🇲🇦' },
    { name: 'Algeria', flag: '🇩🇿' },
    { name: 'Egypt', flag: '🇪🇬' },
    { name: 'USA', flag: '🇺🇸' },
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'UK', flag: '🇬🇧' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Norway', flag: '🇳🇴' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Finland', flag: '🇫🇮' },
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Romania', flag: '🇷🇴' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'China', flag: '🇨🇳' },
    { name: 'South Korea', flag: '🇰🇷' },
    { name: 'India', flag: '🇮🇳' },
    { name: 'Thailand', flag: '🇹🇭' },
    { name: 'Vietnam', flag: '🇻🇳' },
    { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Local', flag: '🌍' }
  ];

  constructor(
    private productService: ProductService,
    private notificationService: NotificationService,
    private cloudinaryService: CloudinaryService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  ngOnInit(): void {
    this.loadImageCache();
    this.loadProducts();
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

  formatCategory(cat: string): string {
    return cat.replace(/_/g, ' ');
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
        this.products = data.map(p => ({
          ...p,
          image: p.image && p.image.length > 200 ? null : p.image
        })) as any;
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
    this.productToDelete = id;
  }

  confirmDelete(): void {
    if (this.productToDelete === null) return;
    const id = this.productToDelete;
    this.productToDelete = null;

    this.productService.delete(id).subscribe({
      next: () => {
        this.products = this.products.filter(p => p.id !== id);
        this.notificationService.success('Product deleted.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 204 || err.status === 200) {
          this.products = this.products.filter(p => p.id !== id);
          this.notificationService.success('Product deleted.');
          this.cdr.detectChanges();
        } else {
          this.notificationService.error('Failed to delete product.');
        }
      }
    });
  }

  cancelDelete(): void {
    this.productToDelete = null;
  }

  openProductModal(product?: Product): void {
    this.editingProduct = product ?? null;
    this.selectedImageFile = null;
    this.uploadProgress = 0;

    if (product) {
      this.productForm = {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category as string,
        image: this.productImageCache.get(product.id) ?? product.image ?? '',
        origin: product.origin ?? '',
        isEcological: product.isEcological
      };
      this.imagePreview = this.productForm.image || null;
    } else {
      this.productForm = {
        name: '', description: '', price: 0, stock: 0,
        category: 'NATURAL_COSMETICS', image: '', origin: '', isEcological: true
      };
      this.imagePreview = null;
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

    // Validation de la taille
    if (file.size > 10 * 1024 * 1024) { // 10MB max
      this.notificationService.error('Image must be under 10MB.');
      return;
    }

    // Validation du type
    if (!file.type.startsWith('image/')) {
      this.notificationService.error('Please select a valid image file.');
      return;
    }

    this.selectedImageFile = file;

    // Créer un aperçu local
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  uploadImageToCloudinary(): void {
    if (!this.selectedImageFile) {
      this.notificationService.warning('Please select an image first');
      return;
    }

    this.uploadingImage = true;
    this.uploadProgress = 0;

    console.log('📤 Starting Cloudinary upload...');

    this.cloudinaryService.uploadImageWithTransform(this.selectedImageFile, 800, 800).subscribe({
      next: (response) => {
        console.log('✅ Cloudinary upload SUCCESS:', response);
        this.productForm.image = response.secure_url;
        this.imagePreview = response.secure_url;
        this.uploadingImage = false;
        this.uploadProgress = 100;
        this.notificationService.success('Image uploaded successfully!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Cloudinary upload FAILED:', err);
        this.uploadingImage = false;
        this.uploadProgress = 0;
        this.notificationService.error('Failed to upload image. Please try again.');
        this.cdr.detectChanges();
      }
    });
  }

  removeImage(): void {
    this.productForm.image = '';
    this.imagePreview = null;
    this.selectedImageFile = null;
    this.uploadProgress = 0;
  }

  saveProduct(): void {
    if (!this.productForm.name.trim()) {
      this.notificationService.error('Name is required.');
      return;
    }
    if (!this.productForm.price || this.productForm.price <= 0) {
      this.notificationService.error('Price must be greater than 0.');
      return;
    }

    this.productSaving = true;
    const imageToCache = this.productForm.image;
    const payload: any = { ...this.productForm };

    if (this.editingProduct) {
      payload.id = this.editingProduct.id;
      this.productService.update(payload).subscribe({
        next: (updated) => {
          if (imageToCache) {
            this.productImageCache.set(updated.id, imageToCache);
            this.saveImageCache();
          }
          const idx = this.products.findIndex(p => p.id === updated.id);
          if (idx !== -1) this.products[idx] = updated;
          this.products = [...this.products];
          this.notificationService.success('Product updated.');
          this.closeProductModal();
          this.productSaving = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.notificationService.error('Failed to update product.');
          this.productSaving = false;
        }
      });
    } else {
      this.productService.create(payload).subscribe({
        next: (created) => {
          if (imageToCache) {
            this.productImageCache.set(created.id, imageToCache);
            this.saveImageCache();
          }
          this.products = [created, ...this.products];
          this.notificationService.success('Product created.');
          this.closeProductModal();
          this.productSaving = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.notificationService.error('Failed to create product.');
          this.productSaving = false;
        }
      });
    }
  }
}