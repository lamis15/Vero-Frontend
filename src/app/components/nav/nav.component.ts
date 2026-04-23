import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
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
  notifications: Notification[] = [];
  unreadCount = 0;
  showDropdown = false;
  showProfileMenu = false;
  cartCount = 0;
  isDarkPage = false;
  private pollInterval: any;
  private cartSub: Subscription | null = null;

  constructor(
    private forumService: ForumService,
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

  fetchNotifications() {
    this.forumService.getUnreadNotifications().subscribe(nots => {
      this.notifications = nots.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.unreadCount = this.notifications.filter(n => !n.isRead).length;
      this.cdr.markForCheck();
    });
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    if (this.showDropdown) {
      this.fetchNotifications();
    }
  }

  markAsRead(n: Notification, event: Event) {
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
}
