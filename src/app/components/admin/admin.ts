import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { MessagerieService } from '../../services/messagerie.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit {
  adminMe: UserResponse | null = null;

  constructor(
    private authService: AuthService,
    private messagerieService: MessagerieService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.messagerieService.connect(me.id, me.role === 'ADMIN');
        this.ensureNotificationPermission();
      },
      error: () => {
        const cached = this.authService.currentUser;
        if (cached) {
          this.adminMe = cached;
        }
      }
    });
  }

  isActive(segment: string): boolean {
    return this.router.url.includes('/admin/' + segment);
  }

  get currentSection(): string {
    const url = this.router.url;
    if (url.includes('/admin/messages')) return 'messages';
    if (url.includes('/admin/products')) return 'products';
    if (url.includes('/admin/formations')) return 'formations';
    if (url.includes('/admin/users/new')) return 'add';
    if (url.includes('/edit')) return 'edit';
    return 'users';
  }

  get heroTitle(): string {
    switch (this.currentSection) {
      case 'users': return 'The <em>Directory</em>';
      case 'messages': return 'Conversations';
      case 'add': return 'A <em>new</em> member';
      case 'edit': return 'Editing a <em>member</em>';
      case 'products': return 'Eco <em>Catalogue</em>';
      case 'formations': return 'Green <em>Academy</em>';
      default: return 'Admin <em>Dashboard</em>';
    }
  }

  get heroSub(): string {
    switch (this.currentSection) {
      case 'users': return 'Manage accounts, roles and moderation actions across the Vero platform.';
      case 'messages': return 'Send and receive messages with your team.';
      case 'add': return 'Provision a new account with the correct role and initial access policy.';
      case 'edit': return 'Update the selected account in place without leaving the directory.';
      case 'products': return 'Manage your eco-store products, stock, and sustainability metrics.';
      case 'formations': return 'Manage educational formations, sessions, and training resources.';
      default: return '';
    }
  }

  get heroCrumb(): string {
    switch (this.currentSection) {
      case 'users': return 'Directory';
      case 'messages': return 'Messages';
      case 'add': return 'New user';
      case 'edit': return 'Edit user';
      case 'products': return 'Eco Store';
      case 'formations': return 'Academy';
      default: return '';
    }
  }

  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }
}
