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
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { Notification } from '../../services/forum.models';
import { Subscription } from 'rxjs';

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
  showProfileMenu = false;
  cartCount = 0;
  isDarkPage = false;
  private pollInterval: any;
  private cartSub: Subscription | null = null;

  constructor(
    private forumService: ForumService,
    private messagerieService: MessagerieService,
    public authService: AuthService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
  }

  ngOnInit() {
    if (this.authService.isLoggedIn) {
      this.fetchNotifications();
      this.pollInterval = setInterval(() => this.fetchNotifications(), 30000);
    }
    this.cartSub = this.cartService.cartCount$.subscribe(count => {
      this.cartCount = count;
      this.cdr.markForCheck();
    });
    // Track dark pages
    const darkRoutes = ['/shop', '/formations', '/admin'];
    this.isDarkPage = darkRoutes.some(r => this.router.url.startsWith(r));
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.isDarkPage = darkRoutes.some(r => e.urlAfterRedirects.startsWith(r));
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.cartSub) {
      this.cartSub.unsubscribe();
    }
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

  toggleProfileMenu(event: Event) {
    event.stopPropagation();
    this.showProfileMenu = !this.showProfileMenu;
    this.showDropdown = false;
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.authService.logoutLocal(); this.router.navigate(['/']); }
    });
    this.showProfileMenu = false;
  }

  @HostListener('document:click')
  closeDropdown() {
    this.showDropdown = false;
    this.showProfileMenu = false;
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