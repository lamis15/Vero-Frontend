import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/api/auth`;
  private tokenKey = 'vero_jwt_token';

  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient) {}

  get isLoggedIn$(): Observable<boolean> {
    return this.loggedIn$.asObservable();
  }

  get isLoggedIn(): boolean {
    return this.hasToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get currentUserEmail(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub; // Spring Boot JWT sets subject to email
    } catch { return null; }
  }
get currentUserRole(): string | null {
  const token = this.getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch { return null; }
}

get isAdmin(): boolean {
  return this.currentUserRole === 'ADMIN';
}
  login(email: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.API}/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem(this.tokenKey, res.token);
        this.loggedIn$.next(true);
      })
    );
  }

  register(user: { firstName: string; lastName: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API}/register`, user, { responseType: 'text' });
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.loggedIn$.next(false);
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}
