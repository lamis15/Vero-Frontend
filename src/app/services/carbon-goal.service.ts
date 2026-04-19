import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CarbonGoal } from './carbon.models';

@Injectable({ providedIn: 'root' })
export class CarbonGoalService {
  private readonly API = `${environment.apiUrl}/api/eco/goals`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<CarbonGoal[]> {
    return this.http.get<CarbonGoal[]>(this.API);
  }

  getById(id: number): Observable<CarbonGoal> {
    return this.http.get<CarbonGoal>(`${this.API}/${id}`);
  }

  create(goal: Partial<CarbonGoal>): Observable<CarbonGoal> {
    return this.http.post<CarbonGoal>(this.API, goal);
  }

  update(id: number, goal: Partial<CarbonGoal>): Observable<CarbonGoal> {
    return this.http.put<CarbonGoal>(`${this.API}/${id}`, goal);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  getActive(): Observable<CarbonGoal[]> {
    return this.http.get<CarbonGoal[]>(`${this.API}/active`);
  }

  getAchieved(): Observable<CarbonGoal[]> {
    return this.http.get<CarbonGoal[]>(`${this.API}/achieved`);
  }
}
