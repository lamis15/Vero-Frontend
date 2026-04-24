import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef
} from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, filter, catchError, of } from 'rxjs';
import { ForumService } from '../../services/forum.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { Notification as ForumNotification } from '../../services/forum.models';
import { MessagerieService } from '../../services/messagerie.service';
import { UserService } from '../../services/user.service';

export interface UserResponse {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {

  notifications: ForumNotification[] = [];
  unreadCount = 0;
  messageUnreadCount = 0;
  currentUser: UserResponse | null = null;
  showDropdown = false;
  showProfileMenu = false;
  showChatDropdown = false;
  cartCount = 0;
  isDarkPage = false;
  isAdmin = false;

  private pollInterval: any;
  private cartSub: Subscription | null = null;
  private authSub: Subscription | null = null;
  private routeSub: Subscription | null = null;
  private messageSub: Subscription | undefined;

  constructor(
    private forumService: ForumService,
    private messagerieService: MessagerieService,
    public authService: AuthService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin;
    if (this.authService.isLoggedIn) {
      this.startForumPolling();
    }

    this.authSub = this.authService.isLoggedIn$.subscribe(loggedIn => {
      if (loggedIn) {
        this.isAdmin = this.authService.isAdmin;
        this.startForumPolling();
      } else {
        this.isAdmin = false;
        this.cleanupAll();
      }
      this.cdr.markForCheck();
    });

    // Also subscribe to role changes
    this.authService.roleStream$.subscribe(role => {
      this.isAdmin = role === 'ADMIN';
      this.cdr.markForCheck();
    });

    this.cartSub = this.cartService.cartCount$.subscribe(count => {
      this.cartCount = count;
      this.cdr.markForCheck();
    });

    const darkRoutes = ['/shop', '/formations', '/admin'];
    this.isDarkPage = darkRoutes.some(r => this.router.url.startsWith(r));

    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.isAdmin = this.authService.isAdmin;
        this.isDarkPage = darkRoutes.some(r => e.urlAfterRedirects.startsWith(r));
        if (e.urlAfterRedirects.startsWith('/messages')) {
          this.messageUnreadCount = 0;
        }
        this.cdr.markForCheck();
      });
  }

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

  private stopMessageSync(): void {
    this.messageSub?.unsubscribe();
    this.messageSub = undefined;
  }

  fetchNotifications(): void {
    this.forumService.getUnreadNotifications()
      .pipe(catchError(() => of([])))
      .subscribe((nots: ForumNotification[]) => {
        this.notifications = nots.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.showProfileMenu = !this.showProfileMenu;
    this.showDropdown = false;
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    this.showProfileMenu = false;
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
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/chat' } });
    }
  }

  logout(): void {
    this.messagerieService.disconnect();
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.authService.logoutLocal(); this.router.navigate(['/']); }
    });
    this.showProfileMenu = false;
    this.cleanupAll();
  }

  private requestNotificationPermission(): void {
    if (!('Notification' in window)) return;
    if ((window as any).Notification.permission === 'default') {
      (window as any).Notification.requestPermission().catch(() => {});
    }
  }

  private showDesktopNotification(title: string, body: string): void {
    if (!('Notification' in window)) return;
    if ((window as any).Notification.permission !== 'granted') return;
    new (window as any).Notification(`New message from ${title}`, {
      body: body.length > 90 ? body.slice(0, 87) + '...' : body
    });
  }

  private cleanupAll(): void {
    this.stopForumPolling();
    this.stopMessageSync();
    this.notifications = [];
    this.unreadCount = 0;
    this.messageUnreadCount = 0;
    this.currentUser = null;
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.cartSub?.unsubscribe();
    this.cleanupAll();
  }

  @HostListener('document:click')
  closeDropdown(): void {
    this.showDropdown = false;
    this.showProfileMenu = false;
    this.showChatDropdown = false;
  }
}
