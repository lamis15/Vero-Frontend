import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AnswerDto, Formation, FormationResource, FormationStatus, QuizResponse, QuizResult } from './formation.models';

@Injectable({ providedIn: 'root' })
export class FormationService {
  private readonly API = `${environment.apiUrl}/api/formations`;

  constructor(private http: HttpClient) {}

  // READ operations
  getAll(): Observable<Formation[]> {
    return this.http.get<Formation[]>(this.API);
  }

  getById(id: number): Observable<Formation> {
    return this.http.get<Formation>(`${this.API}/${id}`);
  }

  getByStatus(status: FormationStatus): Observable<Formation[]> {
    return this.http.get<Formation[]>(`${this.API}/status/${status}`);
  }

  search(keyword: string): Observable<Formation[]> {
    return this.http.get<Formation[]>(`${this.API}/search`, {
      params: { keyword }
    });
  }

  getByMaxDuration(max: number): Observable<Formation[]> {
    return this.http.get<Formation[]>(`${this.API}/duration`, {
      params: { max: max.toString() }
    });
  }

  getByParticipant(userId: number): Observable<Formation[]> {
    return this.http.get<Formation[]>(`${this.API}/participant/${userId}`);
  }

  getAvailable(): Observable<Formation[]> {
    return this.http.get<Formation[]>(`${this.API}/available`);
  }

  // WRITE operations (ADMIN only)
  create(formation: Formation): Observable<Formation> {
    return this.http.post<Formation>(this.API, formation);
  }

  update(formation: Formation): Observable<Formation> {
    return this.http.put<Formation>(`${this.API}/${formation.id}`, formation);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  updateStatus(id: number, status: FormationStatus): Observable<Formation> {
    return this.http.patch<Formation>(`${this.API}/${id}/status`, null, {
      params: { status }
    });
  }

  // Registration
  register(formationId: number, userId: number): Observable<Formation> {
    return this.http.post<Formation>(
      `${this.API}/${formationId}/register`,
      null,
      { params: { userId: userId.toString() } }
    );
  }

  unregister(formationId: number, userId: number): Observable<Formation> {
    return this.http.delete<Formation>(
      `${this.API}/${formationId}/unregister`,
      { params: { userId: userId.toString() } }
    );
  }

  // AI Description Generation
  generateDescription(title: string, duration: number): Observable<{ description: string }> {
    return this.http.post<{ description: string }>(`${this.API}/generate-description`, { title, duration });
  }

  // Pin toggle
  togglePin(id: number): Observable<Formation> {
    return this.http.patch<Formation>(`${this.API}/${id}/pin`, null);
  }

  // Resources
  getResources(formationId: number): Observable<FormationResource[]> {
    return this.http.get<FormationResource[]>(`${this.API}/${formationId}/resources`);
  }

  uploadResource(formationId: number, file: File): Observable<FormationResource> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<FormationResource>(`${this.API}/${formationId}/resources`, formData);
  }

  deleteResource(formationId: number, resourceId: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${formationId}/resources/${resourceId}`);
  }

  getResourceDownloadUrl(formationId: number, resourceId: number): string {
    return `${this.API}/${formationId}/resources/${resourceId}/download`;
  }

  downloadResource(formationId: number, resourceId: number): Observable<Blob> {
    return this.http.get(
      `${this.API}/${formationId}/resources/${resourceId}/download`,
      { responseType: 'blob' }
    );
  }

  // Quiz
  getQuiz(formationId: number): Observable<QuizResponse> {
    return this.http.get<QuizResponse>(`${this.API}/${formationId}/quiz`);
  }

  getQuizPreview(formationId: number): Observable<QuizResponse> {
    return this.http.get<QuizResponse>(`${this.API}/${formationId}/quiz/preview`);
  }

  submitQuiz(formationId: number, answers: AnswerDto[]): Observable<QuizResult> {
    return this.http.post<QuizResult>(`${this.API}/${formationId}/quiz/submit`, { answers });
  }

  downloadCertificate(formationId: number): Observable<Blob> {
    return this.http.get(`${this.API}/${formationId}/quiz/certificate`, { responseType: 'blob' });
  }

  createQuiz(formationId: number, quizRequest: any): Observable<any> {
    return this.http.post<any>(`${this.API}/${formationId}/quiz`, quizRequest);
  }

  generateQuizFromResources(formationId: number, numQuestions: number = 10): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.API}/${formationId}/quiz/generate`,
      null,
      { params: { numQuestions: numQuestions.toString() } }
    );
  }

  // Waitlist
  joinWaitlist(formationId: number, userId: number): Observable<any> {
    return this.http.post<any>(
      `${this.API}/${formationId}/waitlist/join`,
      null,
      { params: { userId: userId.toString() } }
    );
  }

  leaveWaitlist(formationId: number, userId: number): Observable<any> {
    return this.http.delete<any>(
      `${this.API}/${formationId}/waitlist/leave`,
      { params: { userId: userId.toString() } }
    );
  }

  getWaitlistStatus(formationId: number, userId: number): Observable<{ inWaitlist: boolean; position: number }> {
    return this.http.get<{ inWaitlist: boolean; position: number }>(
      `${this.API}/${formationId}/waitlist/status`,
      { params: { userId: userId.toString() } }
    );
  }
}
