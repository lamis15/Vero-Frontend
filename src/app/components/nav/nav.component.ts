import {
  Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef
} from '@angular/core';
import {
  Router, NavigationEnd, RouterLink, RouterLinkActive, RouterModule
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

type DropdownId = 'explore' | 'community' | 'chat' | 'notif' | null;

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {

  /* ── Data ── */
  notifications: ForumNotification[] = [];
  unreadCount = 0;
  messageUnreadCount = 0;
  currentUser: UserResponse | null = null;
  toasts: ToastNotification[] = [];

  /* ── UI ── */
  activeDropdown: DropdownId = null;
  mobileOpen = false;
  mobileExploreOpen = false;
  mobileCommunityOpen = false;

  /* ── Timers ── */
  private messageSyncInterval: ReturnType<typeof setInterval> | null = null;
  private hoverCloseTimer: any = null;
  private toastIdCounter = 0;

  /* ── Subs ── */
  private authSub?: Subscription;
  private routeSub?: Subscription;
  private messageSub?: Subscription;
  private notificationSub?: Subscription;
  private knownConversationLastTime = new Map<string, number>();

  constructor(
    private forumService: ForumService,
    private messagerieService: MessagerieService,
    public authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get isMapRoute(): boolean { return this.router.url.startsWith('/map'); }

  // ═════════════════════════════════════════════
  // UNIFIED DROPDOWN SYSTEM
  // ═════════════════════════════════════════════
  /** Toggle a dropdown by id (click). Closes all others. */
  toggle(id: DropdownId, event: Event): void {
    event.stopPropagation();
    this.cancelHoverClose();
    this.activeDropdown = this.activeDropdown === id ? null : id;
    if (id === 'notif' && this.activeDropdown === 'notif') this.fetchNotifications();
  }

  /** Open a hover-dropdown (explore / community). */
  hoverOpen(id: DropdownId): void {
    this.cancelHoverClose();
    this.activeDropdown = id;
  }

  /** Schedule closing a hover-dropdown after a short delay. */
  hoverClose(): void {
    this.hoverCloseTimer = setTimeout(() => {
      this.activeDropdown = null;
      this.cdr.markForCheck();
    }, 220);
  }

  /** Cancel a pending hover-close (mouse re-entered). */
  cancelHoverClose(): void {
    if (this.hoverCloseTimer) { clearTimeout(this.hoverCloseTimer); this.hoverCloseTimer = null; }
  }

  closeAll(): void { this.activeDropdown = null; }

  toggleMobile(e: Event): void {
    e.stopPropagation();
    this.mobileOpen = !this.mobileOpen;
    if (!this.mobileOpen) { this.mobileExploreOpen = false; this.mobileCommunityOpen = false; }
    this.closeAll();
  }

  // ═════════════════════════════════════════════
  // INIT
  // ═════════════════════════════════════════════
  ngOnInit(): void {
    this.authSub = this.authService.isLoggedIn$.subscribe(loggedIn => {
      if (loggedIn) { this.startForumPolling(); this.initMessaging(); this.requestNotificationPermission(); }
      else { this.cleanupAll(); }
      this.cdr.markForCheck();
    });

    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        if (e.urlAfterRedirects.startsWith('/messages')) { this.messageUnreadCount = 0; this.cdr.markForCheck(); }
        this.closeAll();
        this.mobileOpen = false;
        this.mobileExploreOpen = false;
        this.mobileCommunityOpen = false;
      });
  }

  // ═════════════════════════════════════════════
  // NOTIFICATIONS
  // ═════════════════════════════════════════════
  private startForumPolling(): void {
    this.fetchNotifications();
    this.authService.getMe().subscribe(user => {
      if (!this.notificationSub) {
        this.notificationSub = this.forumService.subscribeToNotifications(user.id).subscribe(notification => {
          this.notifications.unshift(notification);
          this.unreadCount++;
          this.showToast(notification);
          this.showDesktopNotification('Vero Forum', notification.message);
          this.cdr.markForCheck();
        });
      }
    });
  }

  private stopForumPolling(): void {
    if (this.notificationSub) {
      this.notificationSub.unsubscribe();
      this.notificationSub = undefined;
      this.forumService.disconnectNotificationStomp();
    }
  }

  showToast(notif: ForumNotification) {
    this.playNotificationSound();
    const toast: ToastNotification = { id: ++this.toastIdCounter, message: notif.message, type: notif.type, visible: false };
    this.toasts = [...this.toasts, toast];
    this.cdr.detectChanges();
    setTimeout(() => { toast.visible = true; this.cdr.detectChanges(); }, 50);
    toast.timeout = setTimeout(() => this.dismissToast(toast.id), 5000);
  }

  dismissToast(id: number) {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast) return;
    clearTimeout(toast.timeout);
    toast.visible = false;
    this.cdr.detectChanges();
    setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); this.cdr.detectChanges(); }, 400);
  }

  playNotificationSound() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      
      // Sine wave for a smooth, organic tone
      osc.type = 'sine';
      
      // Pitch sweep for a "water drop" effect (starts mid, sweeps up fast)
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
      
      // Amplitude envelope (instant hit, fast decay)
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  fetchNotifications(): void {
    this.forumService.getUnreadNotifications()
      .pipe(catchError(() => of([])))
      .subscribe((nots: ForumNotification[]) => {
        this.notifications = nots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  // ═════════════════════════════════════════════
  // MESSAGING
  // ═════════════════════════════════════════════
  private initMessaging(): void {
    this.authService.getMe().subscribe(user => {
      this.currentUser = user;
      this.messagerieService.connect(user.id, user.role === 'ADMIN');
    });

    if (!this.messageSub) {
      this.messageSub = this.messagerieService.incomingMessage$.subscribe(msg => {
        if (!msg || !this.currentUser) return;
        if (msg.receiver.id === this.currentUser.id && !this.router.url.startsWith('/messages')) {
          this.messageUnreadCount++;
          this.showDesktopNotification(msg.sender.fullName, msg.content);
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
    if (this.messageSyncInterval) { clearInterval(this.messageSyncInterval); this.messageSyncInterval = null; }
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
        if (isIncoming && !this.router.url.startsWith('/messages')) {
          this.messageUnreadCount++;
          const sender = conv.otherUser?.fullName || (conv.userA.id === this.currentUser!.id ? conv.userB.fullName : conv.userA.fullName);
          this.showDesktopNotification(sender, conv.lastMessagePreview || 'New message');
        }
      }
      this.cdr.markForCheck();
    });
  }

  // ═════════════════════════════════════════════
  // NAV ACTIONS
  // ═════════════════════════════════════════════
  openMessages(): void { this.messageUnreadCount = 0; void this.router.navigateByUrl('/messages'); }

  goChat(): void {
    if (this.authService.isLoggedIn) void this.router.navigateByUrl('/chat');
    else void this.router.navigate(['/login'], { queryParams: { returnUrl: '/chat' } });
  }

  logout(): void { this.messagerieService.disconnect(); this.authService.logout(); this.cleanupAll(); }

  // ═════════════════════════════════════════════
  // DESKTOP NOTIFICATIONS
  // ═════════════════════════════════════════════
  private requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }

  private showDesktopNotification(title: string, body: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(`New message from ${title}`, { body: body.length > 90 ? body.slice(0, 87) + '...' : body });
  }

  // ═════════════════════════════════════════════
  // CLEANUP
  // ═════════════════════════════════════════════
  private cleanupAll(): void {
    this.stopForumPolling();
    this.stopMessageSync();
    this.notifications = [];
    this.unreadCount = 0;
    this.messageUnreadCount = 0;
    this.currentUser = null;
    this.messageSub?.unsubscribe();
    this.messageSub = undefined;
    this.notificationSub?.unsubscribe();
    this.notificationSub = undefined;
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.messageSub?.unsubscribe();
    this.cleanupAll();
  }

  @HostListener('document:click') onDocClick(): void { this.closeAll(); }
}