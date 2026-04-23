import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CarbonActivity } from './carbon.models';

@Injectable({ providedIn: 'root' })
export class CarbonActivityService {
  private readonly API = `${environment.apiUrl}/api/eco/activities`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<CarbonActivity[]> {
    return this.http.get<CarbonActivity[]>(this.API);
  }

  getById(id: number): Observable<CarbonActivity> {
    return this.http.get<CarbonActivity>(`${this.API}/${id}`);
  }

  create(activity: Partial<CarbonActivity>): Observable<CarbonActivity> {
    return this.http.post<CarbonActivity>(this.API, activity);
  }

  update(id: number, activity: Partial<CarbonActivity>): Observable<CarbonActivity> {
    return this.http.put<CarbonActivity>(`${this.API}/${id}`, activity);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  getByType(type: string): Observable<CarbonActivity[]> {
    return this.http.get<CarbonActivity[]>(`${this.API}/type/${type}`);
  }

  getByPeriod(start: string, end: string): Observable<CarbonActivity[]> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<CarbonActivity[]>(`${this.API}/period`, { params });
  }

  getTotal(start: string, end: string): Observable<number> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<number>(`${this.API}/total/carbon`, { params });
  }

  getAllImpactTotals(start: string, end: string): Observable<Record<string, number>> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<Record<string, number>>(`${this.API}/total/all`, { params });
  }

  getCarbonByType(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.API}/by-type`);
  }

  scanReceipt(file: File): Observable<CarbonActivity> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<CarbonActivity>(`${environment.apiUrl}/api/eco/scan`, formData);
  }
}
