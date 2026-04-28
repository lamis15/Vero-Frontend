import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReservationScoreDTO } from '../models/reservation-score.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ScoringService {

  private readonly base = `${environment.apiUrl}/api/reservations/scoring`;

  constructor(private http: HttpClient) { }

  /** Toutes les PENDING avec scores — triées par score décroissant */
  getScoredPending(): Observable<ReservationScoreDTO[]> {
    return this.http.get<ReservationScoreDTO[]>(`${this.base}/pending`);
  }

  /** PENDING d'un événement précis avec scores */
  getScoredPendingByEvent(eventId: number): Observable<ReservationScoreDTO[]> {
    return this.http.get<ReservationScoreDTO[]>(`${this.base}/pending/event/${eventId}`);
  }
}