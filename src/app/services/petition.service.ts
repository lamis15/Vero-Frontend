import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface Petition {
  id?: number;
  title: string;
  description: string;
  category: string;
  city?: string;
  region?: string;
  targetSignatures: number;
  currentSignatures?: number;
  status?: string;
  imageUrl?: string;
  deadline?: string;
  createdAt?: string;
  adminResponse?: string;
  isOwner?: boolean;
  _hasSigned?: boolean; // Frontend state only
}

export interface PetitionSignature {
  id?: number;
  comment?: string;
  anonymous?: boolean;
  signedAt?: string;
}

export interface PetitionStats {
  total: number;
  pending: number;
  active: number;
  achieved: number;
  rejected: number;
  closed: number;
  totalSignatures: number;
  topPetition?: Petition;
}


@Injectable({ providedIn: 'root' })
export class PetitionService {

  private apiUrl = 'http://localhost:8080/api/petitions';

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('vero_access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    });
  }

  private handleError(error: HttpErrorResponse) {
    let message = 'Unexpected error';
    if (error.error?.message) message = error.error.message;
    else if (error.status === 0) message = 'Server unreachable';
    return throwError(() => new Error(message));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  create(petition: Petition): Observable<Petition> {
    return this.http.post<Petition>(
      this.apiUrl, petition, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ← nom exact utilisé dans le component
  getActive(): Observable<Petition[]> {
    return this.http.get<Petition[]>(
      this.apiUrl, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getById(id: number): Observable<Petition> {
    return this.http.get<Petition>(
      `${this.apiUrl}/${id}`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ← nom exact utilisé dans le component
  getMy(): Observable<Petition[]> {
    return this.http.get<Petition[]>(
      `${this.apiUrl}/my`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  update(id: number, petition: Petition): Observable<Petition> {
    return this.http.put<Petition>(
      `${this.apiUrl}/${id}`, petition, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ── Signatures ────────────────────────────────────────────────────────────

  sign(id: number, comment?: string, anonymous: boolean = false): Observable<PetitionSignature> {
    let url = `${this.apiUrl}/${id}/sign?anonymous=${anonymous}`;
    if (comment) url += `&comment=${encodeURIComponent(comment)}`;
    return this.http.post<PetitionSignature>(
      url, {}, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  unsign(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}/unsign`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getSignatures(id: number): Observable<PetitionSignature[]> {
    return this.http.get<PetitionSignature[]>(
      `${this.apiUrl}/${id}/signatures`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  hasSigned(id: number): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.apiUrl}/${id}/has-signed`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getSignaturesMap(id: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/${id}/signatures/map`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ── Filtres ───────────────────────────────────────────────────────────────

  getByCategory(category: string): Observable<Petition[]> {
    return this.http.get<Petition[]>(
      `${this.apiUrl}/category/${category}`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getByCity(city: string): Observable<Petition[]> {
    return this.http.get<Petition[]>(
      `${this.apiUrl}/city/${city}`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getTop(): Observable<Petition[]> {
    return this.http.get<Petition[]>(
      `${this.apiUrl}/top`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getNearlyAchieved(): Observable<Petition[]> {
    return this.http.get<Petition[]>(
      `${this.apiUrl}/nearly-achieved`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  validate(id: number): Observable<Petition> {
    return this.http.put<Petition>(
      `${this.apiUrl}/${id}/validate`, {}, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  reject(id: number, reason: string): Observable<Petition> {
    return this.http.put<Petition>(
      `${this.apiUrl}/${id}/reject?reason=${encodeURIComponent(reason)}`,
      {}, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  close(id: number): Observable<Petition> {
    return this.http.put<Petition>(
      `${this.apiUrl}/${id}/close`, {}, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ← nom exact utilisé dans le component
  getAll(): Observable<Petition[]> {
    return this.http.get<Petition[]>(
      `${this.apiUrl}/admin/all`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  report(id: number, reason: string, details?: string): Observable<string> {
    let url = `${this.apiUrl}/${id}/report?reason=${reason}`;
    if (details) url += `&details=${encodeURIComponent(details)}`;
    return this.http.post(
      url, {}, { headers: this.getHeaders(), responseType: 'text' }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  // ← nom exact utilisé dans le component
  getStats(): Observable<PetitionStats> {
    return this.http.get<PetitionStats>(
      `${this.apiUrl}/stats`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }
}
