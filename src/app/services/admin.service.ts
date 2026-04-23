import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserResponse } from './auth.service';

export interface AdminCreateUserRequest {
  fullName: string;
  email: string;
  password?: string;
  image?: string;
  role: 'USER' | 'ADMIN' | 'PARTNER';
  verified: boolean;
  banned: boolean;
}

export interface AdminUpdateUserRequest {
  fullName?: string;
  email?: string;
  image?: string;
  role?: 'USER' | 'ADMIN' | 'PARTNER';
  verified?: boolean;
  banned?: boolean;
}

export interface AdminUserListItem {
  id: number;
  fullName: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'PARTNER';
  verified: boolean;
  banned: boolean;
  createdAt: string;
  image?: string | null;
}

export interface PagedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly API = `${environment.apiUrl}/api/users`;

  constructor(private http: HttpClient) { }

  getUsers(page = 0, size = 10, search = '', role = ''): Observable<PagedResponse<AdminUserListItem>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (role) {
      params = params.set('role', role);
    }

    return this.http.get<PagedResponse<AdminUserListItem>>(this.API, { params });
  }

  createUser(request: AdminCreateUserRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(this.API, request);
  }

  updateUser(id: number, request: AdminUpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.API}/${id}`, request);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  banUser(id: number): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.API}/${id}/ban`, {});
  }

  unbanUser(id: number): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.API}/${id}/unban`, {});
  }
}
