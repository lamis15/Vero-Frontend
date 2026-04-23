import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Order, OrderStatus } from './product.models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly API = `${environment.apiUrl}/api/commandes`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Order[]> {
    return this.http.get<Order[]>(this.API);
  }

  getById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.API}/${id}`);
  }

  getByUser(userId: number): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.API}/user/${userId}`);
  }

  getByStatus(status: OrderStatus): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.API}/status/${status}`);
  }

  getTotalByUser(userId: number): Observable<number> {
    return this.http.get<number>(`${this.API}/user/${userId}/total`);
  }

  create(order: Order): Observable<Order> {
    return this.http.post<Order>(this.API, order);
  }

  update(order: Order): Observable<Order> {
    return this.http.put<Order>(this.API, order);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  updateStatus(id: number, newStatus: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${this.API}/${id}/status`, null, {
      params: { newStatus }
    });
  }

  addProduct(orderId: number, productId: number): Observable<Order> {
    return this.http.post<Order>(`${this.API}/${orderId}/produits/${productId}`, null);
  }

  removeProduct(orderId: number, productId: number): Observable<Order> {
    return this.http.delete<Order>(`${this.API}/${orderId}/produits/${productId}`);
  }
}
