import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

  constructor(private http: HttpClient) {}

  // 🔐 Headers sécurisés
  private getHeaders(): HttpHeaders {
const token = localStorage.getItem('vero_jwt_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    });
  }

  // 🔥 Gestion erreurs globale
  private handleError(error: HttpErrorResponse) {
    let message = 'Unexpected error';

    if (error.error?.message) {
      message = error.error.message;
    } else if (error.status === 0) {
      message = 'Server unreachable';
    }

    return throwError(() => new Error(message));
  }

  // ── CRUD ─────────────────────────────────────────────
  create(petition: Petition): Observable<Petition> {
    return this.http.post<Petition>(this.apiUrl, petition, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getActive(): Observable<Petition[]> {
    return this.http.get<Petition[]>(this.apiUrl, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getById(id: number): Observable<Petition> {
    return this.http.get<Petition>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getMy(): Observable<Petition[]> {
    return this.http.get<Petition[]>(`${this.apiUrl}/my`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  update(id: number, petition: Petition): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}`, petition, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ── Signatures ───────────────────────────────────────
  sign(id: number, comment?: string, anonymous: boolean = false): Observable<PetitionSignature> {
    let url = `${this.apiUrl}/${id}/sign?anonymous=${anonymous}`;
    if (comment) url += `&comment=${encodeURIComponent(comment)}`;

    return this.http.post<PetitionSignature>(url, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  unsign(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/unsign`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getSignatures(id: number): Observable<PetitionSignature[]> {
    return this.http.get<PetitionSignature[]>(`${this.apiUrl}/${id}/signatures`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  hasSigned(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${id}/has-signed`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ── Filtres ─────────────────────────────────────────
  getByCategory(category: string): Observable<Petition[]> {
    return this.http.get<Petition[]>(`${this.apiUrl}/category/${category}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getByCity(city: string): Observable<Petition[]> {
    return this.http.get<Petition[]>(`${this.apiUrl}/city/${city}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTop(): Observable<Petition[]> {
    return this.http.get<Petition[]>(`${this.apiUrl}/top`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getNearlyAchieved(): Observable<Petition[]> {
    return this.http.get<Petition[]>(`${this.apiUrl}/nearly-achieved`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ── Admin ───────────────────────────────────────────
  validate(id: number): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}/validate`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  reject(id: number, reason: string): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}/reject?reason=${encodeURIComponent(reason)}`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  close(id: number): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}/close`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getAll(): Observable<Petition[]> {
    return this.http.get<Petition[]>(`${this.apiUrl}/admin/all`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ── Reports ─────────────────────────────────────────
  report(id: number, reason: string, details?: string): Observable<string> {
    let url = `${this.apiUrl}/${id}/report?reason=${reason}`;
    if (details) url += `&details=${encodeURIComponent(details)}`;

    return this.http.post(url, {}, {
      headers: this.getHeaders(),
      responseType: 'text'
    }).pipe(catchError(this.handleError));
  }

  // ── Stats ───────────────────────────────────────────
  getStats(): Observable<PetitionStats> {
    return this.http.get<PetitionStats>(`${this.apiUrl}/stats`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }
}