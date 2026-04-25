import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { MessagerieService } from '../../services/messagerie.service';
import { NotificationService } from '../../services/notification.service';

import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminMessagesComponent } from './admin-messages/admin-messages.component';
import { AdminProductsComponent } from './admin-products/admin-products.component';
import { AdminFormationsComponent } from './admin-formations/admin-formations.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    AdminUsersComponent, 
    AdminMessagesComponent, 
    AdminProductsComponent, 
    AdminFormationsComponent
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit {
  activeTab: 'users' | 'add' | 'settings' | 'edit' | 'messages' | 'products' | 'formations' = 'users';
  adminMe: UserResponse | null = null;
  topicHeatmapTotal = 0; // We can ignore or mock this if the sidebar needs it, or load it from a service.
  suspendedCount = 0;
  monitoredCount = 0;

  constructor(
    private authService: AuthService,
    private messagerieService: MessagerieService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Read ?tab= from navbar links
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'products') {
        this.setTab('products');
      } else if (params['tab'] === 'formations') {
        this.setTab('formations');
      }
    });

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

  setTab(tab: 'users' | 'add' | 'settings' | 'edit' | 'messages' | 'products' | 'formations' | string): void {
    this.activeTab = tab as any;
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
