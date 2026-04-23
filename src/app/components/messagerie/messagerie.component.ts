import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagerieService, DirectMessage, ConversationSummary, ChatParticipant } from '../../services/messagerie.service';
import { AuthService, UserResponse } from '../../services/auth.service';
import { Subscription } from 'rxjs';

interface OptimisticMessage extends DirectMessage {
  tempId: string;
}

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messagerie.component.html',
  styleUrl: './messagerie.component.css'
})
export class MessagerieComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatScroll') private chatScrollContainer!: ElementRef;
  private activeConversationRequestId = 0;
  private pendingOpenConversation: ConversationSummary | null = null;
  private contactsLoadRequestId = 0;
  private conversationsLoadRequestId = 0;
  private incomingSub?: Subscription;
  private pendingOptimisticMessages: OptimisticMessage[] = [];

  public contacts: UserResponse[] = [];
  public conversations: ConversationSummary[] = [];
  public activeContact: UserResponse | null = null;
  public messages: DirectMessage[] = [];
  public currentMessage = '';
  public myUser: UserResponse | null = null;
  public contactsLoading = false;
  public conversationsLoading = false;
  public contactsError = '';
  public conversationsError = '';
  public contactSearch = '';
  public sending = false;
  public sendError = '';

  constructor(
    private messagerieService: MessagerieService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const cachedUser = this.authService.currentUser;
    if (cachedUser) {
      this.initializeMessaging(cachedUser);
    }

    this.authService.getMe().subscribe({
      next: (u: UserResponse) => this.initializeMessaging(u),
      error: () => {
        if (!this.myUser) {
          this.conversationsLoading = false;
          this.contactsLoading = false;
          this.conversationsError = 'Unable to load conversations.';
          this.contactsError = 'Unable to load users right now.';
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.incomingSub?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  get filteredContacts(): UserResponse[] {
    const query = this.contactSearch.trim().toLowerCase();
    if (!query) {
      return this.contacts;
    }
    return this.contacts.filter((contact) =>
      contact.fullName.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.role.toLowerCase().includes(query)
    );
  }

  loadContacts(): void {
    const requestId = ++this.contactsLoadRequestId;
    this.contactsLoading = this.contacts.length === 0;
    this.contactsError = '';

    this.messagerieService.loadPublicUsers().subscribe({
      next: (users) => {
        if (this.contactsLoadRequestId !== requestId) {
          return;
        }
        this.contacts = users.filter(u => u.id !== this.myUser?.id);
        this.contactsLoading = false;
      },
      error: () => {
        if (this.contactsLoadRequestId !== requestId) {
          return;
        }
        this.contactsLoading = false;
        this.contactsError = 'Unable to load users right now.';
      }
    });
  }

  loadConversations(preserveSelection = true): void {
    const requestId = ++this.conversationsLoadRequestId;
    this.conversationsLoading = this.conversations.length === 0;
    this.conversationsError = '';

    this.messagerieService.loadConversations().subscribe({
      next: (conversations) => {
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
        this.conversations = conversations;
        this.conversationsLoading = false;

        if (!preserveSelection && this.activeContact) {
          return;
        }

        if (!this.activeContact && this.conversations.length > 0) {
          this.openConversation(this.conversations[0]);
        }
      },
      error: () => {
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
        this.conversationsLoading = false;
        this.conversationsError = 'Unable to load conversations.';
      }
    });
  }

  selectContact(contact: UserResponse): void {
    this.activateConversation(contact);
  }

  openConversation(summary: ConversationSummary): void {
    const targetUser = this.resolveOtherUser(summary);
    if (!targetUser) {
      this.pendingOpenConversation = summary;
      if (!this.myUser) {
        this.authService.getMe().subscribe({
          next: (u: UserResponse) => {
            this.initializeMessaging(u);
            if (this.pendingOpenConversation) {
              const pending = this.pendingOpenConversation;
              this.pendingOpenConversation = null;
              this.openConversation(pending);
            }
          }
        });
      }
      return;
    }
    this.pendingOpenConversation = null;
    const existing = this.contacts.find(contact => contact.id === targetUser.id);
    const contact = existing ?? {
      id: targetUser.id,
      fullName: targetUser.fullName,
      email: targetUser.email,
      role: targetUser.role,
      verified: true,
      banned: false,
      createdAt: summary.lastMessageTime
    };
    this.activateConversation(contact);
  }

  onConversationPointerDown(summary: ConversationSummary): void {
    this.openConversation(summary);
  }

  onContactPointerDown(contact: UserResponse): void {
    this.selectContact(contact);
  }

  sendMessage(): void {
    if (this.sending) return;
    if (!this.currentMessage.trim() || !this.activeContact || !this.myUser) return;

    const content = this.currentMessage.trim();
    const target = this.activeContact;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const optimistic: OptimisticMessage = {
      tempId,
      sender: {
        id: this.myUser.id,
        fullName: this.myUser.fullName,
        email: this.myUser.email,
        role: this.myUser.role as 'USER' | 'ADMIN' | 'PARTNER'
      },
      receiver: {
        id: target.id,
        fullName: target.fullName,
        email: target.email,
        role: target.role as 'USER' | 'ADMIN' | 'PARTNER'
      },
      content,
      timestamp: new Date().toISOString(),
      isRead: false
    };
    this.pendingOptimisticMessages = [...this.pendingOptimisticMessages, optimistic];
    this.messages = this.mergeWithPending(this.messages);

    this.sending = true;
    this.sendError = '';
    this.currentMessage = '';

    this.messagerieService.sendMessage(target.id, content).subscribe({
      next: () => {
        this.sending = false;
        // Real message will arrive via WS echo; nothing else to do here.
      },
      error: () => {
        this.sending = false;
        this.sendError = 'Message failed to send.';
        // Remove the failed optimistic entry so the user knows it didn't go through.
        this.pendingOptimisticMessages = this.pendingOptimisticMessages.filter(p => p.tempId !== tempId);
        this.messages = this.mergeWithPending(this.messages.filter(m => (m as OptimisticMessage).tempId !== tempId));
        this.currentMessage = content;
      }
    });
  }

  initials(name: string | undefined): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  isMine(message: DirectMessage): boolean {
    return message.sender.id === this.myUser?.id;
  }

  previewName(conversation: ConversationSummary): string {
    return conversation.otherUser?.fullName || `${conversation.userA.fullName} & ${conversation.userB.fullName}`;
  }

  trackConversation(_: number, conversation: ConversationSummary): string {
    return conversation.conversationKey;
  }

  trackContact(_: number, contact: UserResponse): number {
    return contact.id;
  }

  conversationTargetId(conversation: ConversationSummary): number | null {
    return this.resolveOtherUser(conversation)?.id ?? null;
  }

  private resolveOtherUser(summary: ConversationSummary): ChatParticipant | null {
    if (summary.otherUser) {
      return summary.otherUser;
    }
    if (!this.myUser) {
      return null;
    }

    if (summary.userA.id === this.myUser.id) {
      return summary.userB;
    }
    if (summary.userB.id === this.myUser.id) {
      return summary.userA;
    }

    return null;
  }

  private scrollToBottom(): void {
    try {
      this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
    } catch {}
  }

  private initializeMessaging(user: UserResponse): void {
    const isSameUser = this.myUser?.id === user.id;
    this.myUser = user;

    if (!isSameUser) {
      this.messagerieService.connect(this.myUser.id, this.myUser.role === 'ADMIN');
      this.loadContacts();
      this.loadConversations();
    }

    if (!this.incomingSub) {
      this.incomingSub = this.messagerieService.incomingMessage$.subscribe((msg) => {
        if (!msg || !this.myUser) {
          return;
        }
        const belongsToActiveThread = this.activeContact != null &&
          ((msg.sender.id === this.myUser.id && msg.receiver.id === this.activeContact.id) ||
           (msg.sender.id === this.activeContact.id && msg.receiver.id === this.myUser.id));

        if (belongsToActiveThread) {
          this.appendIncoming(msg);
        }
        // Any incoming message may change the conversations sidebar; refresh once.
        this.loadConversations(false);
      });
    }
  }

  private activateConversation(contact: UserResponse): void {
    this.activeContact = contact;
    this.pendingOptimisticMessages = [];
    this.messages = [];
    this.refreshActiveConversation();
  }

  private refreshActiveConversation(): void {
    if (!this.activeContact) {
      return;
    }
    const contactId = this.activeContact.id;
    const requestId = ++this.activeConversationRequestId;
    this.messagerieService.loadHistory(contactId).subscribe({
      next: (msgs) => {
        if (this.activeContact?.id !== contactId || this.activeConversationRequestId !== requestId) {
          return;
        }
        this.messages = this.mergeWithPending(msgs);
      },
      error: () => {
        if (this.activeContact?.id !== contactId || this.activeConversationRequestId !== requestId) {
          return;
        }
        this.messages = [];
      }
    });
  }

  // Append an incoming WS message to the active thread, replacing any matching optimistic entry.
  private appendIncoming(msg: DirectMessage): void {
    // Drop the first pending optimistic that matches sender/receiver/content (FIFO order).
    if (msg.sender.id === this.myUser?.id) {
      const idx = this.pendingOptimisticMessages.findIndex(p =>
        p.receiver.id === msg.receiver.id && p.content === msg.content);
      if (idx >= 0) {
        this.pendingOptimisticMessages.splice(idx, 1);
      }
    }
    // Avoid duplicating if we already have this server id (e.g. sender+receiver both on same client).
    if (msg.id != null && this.messages.some(m => m.id === msg.id)) {
      this.messages = this.mergeWithPending(this.messages);
      return;
    }
    const base = this.messages.filter(m => !(m as OptimisticMessage).tempId);
    this.messages = this.mergeWithPending([...base, msg]);
  }

  private mergeWithPending(serverMessages: DirectMessage[]): DirectMessage[] {
    // Drop stale optimistic entries older than 20 s (they're probably duplicates the server already sent back).
    this.pendingOptimisticMessages = this.pendingOptimisticMessages.filter((pending) => {
      const ageMs = Date.now() - new Date(pending.timestamp).getTime();
      return ageMs < 20000;
    });

    if (!this.pendingOptimisticMessages.length) {
      return serverMessages;
    }
    return [...serverMessages, ...this.pendingOptimisticMessages];
  }
}
