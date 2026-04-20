import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CarbonTipService {
  private readonly API = `${environment.apiUrl}/api/eco/tips`;

  constructor(private http: HttpClient) {}

  getRecommended(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API}/recommended`);
  }
}
