import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, ReplaySubject, Subject, finalize, of, shareReplay, tap } from 'rxjs';
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
  topic?: 'eco' | 'lifestyle' | 'product' | 'transport' | 'other' | null;
  topicConfidence?: number | null;
  /** Backend: {@code AI} | {@code KEYWORD}; absent for older rows. */
  topicSource?: 'AI' | 'KEYWORD' | string | null;
}

export type TopicCounts = {
  eco: number;
  lifestyle: number;
  product: number;
  transport: number;
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

export interface CallSignalPayload {
  type: 'call-offer' | 'call-answer' | 'ice-candidate' | 'call-end' | 'call-reject';
  fromUserId: number;
  toUserId: number;
  sdp?: RTCSessionDescriptionInit | null;
  candidate?: RTCIceCandidateInit | null;
  videoEnabled?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MessagerieService implements OnDestroy {
  private stompClient: Client | null = null;
  private currentUserId: number | null = null;
  private adminSubscribed = false;
  private callSubscribed = false;
  private readonly wsBaseUrl = environment.apiUrl;

  private incomingMessageSubject = new Subject<DirectMessage>();
  public incomingMessage$ = this.incomingMessageSubject.asObservable();

  private adminIncomingSubject = new Subject<DirectMessage>();
  public adminIncoming$ = this.adminIncomingSubject.asObservable();

  private callSignalSubject = new ReplaySubject<CallSignalPayload>(20);
  public callSignal$ = this.callSignalSubject.asObservable();
  private pendingCallSignals: CallSignalPayload[] = [];
  private globalIncomingRingTimer: ReturnType<typeof setInterval> | null = null;

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
      if (!this.callSubscribed) {
        this.subscribeCallStream(myUserId);
      }
      if (isAdmin && !this.adminSubscribed) {
        this.subscribeAdminStream();
      }
      return;
    }

    const token = this.authService.getToken();
    if (!token) return;

    this.adminSubscribed = false;
    this.callSubscribed = false;
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
      this.subscribeCallStream(myUserId);
      this.flushPendingCallSignals();
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

  private subscribeCallStream(myUserId: number): void {
    this.stompClient?.subscribe(`/topic/calls/${myUserId}`, (message: Message) => {
      const body = JSON.parse(message.body) as CallSignalPayload;
      this.handleGlobalCallSignal(body);
      this.callSignalSubject.next(body);
    });
    this.callSubscribed = true;
  }

  public disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
    this.adminSubscribed = false;
    this.callSubscribed = false;
    this.stopGlobalIncomingRing();
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

  public sendCallSignal(payload: Omit<CallSignalPayload, 'fromUserId'>): void {
    if (this.currentUserId == null) {
      return;
    }
    const signal: CallSignalPayload = {
      ...payload,
      fromUserId: this.currentUserId
    };
    if (!this.stompClient || !this.stompClient.connected) {
      this.pendingCallSignals.push(signal);
      return;
    }
    this.stompClient.publish({
      destination: '/app/calls.signal',
      body: JSON.stringify(signal)
    });
  }

  private flushPendingCallSignals(): void {
    if (!this.stompClient || !this.stompClient.connected || this.pendingCallSignals.length === 0) {
      return;
    }
    const queued = [...this.pendingCallSignals];
    this.pendingCallSignals = [];
    for (const signal of queued) {
      this.stompClient.publish({
        destination: '/app/calls.signal',
        body: JSON.stringify(signal)
      });
    }
  }

  private handleGlobalCallSignal(signal: CallSignalPayload): void {
    if (signal.type === 'call-offer') {
      this.startGlobalIncomingRing();
      return;
    }
    if (signal.type === 'call-answer' || signal.type === 'call-reject' || signal.type === 'call-end') {
      this.stopGlobalIncomingRing();
    }
  }

  private startGlobalIncomingRing(): void {
    if (this.globalIncomingRingTimer) {
      return;
    }
    this.playTone(880, 150, 0.03);
    this.globalIncomingRingTimer = setInterval(() => {
      this.playTone(880, 150, 0.03);
      setTimeout(() => this.playTone(660, 150, 0.03), 190);
    }, 1400);
    setTimeout(() => this.stopGlobalIncomingRing(), 15000);
  }

  public silenceIncomingRing(): void {
    this.stopGlobalIncomingRing();
  }

  private stopGlobalIncomingRing(): void {
    if (this.globalIncomingRingTimer) {
      clearInterval(this.globalIncomingRingTimer);
      this.globalIncomingRingTimer = null;
    }
  }

  private playTone(freq: number, durationMs: number, volume: number): void {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, durationMs);
    } catch {
      // Browser may block autoplay audio until user interaction.
    }
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
