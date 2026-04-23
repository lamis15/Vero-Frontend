import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatSession {
  id: number;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: number;
  sender: string;
  content: string;
  createdAt: string;
}

export interface ChatEvent {
  error: boolean;
  errorMessage: string | null;
  sessionId: number;
  userMessage: string | null;
  botReply: string | null;
  intent: string | null;
  confidence: number | null;
  entities: string | null;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly API = `${environment.apiUrl}/api/chatbot`;

  constructor(private http: HttpClient) {}

  createSession(): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.API}/sessions`, {});
  }

  getMySessions(): Observable<ChatSession[]> {
    return this.http.get<ChatSession[]>(`${this.API}/sessions`);
  }

  getSessionMessages(sessionId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.API}/sessions/${sessionId}/messages`);
  }

  sendMessage(sessionId: number, text: string): Observable<ChatEvent> {
    return this.http.post<ChatEvent>(`${this.API}/send`, { sessionId, text });
  }

  deleteSession(sessionId: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/sessions/${sessionId}`);
  }
}
