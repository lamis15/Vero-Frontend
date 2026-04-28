import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Session, SessionStatus } from './formation.models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly API = `${environment.apiUrl}/api/sessions`;

  constructor(private http: HttpClient) {}

  // READ operations
  getAll(): Observable<Session[]> {
    return this.http.get<Session[]>(this.API);
  }

  getById(id: number): Observable<Session> {
    return this.http.get<Session>(`${this.API}/${id}`);
  }

  getByFormation(formationId: number): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.API}/formation/${formationId}`);
  }

  getByStatus(status: SessionStatus): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.API}/status/${status}`);
  }

  getByTrainer(trainerId: number): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.API}/trainer/${trainerId}`);
  }

  // WRITE operations (ADMIN only)
  create(session: Session, formationId: number): Observable<Session> {
    return this.http.post<Session>(this.API, session, {
      params: { formationId: formationId.toString() }
    });
  }

  update(session: Session): Observable<Session> {
    return this.http.put<Session>(`${this.API}/${session.id}`, session);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  updateStatus(id: number, status: SessionStatus): Observable<Session> {
    return this.http.patch<Session>(`${this.API}/${id}/status`, null, {
      params: { status }
    });
  }

  // FILE UPLOAD operations
  uploadResource(sessionId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.API}/${sessionId}/resources`, formData);
  }

  getResources(sessionId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/${sessionId}/resources`);
  }

  deleteResource(sessionId: number, resourceId: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${sessionId}/resources/${resourceId}`);
  }

  downloadResource(sessionId: number, resourceId: number): Observable<Blob> {
    return this.http.get(`${this.API}/${sessionId}/resources/${resourceId}/download`, {
      responseType: 'blob'
    });
  }
}