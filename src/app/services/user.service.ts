import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  verified: boolean;
  banned: boolean;
  image?: string | null;
}

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

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.API);
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.API}/${id}`);
  }

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.API}/me`);
  }

  updateMe(data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.API}/me`, data);
  }

  changePassword(data: { currentPassword: string; newPassword: string }): Observable<any> {
    return this.http.put(`${this.API}/me/password`, data);
  }

  getUsersByRole(role: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/role/${role}`);
  }

  getEcoProfile(): Observable<EcoProfileResult> {
    return this.http.get<EcoProfileResult>(`${environment.apiUrl}/api/eco/profile/me`);
  }
}
