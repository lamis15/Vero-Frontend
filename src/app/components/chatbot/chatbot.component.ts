import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatEvent, ChatMessage, ChatSession } from '../../services/chatbot.service';
import { ChatbotStompService } from '../../services/chatbot-stomp.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotComponent implements OnInit, OnDestroy {
  sessions: ChatSession[] = [];
  activeSessionId: number | null = null;
  messages: ChatMessage[] = [];
  messageText = '';
  error = '';
  loading = false;
  /** STOMP / SockJS connected to backend /ws */
  wsConnected = false;
  thinking = false;

  constructor(
    private chatbotService: ChatbotService,
    private stomp: ChatbotStompService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.bindStomp();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this.stomp.disconnect();
    this.wsConnected = false;
  }

  /** STOMP over SockJS to {@code /ws}; required for sending chat (no HTTP send fallback). */
  private bindStomp(): void {
    this.stomp.connect(
      () => {
        this.wsConnected = true;
        this.error = '';
        this.bindTopicIfNeeded();
        this.cdr.markForCheck();
      },
      (msg) => {
        this.wsConnected = false;
        this.error = msg;
        this.cdr.markForCheck();
      }
    );
  }

  reconnectWebSocket(): void {
    this.stomp.reconnect(
      () => {
        this.wsConnected = true;
        this.error = '';
        this.bindTopicIfNeeded();
        this.cdr.markForCheck();
      },
      (msg) => {
        this.wsConnected = false;
        this.error = msg;
        this.cdr.markForCheck();
      }
    );
  }

  private chatHttpError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401 || err.status === 403) {
        return 'Not authorized for chat. Log out and log in again (your session may be missing or expired).';
      }
      if (err.status === 0) {
        return `Cannot reach the API at ${environment.apiUrl}. Is the backend running and is environment.apiUrl correct?`;
      }
      const body = err.error;
      if (typeof body === 'string' && body.trim()) {
        return body;
      }
      if (body && typeof body === 'object') {
        const o = body as Record<string, unknown>;
        const m = o['message'] ?? o['error'];
        if (typeof m === 'string' && m.trim()) {
          return m;
        }
      }
    }
    return fallback;
  }

  private bindTopicIfNeeded(): void {
    if (this.activeSessionId != null) {
      this.stomp.subscribeToSession(this.activeSessionId, (ev) => this.onChatEvent(ev));
    }
  }

  private onChatEvent(ev: ChatEvent): void {
    this.thinking = false;
    if (ev.error) {
      this.error = ev.errorMessage || 'Chatbot request failed.';
      this.cdr.markForCheck();
      return;
    }
    this.error = '';
    this.reloadMessages();
    this.cdr.markForCheck();
  }

  private reloadMessages(): void {
    if (this.activeSessionId == null) {
      return;
    }
    this.chatbotService.getSessionMessages(this.activeSessionId).subscribe({
      next: (msgs) => {
        this.messages = msgs;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = this.chatHttpError(err, 'Unable to refresh messages.');
        this.cdr.markForCheck();
      }
    });
  }

  loadSessions(): void {
    this.chatbotService.getMySessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        if (!this.activeSessionId && sessions.length > 0) {
          this.selectSession(sessions[0].id);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = this.chatHttpError(err, 'Unable to load chat sessions.');
        this.cdr.markForCheck();
      }
    });
  }

  newSession(): void {
    this.chatbotService.createSession().subscribe({
      next: (session) => {
        this.sessions = [session, ...this.sessions];
        this.selectSession(session.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = this.chatHttpError(err, 'Unable to create session.');
        this.cdr.markForCheck();
      }
    });
  }

  selectSession(sessionId: number): void {
    const sessionChanged = this.activeSessionId !== sessionId;
    this.activeSessionId = sessionId;
    this.loading = true;
    this.chatbotService.getSessionMessages(sessionId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.loading = false;
        if (sessionChanged && this.wsConnected) {
          this.stomp.unsubscribeTopic();
          this.stomp.subscribeToSession(sessionId, (ev) => this.onChatEvent(ev));
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = this.chatHttpError(err, 'Unable to load messages.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    if (!text) {
      return;
    }
    this.messageText = '';
    this.error = '';

    const doSend = (sessionId: number) => {
      if (!this.wsConnected || !this.stomp.connected) {
        this.messageText = text;
        this.error = `WebSocket is not ready. Wait for the green status or use Reconnect. Backend URL: ${environment.apiUrl}`;
        this.cdr.markForCheck();
        return;
      }
      if (!this.stomp.sendChat(sessionId, text)) {
        this.messageText = text;
        this.error = 'Could not publish on WebSocket. Try Reconnect.';
        this.cdr.markForCheck();
        return;
      }
      this.thinking = true;
      this.cdr.markForCheck();
    };

    if (this.activeSessionId != null) {
      doSend(this.activeSessionId);
      return;
    }

    this.loading = true;
    this.chatbotService.createSession().subscribe({
      next: (session) => {
        this.sessions = [session, ...this.sessions];
        this.activeSessionId = session.id;
        if (this.wsConnected) {
          this.stomp.unsubscribeTopic();
          this.stomp.subscribeToSession(session.id, (ev) => this.onChatEvent(ev));
        }
        this.loading = false;
        doSend(session.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.messageText = text;
        this.error = this.chatHttpError(err, 'Unable to create chat session.');
        this.cdr.markForCheck();
      }
    });
  }

  deleteSession(sessionId: number): void {
    this.chatbotService.deleteSession(sessionId).subscribe({
      next: () => {
        this.sessions = this.sessions.filter((s) => s.id !== sessionId);
        if (this.activeSessionId === sessionId) {
          this.stomp.unsubscribeTopic();
          this.activeSessionId = null;
          this.messages = [];
          if (this.sessions.length > 0) {
            this.selectSession(this.sessions[0].id);
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = this.chatHttpError(err, 'Failed to delete session.');
        this.cdr.markForCheck();
      }
    });
  }
}
