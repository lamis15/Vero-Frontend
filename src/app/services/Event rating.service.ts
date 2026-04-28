import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../environments/environment';

export interface RatingResponse {
  id: number;
  eventId: number;
  eventTitle: string;
  userName: string;
  stars: number;
  comment: string;
  imageUrl?: string;
  ratedAt: string;
  averageStars: number;
  totalRatings: number;
}

export interface RatingRequest {
  stars: number;
  comment: string;
  imageUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class EventRatingService {

  private base = `${environment.apiUrl}/api/ratings`;
  private stompClient: Client | null = null;
  private ratingSubjects = new Map<number, Subject<RatingResponse>>();

  constructor(private http: HttpClient) {}

  submitRating(eventId: number, req: RatingRequest): Observable<RatingResponse> {
    return this.http.post<RatingResponse>(`${this.base}/event/${eventId}`, req);
  }

  getRatings(eventId: number): Observable<RatingResponse[]> {
    return this.http.get<RatingResponse[]>(`${this.base}/event/${eventId}`);
  }

  hasRated(eventId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.base}/event/${eventId}/has-rated`);
  }

  uploadRatingImage(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ url: string }>(`${environment.apiUrl}/api/uploads`, fd);
  }

  subscribeToRatings(eventId: number): Observable<RatingResponse> {
    if (!this.ratingSubjects.has(eventId)) {
      this.ratingSubjects.set(eventId, new Subject<RatingResponse>());
    }
    if (!this.stompClient || !this.stompClient.connected) {
      this.connectStomp();
    }
    return this.ratingSubjects.get(eventId)!.asObservable();
  }

  private connectStomp(): void {
    const wsUrl = `${environment.apiUrl}/ws`;
    this.stompClient = new Client({
      brokerURL: wsUrl.replace('http', 'ws') + '/websocket',
      reconnectDelay: 5000,
      onConnect: () => {
        this.ratingSubjects.forEach((subject, eventId) => {
          this.stompClient!.subscribe(
            `/topic/ratings/${eventId}`,
            (message: IMessage) => {
              const rating: RatingResponse = JSON.parse(message.body);
              subject.next(rating);
            }
          );
        });
      },
      onStompError: (frame) => console.error('STOMP error:', frame)
    });
    this.stompClient.activate();
  }

  disconnectStomp(): void {
    this.stompClient?.deactivate();
    this.ratingSubjects.clear();
  }
}