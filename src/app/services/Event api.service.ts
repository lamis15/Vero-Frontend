import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Event {
  id?: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  capacity: number;
  status?: 'UPCOMING' | 'ONGOING' | 'CANCELLED' | 'COMPLETED';
}

@Injectable({ providedIn: 'root' })
export class EventApiService {

  private base = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // NOTE: The Authorization header is added automatically by authInterceptor.
  // No need to set it manually here.

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

  reserve(eventId: number): Observable<any> {
    return this.http.post(
      `${this.base}/reservations/request/event/${eventId}`,
      {}
    );
  }
}