import { Injectable, NgZone } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatEvent } from './chatbot.service';

/**
 * STOMP over SockJS to match Spring {@code WebSocketConfig}:
 * endpoint {@code /ws}, app prefix {@code /app}, broker {@code /topic}.
 * SockJS is loaded dynamically; CONNECT headers must include {@code Authorization: Bearer <jwt>}.
 */
@Injectable({ providedIn: 'root' })
export class ChatbotStompService {
  private client: Client | null = null;
  private topicSubscription: StompSubscription | null = null;
  private userOnConnected: (() => void) | null = null;
  private userOnError: ((message: string) => void) | null = null;

  constructor(
    private auth: AuthService,
    private ngZone: NgZone
  ) {}

  get connected(): boolean {
    return this.client?.connected === true;
  }

  /** SockJS endpoint: full URL if {@code environment.apiUrl} is set, else same origin (dev + proxy). */
  private sockJsUrl(): string {
    const base = environment.apiUrl?.trim() ?? '';
    if (base) {
      return `${base.replace(/\/$/, '')}/ws`;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/ws`;
    }
    return '/ws';
  }

  connect(onConnected: () => void, onError: (message: string) => void): void {
    void this.doConnect(onConnected, onError);
  }

  private async doConnect(onConnected: () => void, onError: (message: string) => void): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      this.ngZone.run(() => onError('Not authenticated.'));
      return;
    }

    this.userOnConnected = onConnected;
    this.userOnError = onError;

    if (this.client?.connected) {
      this.ngZone.run(() => onConnected());
      return;
    }

    try {
      if (this.client) {
        try {
          await this.client.deactivate();
        } catch {
          /* ignore */
        }
        this.client = null;
      }

      const { default: SockJS } = await import('sockjs-client');
      const t = this.auth.getToken();
      if (!t) {
        this.ngZone.run(() => onError('Not authenticated.'));
        return;
      }

      const url = this.sockJsUrl();
      this.client = new Client({
        webSocketFactory: () => new SockJS(url) as unknown as WebSocket,
        connectHeaders: {
          Authorization: `Bearer ${t}`
        },
        reconnectDelay: 5000,
        connectionTimeout: 15000,
        onConnect: () => this.ngZone.run(() => this.userOnConnected?.()),
        onStompError: (frame) =>
          this.ngZone.run(() =>
            this.userOnError?.(frame.headers['message'] || frame.body || 'Messaging connection error.')
          ),
        onWebSocketError: () =>
          this.ngZone.run(() =>
            this.userOnError?.(
              `Cannot open WebSocket (${url}). Start Spring on 9090, use ng serve with proxy (angular.json proxyConfig), or set environment.apiUrl to the backend.`
            )
          )
      });

      this.client.activate();
    } catch (e) {
      this.ngZone.run(() =>
        onError(e instanceof Error ? e.message : 'Could not start real-time chat connection.')
      );
    }
  }

  subscribeToSession(sessionId: number, handler: (ev: ChatEvent) => void): void {
    this.unsubscribeTopic();
    if (!this.client?.connected) {
      return;
    }
    this.topicSubscription = this.client.subscribe(`/topic/chat/${sessionId}`, (message: IMessage) => {
      try {
        const ev = JSON.parse(message.body) as ChatEvent;
        this.ngZone.run(() => handler(ev));
      } catch {
        this.ngZone.run(() =>
          handler({
            error: true,
            errorMessage: 'Invalid message from server.',
            sessionId,
            userMessage: null,
            botReply: null,
            intent: null,
            confidence: null,
            entities: null
          })
        );
      }
    });
  }

  unsubscribeTopic(): void {
    this.topicSubscription?.unsubscribe();
    this.topicSubscription = null;
  }

  sendChat(sessionId: number, text: string): boolean {
    if (!this.client?.connected) {
      return false;
    }
    this.client.publish({
      destination: '/app/chat/send',
      body: JSON.stringify({ sessionId, text })
    });
    return true;
  }

  disconnect(): void {
    this.unsubscribeTopic();
    this.userOnConnected = null;
    this.userOnError = null;
    void this.client?.deactivate();
    this.client = null;
  }

  reconnect(onConnected: () => void, onError: (message: string) => void): void {
    this.disconnect();
    this.connect(onConnected, onError);
  }
}
