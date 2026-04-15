import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'PARTNER' | 'USER';
  verified: boolean;
  banned: boolean;
  image: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API   = `${environment.apiUrl}/api/auth`;
  private readonly USERS = `${environment.apiUrl}/api/users`;
  private tokenKey = 'vero_jwt_token';
  private roleKey  = 'vero_user_role';

  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  /** Reactive stream of the current user role (null = unknown / guest) */
  private role$ = new BehaviorSubject<string | null>(localStorage.getItem(this.roleKey));

  constructor(private http: HttpClient) {}

  // ─── Auth state ─────────────────────────────────────────────────────────────
  get isLoggedIn(): boolean              { return this.hasToken(); }
  get isLoggedIn$(): Observable<boolean> { return this.loggedIn$.asObservable(); }
  get roleStream$(): Observable<string | null> { return this.role$.asObservable(); }

  // ─── Token helpers ──────────────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private getDecodedToken(): any {
    const token = this.getToken();
    if (!token) return null;
    try   { return JSON.parse(atob(token.split('.')[1])); }
    catch { return null; }
  }

  // ─── User info ──────────────────────────────────────────────────────────────
  get currentUserEmail(): string | null {
    return this.getDecodedToken()?.sub ?? null;
  }

  /**
   * The backend JWT does NOT include the role field.
   * Role is stored separately in localStorage after being fetched from /api/users.
   * We also check the BehaviorSubject value for reactivity.
   */
  get currentUserRole(): string | null {
    return (
      this.role$.value                      // reactive (just fetched)
      ?? localStorage.getItem(this.roleKey) // persisted (page refresh)
      ?? this.getDecodedToken()?.role       // fallback if backend adds it later
      ?? null
    );
  }

  get isAdmin():         boolean { return this.currentUserRole === 'ADMIN'; }
  get isPartner():       boolean { return this.currentUserRole === 'PARTNER'; }
  get canManageEvents(): boolean { return this.isAdmin || this.isPartner; }

  // ─── Login ──────────────────────────────────────────────────────────────────
  login(email: string, password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(`${this.API}/login`, { email, password })
      .pipe(
        tap(res => {
          localStorage.setItem(this.tokenKey, res.token);
          this.loggedIn$.next(true);
          // JWT has no role → fetch it from /api/users
          this.fetchAndStoreRole(res.token, email);
        })
      );
  }

  // ─── Fetch & cache role ─────────────────────────────────────────────────────
  fetchAndStoreRole(token: string, email: string): void {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get<UserProfile[]>(this.USERS, { headers }).subscribe({
      next: users => {
        const me = users.find(u => u.email === email);
        if (me?.role) {
          localStorage.setItem(this.roleKey, me.role);
          this.role$.next(me.role);        // ← notify components immediately
        }
      },
      error: () => {
        // /api/users not accessible → clear cached role
        localStorage.removeItem(this.roleKey);
        this.role$.next(null);
      }
    });
  }

  /**
   * Called on app start (app.ts ngOnInit).
   * If a JWT already exists but the role is not cached, re-fetch it.
   */
  restoreSession(): void {
    const token = this.getToken();
    const email = this.currentUserEmail;
    const cached = localStorage.getItem(this.roleKey);

    if (cached) {
      this.role$.next(cached);   // push cached role to the stream
      return;
    }

    if (token && email) {
      this.fetchAndStoreRole(token, email);
    }
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.roleKey);
    this.role$.next(null);
    this.loggedIn$.next(false);
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}