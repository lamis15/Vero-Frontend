import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
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
  createdAt: string;
  event: Event;
}

@Injectable({ providedIn: 'root' })
export class EventApiService {

  private base = `${environment.apiUrl}/api`;
  private myReservationsCache$?: Observable<Reservation[]>;

  constructor(private http: HttpClient) {}

  // NOTE: The Authorization header is added automatically by authInterceptor.
  // No need to set it manually here.

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
    ).pipe(
      tap(() => this.clearReservationsCache())
    );
  }

  getMyReservations(forceRefresh = false): Observable<Reservation[]> {
    if (!this.myReservationsCache$ || forceRefresh) {
      this.myReservationsCache$ = this.http.get<Reservation[]>(`${this.base}/reservations/my`).pipe(
        shareReplay(1)
      );
    }
    return this.myReservationsCache$;
  }

  cancelReservation(reservationId: number): Observable<void> {
    // Using PUT .../cancel — the standard Spring Boot soft-cancel pattern.
    // If your backend uses DELETE instead, change this to http.delete<void>(...)
    return this.http.put<void>(`${this.base}/reservations/${reservationId}/cancel`, {}).pipe(
      tap(() => this.clearReservationsCache())
    );
  }

  clearReservationsCache(): void {
    this.myReservationsCache$ = undefined;
  }

 uploadImage(file: File): Observable<{ url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return this.http.post<{ url: string }>(`${this.base}/uploads`, fd);
}
}