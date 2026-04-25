import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserResponse {
  id: number;
  fullName: string;
  email: string;
  role: string;
  verified: boolean;
  banned: boolean;
  image?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface PasskeyRegisterOptionsResponse {
  challenge: string;
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  displayName: string;
}

export interface PasskeyLoginOptionsResponse {
  challenge: string;
  rpId: string;
  allowCredentialIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly API = `${environment.apiUrl}/api/auth`;

  private tokenKey = 'vero_access_token';
  private refreshTokenKey = 'vero_refresh_token';
  private roleKey = 'vero_user_role';
  private userKey = 'vero_user';

  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  private role$ = new BehaviorSubject<string | null>(this.readRole());

  constructor(private http: HttpClient) {}

  get isLoggedIn(): boolean {
    return this.hasToken();
  }

  get isLoggedIn$(): Observable<boolean> {
    return this.loggedIn$.asObservable();
  }

  get roleStream$(): Observable<string | null> {
    return this.role$.asObservable();
  }

  get currentUser(): UserResponse | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }

  get currentUserRole(): string | null {
    return this.currentUser?.role || this.readRole();
  }

  get currentUserEmail(): string | null {
    return this.currentUser?.email || this.getTokenPayload()?.sub || null;
  }

  get isAdmin(): boolean {
    return this.currentUserRole === 'ADMIN';
  }

  get isPartner(): boolean {
    return this.currentUserRole === 'PARTNER';
  }

  get canManageEvents(): boolean {
    return this.isAdmin || this.isPartner;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private getTokenPayload(): any | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  private readRole(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, { email, password })
      .pipe(tap(res => this.applyAuthResponse(res)));
  }

  register(user: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, user)
      .pipe(tap(res => this.applyAuthResponse(res)));
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.API}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post(`${this.API}/reset-password`, { token, newPassword });
  }

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.API}/me`).pipe(
      tap(user => localStorage.setItem(this.userKey, JSON.stringify(user))),
      catchError(() => {
        const cached = this.currentUser;
        if (cached) return of(cached);
        return throwError(() => new Error('Not authenticated'));
      })
    );
  }

  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.API}/me`);
  }

  passkeyRegisterOptions(email: string) {
    return this.http.post<PasskeyRegisterOptionsResponse>(`${this.API}/passkey/register/options`, { email });
  }

  passkeyRegisterVerify(email: string, credentialId: string, challenge: string) {
    return this.http.post(`${this.API}/passkey/register/verify`, { email, credentialId, challenge });
  }

  passkeyLoginOptions(email: string) {
    return this.http.post<PasskeyLoginOptionsResponse>(`${this.API}/passkey/login/options`, { email });
  }

  passkeyLoginVerify(email: string, credentialId: string, challenge: string) {
    return this.http.post<AuthResponse>(`${this.API}/passkey/login/verify`, { email, credentialId, challenge })
      .pipe(tap(res => this.applyAuthResponse(res)));
  }

  applySocialSession(params: URLSearchParams): boolean {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const email = params.get('email');
    const fullName = params.get('fullName');
    const role = params.get('role');

    if (!accessToken || !refreshToken || !email || !fullName || !role) return false;

    const user: UserResponse = { id: 0, fullName, email, role, verified: true, banned: false, image: null };
    this.storeSession(accessToken, refreshToken, user);
    return true;
  }

  getSocialAuthUrl(provider: 'google' | 'github' | 'facebook'): string {
    return `${environment.apiUrl}/oauth2/authorization/${provider}`;
  }

  private applyAuthResponse(res: AuthResponse): void {
    this.storeSession(res.accessToken, res.refreshToken, res.user);
  }

  private storeSession(accessToken: string, refreshToken: string, user: UserResponse): void {
    localStorage.setItem(this.tokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
    localStorage.setItem(this.roleKey, user.role);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.loggedIn$.next(true);
    this.role$.next(user.role);
  }

  restoreSession(): void {
    this.loggedIn$.next(this.hasToken());
    this.role$.next(this.readRole());
  }

  logout(): Observable<any> {
    return this.http.post<any>(`${this.API}/logout`, {}).pipe(
      tap(() => {
        this.clearUserData();
        this.loggedIn$.next(false);
        this.role$.next(null);
      })
    );
  }

  logoutLocal(): void {
    this.clearUserData();
    this.loggedIn$.next(false);
    this.role$.next(null);
  }

  private clearUserData(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('vero_cart');
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}
