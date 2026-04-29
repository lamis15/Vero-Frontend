import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Donation {
  id?: number;
  amount: number;
  type: string;
  message?: string;
  anonymous: boolean;
  transactionId?: string;
  quantity?: string;
  eventId?: number;
  partnerId?: number;
  userId?: number;
  userName?: string;
  donationDate?: string;
  status?: string;
  fraudScore?: number;
}

export interface RecurringDonationRequest {
  amount: number;
  frequency: 'MONTHLY' | 'QUARTERLY';
  eventId: number;
  message?: string;
}

export interface RecurringDonationResponse {
  id: number;
  amount: number;
  frequency: string;
  status: string;
  stripeSubscriptionId: string;
  startDate: string;
  nextPaymentDate: string;
  totalPaymentsDone: number;
  checkoutUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DonationService {

  private get host(): string {
    if (typeof window === 'undefined') return 'localhost';
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' ? 'localhost' : h;
  }

  private get apiUrl(): string {
    return `http://${this.host}:8080/api/donations`;
  }

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('vero_access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  createDonationForEvent(donation: Donation, eventId: number): Observable<Donation> {
    return this.http.post<Donation>(
      `${this.apiUrl}/event/${eventId}`,
      donation,
      { headers: this.getHeaders() }
    );
  }

  createDonationForPartner(donation: Donation, partnerId: number): Observable<Donation> {
    return this.http.post<Donation>(
      `${this.apiUrl}/partner/${partnerId}`,
      donation,
      { headers: this.getHeaders() }
    );
  }

  getAll(): Observable<Donation[]> {
    return this.http.get<Donation[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getMyDonations(userId: number): Observable<Donation[]> {
    return this.http.get<Donation[]>(
      `${this.apiUrl}/user/${userId}`,
      { headers: this.getHeaders() }
    );
  }

  getDonationsByEvent(eventId: number): Observable<Donation[]> {
    return this.http.get<Donation[]>(
      `${this.apiUrl}/event/${eventId}`,
      { headers: this.getHeaders() }
    );
  }

  getTotalByEvent(eventId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/event/${eventId}/total`,
      { headers: this.getHeaders() }
    );
  }

  getTotalByPartner(partnerId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/partner/${partnerId}/total`,
      { headers: this.getHeaders() }
    );
  }

  update(id: number, donation: Partial<Donation>): Observable<Donation> {
    return this.http.put<Donation>(
      `${this.apiUrl}/${id}`,
      donation,
      { headers: this.getHeaders() }
    ).pipe(tap(() => { }));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }

  validate(id: number): Observable<Donation> {
    return this.http.put<Donation>(
      `${this.apiUrl}/${id}/validate`,
      {},
      { headers: this.getHeaders() }
    );
  }

  createStripeCheckout(amount: number, donationId: number): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(
      `http://${this.host}:8080/api/stripe/checkout`,
      { amount, donationId },
      { headers: this.getHeaders() }
    );
  }

  createDonationPaymentIntent(donationId: number, amount: number): Observable<{ clientSecret: string }> {
    return this.http.post<{ clientSecret: string }>(
      `http://${this.host}:8080/api/stripe/donation-payment-intent`,
      { donationId, amount },
      { headers: this.getHeaders() }
    );
  }

  verifyStripePayment(sessionId: string, donationId: number): Observable<any> {
    return this.http.get(
      `http://${this.host}:8080/api/stripe/verify?sessionId=${sessionId}&donationId=${donationId}`,
      { headers: this.getHeaders() }
    );
  }

  // ── Recurring donations ───────────────────────────────────────────

  createRecurringDonation(data: RecurringDonationRequest): Observable<RecurringDonationResponse> {
    return this.http.post<RecurringDonationResponse>(
      `${this.apiUrl}/recurring`,
      data,
      { headers: this.getHeaders() }
    );
  }

  getMyRecurringDonations(): Observable<RecurringDonationResponse[]> {
    return this.http.get<RecurringDonationResponse[]>(
      `${this.apiUrl}/recurring/my`,
      { headers: this.getHeaders() }
    );
  }

  cancelRecurringDonation(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/recurring/${id}`,
      { headers: this.getHeaders() }
    );
  }

  confirmRecurringDonation(id: number, sessionId?: string): Observable<RecurringDonationResponse> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.http.post<RecurringDonationResponse>(
      `${this.apiUrl}/recurring/${id}/confirm${params}`,
      {},
      { headers: this.getHeaders() }
    );
  }
}