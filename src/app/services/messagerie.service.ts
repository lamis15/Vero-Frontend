import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, finalize, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService, UserResponse } from './auth.service';

export interface ChatParticipant {
  id: number;
  fullName: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'PARTNER';
}

export interface DirectMessage {
  id?: number;
  sender: ChatParticipant;
  receiver: ChatParticipant;
  content: string;
  timestamp: string;
  isRead: boolean;
  topic?: 'eco' | 'lifestyle' | 'product' | 'other' | null;
  topicConfidence?: number | null;
}

export type TopicCounts = {
  eco: number;
  lifestyle: number;
  product: number;
  other: number;
};

export interface ConversationSummary {
  conversationKey: string;
  userA: ChatParticipant;
  userB: ChatParticipant;
  otherUser?: ChatParticipant;
  lastMessagePreview: string;
  lastMessageTime: string;
  lastMessageSenderId: number;
  messageCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class MessagerieService implements OnDestroy {
  private stompClient: Client | null = null;
  private currentUserId: number | null = null;
  private adminSubscribed = false;
  private readonly wsBaseUrl = environment.apiUrl;

  private incomingMessageSubject = new Subject<DirectMessage>();
  public incomingMessage$ = this.incomingMessageSubject.asObservable();

  private adminIncomingSubject = new Subject<DirectMessage>();
  public adminIncoming$ = this.adminIncomingSubject.asObservable();

  private usersCacheSubject = new BehaviorSubject<UserResponse[] | null>(null);
  private usersInFlight$: Observable<UserResponse[]> | null = null;

  private apiUrl = `${environment.apiUrl}/api/messages`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  public connect(myUserId: number, isAdmin = false): void {
    this.currentUserId = myUserId;

    if (this.stompClient && this.stompClient.active) {
      if (isAdmin && !this.adminSubscribed) {
        this.subscribeAdminStream();
      }
      return;
    }

    const token = this.authService.getToken();
    if (!token) return;

    this.adminSubscribed = false;
    const wsUrl = this.wsBaseUrl ? `${this.wsBaseUrl.replace(/\/$/, '')}/ws` : `${typeof window !== 'undefined' ? window.location.origin : ''}/ws`;
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    this.stompClient.onConnect = () => {
      this.subscribeUserStream(myUserId);
      if (isAdmin) {
        this.subscribeAdminStream();
      }
    };

    this.stompClient.activate();
  }

  private subscribeUserStream(myUserId: number): void {
    this.stompClient?.subscribe(`/topic/messages/${myUserId}`, (message: Message) => {
      const body = JSON.parse(message.body) as DirectMessage;
      this.incomingMessageSubject.next(body);
    });
  }

  private subscribeAdminStream(): void {
    this.stompClient?.subscribe('/topic/admin/messages', (message: Message) => {
      const body = JSON.parse(message.body) as DirectMessage;
      this.adminIncomingSubject.next(body);
    });
    this.adminSubscribed = true;
  }

  public disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
    this.adminSubscribed = false;
    this.currentUserId = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  public loadHistory(otherUserId: number): Observable<DirectMessage[]> {
    return this.http.get<DirectMessage[]>(`${this.apiUrl}/history/${otherUserId}`);
  }

  public loadConversations(): Observable<ConversationSummary[]> {
    return this.http.get<ConversationSummary[]>(`${this.apiUrl}/conversations`);
  }

  public preloadConversations(): void {
    this.loadConversations().subscribe({
      error: () => {
        // Ignore preload failures; component load will handle error state.
      }
    });
  }

  public loadPublicUsers(): Observable<UserResponse[]> {
    const cached = this.usersCacheSubject.value;
    if (cached) {
      return of(cached);
    }
    if (this.usersInFlight$) {
      return this.usersInFlight$;
    }

    const request$ = this.http.get<UserResponse[]>(`${environment.apiUrl}/api/users/public`).pipe(
      tap((users) => this.usersCacheSubject.next(users)),
      finalize(() => {
        this.usersInFlight$ = null;
      }),
      shareReplay(1)
    );
    this.usersInFlight$ = request$;
    return request$;
  }

  public preloadUsers(): void {
    this.loadPublicUsers().subscribe({
      error: () => {
        // Ignore preload failures; component load will handle error state.
      }
    });
  }

  public preloadHistory(otherUserId: number): void {
    this.loadHistory(otherUserId).subscribe({
      error: () => {
        // Ignore preload failures; opening conversation will surface errors.
      }
    });
  }

  public loadAdminConversations(search = ''): Observable<ConversationSummary[]> {
    let params = new HttpParams();
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<ConversationSummary[]>(`${this.apiUrl}/admin/conversations`, { params });
  }

  public loadAdminHistory(userAId: number, userBId: number): Observable<DirectMessage[]> {
    return this.http.get<DirectMessage[]>(`${this.apiUrl}/admin/history/${userAId}/${userBId}`);
  }

  // Back-compat alias used by existing admin view.
  public loadAdminHistoryCached(userAId: number, userBId: number): Observable<DirectMessage[]> {
    return this.loadAdminHistory(userAId, userBId);
  }

  public preloadAdminHistory(userAId: number, userBId: number): void {
    this.loadAdminHistory(userAId, userBId).subscribe({
      error: () => {
        // Ignore preload failures; view opening will handle errors.
      }
    });
  }

  // Persists the message via REST. Backend also broadcasts it on the sender/receiver
  // topics, so the UI picks it up through incomingMessage$ — do NOT push here.
  public sendMessage(receiverId: number, content: string): Observable<DirectMessage> {
    return this.http.post<DirectMessage>(`${this.apiUrl}/send`, { receiverId, content });
  }

  /** My own topic breakdown — powers the eco badge on the profile. */
  public loadMyEcoStats(): Observable<TopicCounts> {
    return this.http.get<TopicCounts>(`${this.apiUrl}/eco-stats/me`);
  }

  /** Platform-wide topic distribution — for the admin heatmap widget. */
  public loadTopicHeatmap(): Observable<TopicCounts> {
    return this.http.get<TopicCounts>(`${this.apiUrl}/topic-heatmap`);
  }
}
