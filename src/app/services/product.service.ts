import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product, ProductCategory } from './product.models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly API = `${environment.apiUrl}/api/produits`;

  constructor(private http: HttpClient) {}

  // READ operations (accessible to all authenticated users)
  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.API);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.API}/${id}`);
  }

  getByCategory(category: ProductCategory): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/category/${category}`);
  }

  getEcological(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/ecological`);
  }

  search(keyword: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/search`, {
      params: { keyword }
    });
  }

  getByPriceRange(min: number, max: number): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/price`, {
      params: { min: min.toString(), max: max.toString() }
    });
  }

  getOutOfStock(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/out-of-stock`);
  }

  // WRITE operations (ADMIN only)
  create(product: Product): Observable<Product> {
    return this.http.post<Product>(this.API, product);
  }

  update(product: Product): Observable<Product> {
    return this.http.put<Product>(this.API, product);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  updateStock(id: number, quantity: number): Observable<Product> {
    return this.http.patch<Product>(`${this.API}/${id}/stock`, null, {
      params: { quantity: quantity.toString() }
    });
  }

  // Debug method to check products with images
  getDebugImages(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API}/debug/images`);
  }
}
