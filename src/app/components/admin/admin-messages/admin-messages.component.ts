import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagerieService, ConversationSummary, DirectMessage, TopicCounts } from '../../../services/messagerie.service';
import { NotificationService } from '../../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-messages.html',
  styleUrls: ['./admin-messages.css']
})
export class AdminMessagesComponent implements OnInit, OnDestroy {
  @Input() activeTab: 'messages' = 'messages';
  @Output() tabChange = new EventEmitter<string>();

  private static readonly CONVS_CACHE_KEY = 'vero_admin_convs_cache';

  conversationSearch = '';
  adminConversations: ConversationSummary[] = AdminMessagesComponent.readCache<ConversationSummary[]>(AdminMessagesComponent.CONVS_CACHE_KEY) ?? [];
  topicHeatmap: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
  selectedConversation: ConversationSummary | null = null;
  selectedConversationMessages: DirectMessage[] = [];
  messagesLoading = this.adminConversations.length === 0;
  threadLoading = false;

  private selectedConversationRequestKey = '';
  private selectedConversationRequestId = 0;
  private conversationsLoadRequestId = 0;
  private adminLiveSyncInterval: ReturnType<typeof setInterval> | null = null;
  private adminMessageSub?: Subscription;

  constructor(
    private messagerieService: MessagerieService,
    private notificationService: NotificationService
  ) {}

  private static readCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }

  private static writeCache(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  ngOnInit(): void {
    this.loadAdminConversations();
    this.startAdminLiveSync();
    
    // We expect the parent to pass the activeTab, but since this component ONLY handles messages, we can always load it if init.
    // Heatmap is passed or loaded here? The parent had loadTopicHeatmap(). Let's load it here.
    this.loadTopicHeatmap();

    this.adminMessageSub = this.messagerieService.adminIncoming$.subscribe((message) => {
      if (!message) return;
      this.upsertConversationFromMessage(message);
      
      const label = (message.topic ?? null) as keyof TopicCounts | null;
      if (label && this.topicHeatmap[label] != null) {
        this.topicHeatmap = { ...this.topicHeatmap, [label]: this.topicHeatmap[label] + 1 };
      }
      if (!this.selectedConversation && this.activeTab === 'messages' && this.adminConversations.length > 0) {
        this.openAdminConversation(this.adminConversations[0]);
        return;
      }
      if (this.selectedConversation && this.belongsToSelectedConversation(message, this.selectedConversation)) {
        this.selectedConversationMessages = [...this.selectedConversationMessages, message];
      } else if (this.activeTab === 'messages') {
        this.loadAdminConversations();
      }
    });
  }

  ngOnDestroy(): void {
    this.adminMessageSub?.unsubscribe();
    this.stopAdminLiveSync();
  }

  loadAdminConversations(): void {
    const requestId = ++this.conversationsLoadRequestId;
    this.messagesLoading = this.adminConversations.length === 0;

    this.messagerieService.loadAdminConversations(this.conversationSearch).subscribe({
      next: (conversations) => {
        if (this.conversationsLoadRequestId !== requestId) return;
        this.adminConversations = conversations;
        this.messagesLoading = false;
        if (!this.conversationSearch) {
          AdminMessagesComponent.writeCache(AdminMessagesComponent.CONVS_CACHE_KEY, conversations);
        }
        if (!this.selectedConversation && conversations.length > 0) {
          this.openAdminConversation(conversations[0]);
        }
      },
      error: () => {
        if (this.conversationsLoadRequestId !== requestId) return;
        this.messagesLoading = false;
        this.notificationService.error('Failed to load conversations.');
      }
    });
  }

  filterConversations(): void {
    this.loadAdminConversations();
  }

  loadTopicHeatmap(): void {
    this.messagerieService.loadTopicHeatmap().subscribe({
      next: (counts) => (this.topicHeatmap = counts),
      error: () => {}
    });
  }

  openAdminConversation(conversation: ConversationSummary): void {
    this.selectedConversation = conversation;
    const requestKey = conversation.conversationKey;
    this.selectedConversationRequestKey = requestKey;
    const requestId = ++this.selectedConversationRequestId;
    this.threadLoading = true;
    this.messagerieService.loadAdminHistoryCached(conversation.userA.id, conversation.userB.id).subscribe({
      next: (messages) => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) return;
        this.selectedConversationMessages = messages;
        this.threadLoading = false;
      },
      error: () => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) return;
        this.threadLoading = false;
        this.notificationService.error('Failed to load thread.');
      }
    });
  }

  onAdminConversationPointerDown(conversation: ConversationSummary): void {
    this.openAdminConversation(conversation);
  }

  startAdminLiveSync(): void {
    if (this.adminLiveSyncInterval) return;
    this.adminLiveSyncInterval = setInterval(() => {
      if (this.activeTab === 'messages' && !this.conversationSearch) {
        this.messagerieService.loadAdminConversations('').subscribe({
          next: (conversations) => {
            if (this.conversationSearch) return;
            this.adminConversations = conversations;
          }
        });
      }
    }, 15000);
  }

  stopAdminLiveSync(): void {
    if (this.adminLiveSyncInterval != null) {
      clearInterval(this.adminLiveSyncInterval);
      this.adminLiveSyncInterval = null;
    }
  }

  private upsertConversationFromMessage(message: DirectMessage): void {
    const key = [message.sender.id, message.receiver.id].sort().join(':');
    const existing = this.adminConversations.find(c => c.conversationKey === key);
    if (existing) {
      existing.lastMessagePreview = message.content;
      existing.lastMessageTime = message.timestamp;
      this.adminConversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    } else {
      this.loadAdminConversations();
    }
  }

  private belongsToSelectedConversation(message: DirectMessage, conv: ConversationSummary): boolean {
    const isSenderA = message.sender.id === conv.userA.id;
    const isRecipientB = message.receiver.id === conv.userB.id;
    const isSenderB = message.sender.id === conv.userB.id;
    const isRecipientA = message.receiver.id === conv.userA.id;
    return (isSenderA && isRecipientB) || (isSenderB && isRecipientA);
  }

  get topicHeatmapTotal(): number {
    const h = this.topicHeatmap;
    return (h.eco || 0) + (h.lifestyle || 0) + (h.product || 0) + (h.other || 0);
  }

  topicPercent(label: keyof TopicCounts): number {
    const total = this.topicHeatmapTotal;
    if (!total) return 0;
    return Math.round((this.topicHeatmap[label] / total) * 100);
  }

  initials(name?: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
}
