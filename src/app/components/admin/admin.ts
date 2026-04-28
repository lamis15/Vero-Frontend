import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { MessagerieService } from '../../services/messagerie.service';
import { AdminSidebarComponent } from './admin-shell/admin-sidebar.component';
import { AdminTopbarComponent } from './admin-shell/admin-topbar.component';
import { AdminRightPanelComponent } from './admin-shell/admin-right-panel.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    AdminSidebarComponent,
    AdminTopbarComponent,
    AdminRightPanelComponent
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit {
  adminMe: UserResponse | null = null;

  constructor(
    private authService: AuthService,
    private messagerieService: MessagerieService,
    private router: Router
  ) { }

  ngOnInit(): void {
    const cached = this.authService.currentUser;
    if (cached) this.adminMe = cached;

    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.messagerieService.connect(me.id, me.role === 'ADMIN');
        this._ensureNotificationPermission();
      },
      error: () => { }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private _ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  }
}
