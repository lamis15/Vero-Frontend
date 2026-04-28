import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ModerationResult {
  decision: 'PENDING' | 'REVIEW' | 'REJECTED';
  score: number;          // 0-100
  label: string;          // 'Écologique' | 'Hors sujet'
  confidence: number;     // 0-1
  processing_time_ms: number;
}

@Injectable({ providedIn: 'root' })
export class EcoModerationService {

  private apiUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  moderate(title: string, description?: string): Observable<ModerationResult | null> {
    const text = description ? `${title} ${description}` : title;
    return this.http.post<ModerationResult>(
      `${this.apiUrl}/moderate`,
      { text },
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(
      catchError(() => of(null))   // if AI server is down, degrade gracefully
    );
  }

  isAvailable(): Observable<boolean> {
    return this.http.get<any>(`${this.apiUrl}/health`).pipe(
      catchError(() => of(false))
    ) as Observable<any>;
  }
}
