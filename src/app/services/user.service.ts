import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserResponse } from './auth.service';

export interface EcoProfileResult {
  profile: string;
  transportKg: number;
  foodKg: number;
  energyKwh: number;
  wasteKg: number;
  postsCount: number;
  goalsAchieved: number;
  reportsCount: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API = `${environment.apiUrl}/api/users`;

  constructor(private http: HttpClient) {}

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.API}/me`);
  }

  updateMe(payload: { fullName: string; email: string; image?: string }): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.API}/me`, payload);
  }

  changePassword(payload: { currentPassword: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.API}/me/password`, payload);
  }

  getEcoProfile(): Observable<EcoProfileResult> {
    return this.http.get<EcoProfileResult>(`${environment.apiUrl}/api/eco/profile/me`);
  }
}
