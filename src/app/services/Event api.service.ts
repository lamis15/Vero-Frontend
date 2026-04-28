import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Event {
  createdBy: any;
  id?: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  capacity: number;
  status?: 'UPCOMING' | 'ONGOING' | 'CANCELLED' | 'COMPLETED';
  reservedPlaces?: number;
}

export interface Reservation {
  id: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';
  reservedAt: string;   // ← corrigé (le backend envoie reservedAt, pas createdAt)
  createdAt?: string;   // ← gardé en optionnel pour compatibilité
  event: Event;
}

@Injectable({ providedIn: 'root' })
export class EventApiService {

  private base = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // ── Events ──────────────────────────────────────────────────────────────────
  getAll(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.base}/events`);
  }

  create(event: Event): Observable<Event> {
    return this.http.post<Event>(`${this.base}/events`, event);
  }

  update(id: number, event: Event): Observable<Event> {
    return this.http.put<Event>(`${this.base}/events/${id}`, event);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/events/${id}`);
  }

  cancel(id: number): Observable<Event> {
    return this.http.put<Event>(`${this.base}/events/${id}/cancel`, {});
  }

  // ── Reservations ─────────────────────────────────────────────────────────
  reserve(eventId: number): Observable<Reservation> {
    return this.http.post<Reservation>(
      `${this.base}/reservations/request/event/${eventId}`,
      {}
    );
  }

  // ← PLUS de shareReplay/cache : on fetch toujours les données fraîches
  getMyReservations(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.base}/reservations/my`);
  }

  cancelReservation(reservationId: number): Observable<void> {
    return this.http.put<void>(`${this.base}/reservations/${reservationId}/cancel`, {});
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/uploads`, fd);
  }
}