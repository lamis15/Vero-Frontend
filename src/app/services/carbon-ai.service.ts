import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CarbonActivity } from './carbon.models';

@Injectable({ providedIn: 'root' })
export class CarbonAIService {
  private readonly API = `${environment.apiUrl}/api/eco/ai`;

  constructor(private http: HttpClient) {}

  analyze(text: string): Observable<CarbonActivity> {
    return this.http.post<CarbonActivity>(`${this.API}/analyze`, { text });
  }
}
