import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaymentRequest {
  userId: number;
  items: OrderItem[];
  deliveryAddress: string;
  notes?: string;
}

export interface OrderItem {
  productId: number;
  quantity: number;
}

export interface PaymentResponse {
  clientSecret: string;
  orderId: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = `${environment.apiUrl}/api/payment`;

  constructor(private http: HttpClient) {}

  createPaymentIntent(request: PaymentRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.apiUrl}/create-payment-intent`, request);
  }

  confirmPayment(orderId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/confirm-payment/${orderId}`, {});
  }

  getConfig(): Observable<{ publishableKey: string }> {
    return this.http.get<{ publishableKey: string }>(`${this.apiUrl}/config`);
  }

  createFormationPaymentIntent(formationId: number, userId: number): Observable<{ clientSecret: string }> {
    return this.http.post<{ clientSecret: string }>(`${this.apiUrl}/formation-payment-intent`, { formationId, userId });
  }
}
