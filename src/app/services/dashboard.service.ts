import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EcoDashboardDTO } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly API = `${environment.apiUrl}/api/eco`;

  constructor(private http: HttpClient) {}

  /** Single call — returns everything the dashboard needs */
  getDashboard(start?: string, end?: string): Observable<EcoDashboardDTO> {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get<EcoDashboardDTO>(`${this.API}/dashboard`, { params });
  }

  /** Triggers PDF download as blob */
  downloadReport(month?: string): Observable<Blob> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    return this.http.get(`${this.API}/report/pdf`, {
      params,
      responseType: 'blob'
    });
  }
}
