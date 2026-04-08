import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private base = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.base}/events`, { headers: this.headers() });
  }

  create(event: Event): Observable<Event> {
    return this.http.post<Event>(`${this.base}/events`, event, { headers: this.headers() });
  }

  update(id: number, event: Event): Observable<Event> {
    return this.http.put<Event>(`${this.base}/events/${id}`, event, { headers: this.headers() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/events/${id}`, { headers: this.headers() });
  }

  reserve(eventId: number): Observable<any> {
    return this.http.post(`${this.base}/reservations/request/event/${eventId}`, {}, { headers: this.headers() });
  }
}