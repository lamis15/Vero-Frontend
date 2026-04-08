import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

@Injectable({
  providedIn: 'root'
})
export class DonationService {

  private apiUrl = 'http://localhost:8080/api/donations';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ── Don à un partenaire ───────────────────────────────────────────────────
  createDonationForPartner(donation: Donation,
                           partnerId: number): Observable<Donation> {
    return this.http.post<Donation>(
      `${this.apiUrl}/partner/${partnerId}`,
      donation,
      { headers: this.getHeaders() }
    );
  }

  // ── Don à un événement ────────────────────────────────────────────────────
  createDonationForEvent(donation: Donation,
                         eventId: number): Observable<Donation> {
    return this.http.post<Donation>(
      `${this.apiUrl}/event/${eventId}`,
      donation,
      { headers: this.getHeaders() }
    );
  }

  // ── Mes dons ──────────────────────────────────────────────────────────────
  getMyDonations(userId: number): Observable<Donation[]> {
    return this.http.get<Donation[]>(
      `${this.apiUrl}/user/${userId}`,
      { headers: this.getHeaders() }
    );
  }

  // ── Dons d'un événement ───────────────────────────────────────────────────
  getDonationsByEvent(eventId: number): Observable<Donation[]> {
    return this.http.get<Donation[]>(
      `${this.apiUrl}/event/${eventId}`,
      { headers: this.getHeaders() }
    );
  }

  // ── Total d'un événement ──────────────────────────────────────────────────
  getTotalByEvent(eventId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/event/${eventId}/total`,
      { headers: this.getHeaders() }
    );
  }

  // ── Total d'un partenaire ─────────────────────────────────────────────────
  getTotalByPartner(partnerId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/partner/${partnerId}/total`,
      { headers: this.getHeaders() }
    );
  }
}