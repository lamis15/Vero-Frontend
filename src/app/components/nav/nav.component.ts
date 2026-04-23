import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef
} from '@angular/core';

import {
  Router,
  NavigationEnd,
  RouterLink,
  RouterLinkActive,
  RouterModule
} from '@angular/router';

import { CommonModule } from '@angular/common';
import { Subscription, filter, catchError, of } from 'rxjs';

import { ForumService } from '../../services/forum.service';
import { AuthService, UserResponse } from '../../services/auth.service';
import { Notification as ForumNotification } from '../../services/forum.models';
import { MessagerieService } from '../../services/messagerie.service';

export interface ToastNotification {
  id: number;
  message: string;
  type: string;
  visible: boolean;
  timeout?: any;
}

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {

  // ===================== FORUM =====================
  notifications: ForumNotification[] = [];
  unreadCount = 0;

  // ===================== MESSAGES =====================
  messageUnreadCount = 0;
  currentUser: UserResponse | null = null;

  // ===================== UI =====================
  showDropdown = false;
  showChatDropdown = false;
  toasts: ToastNotification[] = [];
  private toastIdCounter = 0;

  // ===================== TIMERS =====================
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private messageSyncInterval: ReturnType<typeof setInterval> | null = null;

  // ===================== SUBSCRIPTIONS =====================
  private authSub?: Subscription;
  private routeSub?: Subscription;
  private messageSub?: Subscription;

  // ===================== STATE =====================
  private knownConversationLastTime = new Map<string, number>();

  constructor(
    private forumService: ForumService,
    private messagerieService: MessagerieService,
    public authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  // =================================================
  // INIT
  // =================================================
  ngOnInit(): void {

    this.authSub = this.authService.isLoggedIn$.subscribe(loggedIn => {

      if (loggedIn) {
        this.startForumPolling();
        this.initMessaging();
        this.requestNotificationPermission();
      } else {
        this.cleanupAll();
      }

      this.cdr.markForCheck();
    });

    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        if (e.urlAfterRedirects.startsWith('/messages')) {
          this.messageUnreadCount = 0;
          this.cdr.markForCheck();
        }
      });
  }

  // =================================================
  // FORUM NOTIFICATIONS
  // =================================================
  private startForumPolling(): void {
    if (this.pollInterval) return;

    this.fetchNotifications();
    this.pollInterval = setInterval(() => this.fetchNotifications(), 30000);
  }

  private stopForumPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  fetchNotifications(): void {
    this.forumService.getUnreadNotifications()
      .pipe(catchError(() => of([])))
      .subscribe((nots: ForumNotification[]) => {
        this.notifications = nots.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );

        this.unreadCount = this.notifications.filter(n => !n.isRead).length;
        this.cdr.markForCheck();
      });
  }

  markAsRead(n: ForumNotification, event: Event): void {
    event.stopPropagation();

    this.forumService.markNotificationAsRead(n.id).subscribe(() => {
      n.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.cdr.markForCheck();
    });
  }

  // =================================================
  // MESSAGING SYSTEM
  // =================================================
  private initMessaging(): void {

    this.authService.getMe().subscribe(user => {
      this.currentUser = user;

      this.messagerieService.connect(
        user.id,
        user.role === 'ADMIN'
      );
    });

    if (!this.messageSub) {
      this.messageSub = this.messagerieService.incomingMessage$
        .subscribe(message => {

          if (!message || !this.currentUser) return;

          const isForMe = message.receiver.id === this.currentUser.id;
          const onMessagesPage = this.router.url.startsWith('/messages');

          if (isForMe && !onMessagesPage) {
            this.messageUnreadCount++;
            this.showDesktopNotification(
              message.sender.fullName,
              message.content
            );
            this.cdr.markForCheck();
          }
        });
    }

    this.startMessageSync();
  }

  private startMessageSync(): void {
    if (this.messageSyncInterval) return;

    this.syncMessages();
    this.messageSyncInterval = setInterval(() => this.syncMessages(), 5000);
  }

  private stopMessageSync(): void {
    if (this.messageSyncInterval) {
      clearInterval(this.messageSyncInterval);
      this.messageSyncInterval = null;
    }
    this.knownConversationLastTime.clear();
  }

  private syncMessages(): void {
    if (!this.currentUser) return;

    this.messagerieService.loadConversations().subscribe(conversations => {

      for (const conv of conversations) {

        const ts = new Date(conv.lastMessageTime).getTime();
        const prev = this.knownConversationLastTime.get(conv.conversationKey);

        this.knownConversationLastTime.set(conv.conversationKey, ts);

        if (prev == null || ts <= prev) continue;

        const isIncoming = conv.lastMessageSenderId !== this.currentUser!.id;
        const onMessagesPage = this.router.url.startsWith('/messages');

        if (isIncoming && !onMessagesPage) {
          this.messageUnreadCount++;

          const sender =
            conv.otherUser?.fullName ||
              conv.userA.id === this.currentUser!.id
              ? conv.userB.fullName
              : conv.userA.fullName;

          this.showDesktopNotification(sender, conv.lastMessagePreview || 'New message');
        }
      }

      this.cdr.markForCheck();
    });
  }

  // =================================================
  // UI HELPERS
  // =================================================
  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    this.showChatDropdown = false;

    if (this.showDropdown) {
      this.fetchNotifications();
    }
  }

  toggleChatDropdown(event: Event): void {
    event.stopPropagation();
    this.showChatDropdown = !this.showChatDropdown;
    this.showDropdown = false;
  }

  openMessages(): void {
    this.messageUnreadCount = 0;
    void this.router.navigateByUrl('/messages');
  }

  goChat(): void {
    if (this.authService.isLoggedIn) {
      void this.router.navigateByUrl('/chat');
    } else {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/chat' }
      });
    }
  }

  logout(): void {
    this.messagerieService.disconnect();
    this.authService.logout();

    this.cleanupAll();
  }

  // =================================================
  // NOTIFICATIONS (DESKTOP)
  // =================================================
  private requestNotificationPermission(): void {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  }

  private showDesktopNotification(title: string, body: string): void {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification(`New message from ${title}`, {
      body: body.length > 90 ? body.slice(0, 87) + '...' : body
    });
  }

  // =================================================
  // CLEANUP
  // =================================================
  private cleanupAll(): void {
    this.stopForumPolling();
    this.stopMessageSync();

    this.notifications = [];
    this.unreadCount = 0;
    this.messageUnreadCount = 0;
    this.currentUser = null;

    this.messageSub?.unsubscribe();
    this.messageSub = undefined;
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.messageSub?.unsubscribe();
    this.cleanupAll();
  }

  // close dropdown
  @HostListener('document:click')
  closeDropdown(): void {
    this.showDropdown = false;
    this.showChatDropdown = false;
  }
}