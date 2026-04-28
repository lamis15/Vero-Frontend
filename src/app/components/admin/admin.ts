import { Component, OnInit, ViewEncapsulation, AfterViewInit, ElementRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ProductService } from '../../services/product.service';
import { FormationService } from '../../services/formation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminProductsComponent } from './admin-products/admin-products.component';
import { AdminFormationsComponent } from './admin-formations/admin-formations.component';
import { AdminForumComponent } from './admin-forum/admin-forum.component';
import { ForumService } from '../../services/forum.service';

import { AdminPetitionsComponent } from './admin-petitions/admin-petitions.component';
import { AdminDonationsComponent } from './admin-donation/admin-donations.component';

type AdminTab =
  | 'users'
  | 'add'
  | 'settings'
  | 'edit'
  | 'products'
  | 'formations'
  | 'forum'
  | 'petitions'
  | 'donations';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminUsersComponent,
    AdminProductsComponent,
    AdminFormationsComponent,
    AdminForumComponent,
    AdminPetitionsComponent,
    AdminDonationsComponent
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit, AfterViewInit {
  activeTab: AdminTab = 'users';

  adminMe: UserResponse | null = null;

  successMsg = '';
  errorMsg = '';

  userCount = 0;
  productCount = 0;
  formationCount = 0;
  forumStats = { totalPosts: 0, flaggedCount: 0 };

  currentDate = '';
  currentMonth = '';
  calendarDates: { num: number; isToday: boolean }[] = [];

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private productService: ProductService,
    private formationService: FormationService,
    private forumService: ForumService,
    private route: ActivatedRoute,
    private router: Router,
    private el: ElementRef
  ) {}

  ngOnInit(): void {
    this._initDateHelpers();

    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as AdminTab;

      if (
        tab === 'products' ||
        tab === 'formations' ||
        tab === 'forum' ||
        tab === 'petitions' ||
        tab === 'donations'
      ) {
        this.setTab(tab);
      }
    });

    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.ensureNotificationPermission();
      },
      error: () => {
        const cached = this.authService.currentUser;
        if (cached) this.adminMe = cached;
      }
    });

    this._loadDashboardStats();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this._animateCounter('stat-card-users', this.userCount);
      this._animateCounter('stat-card-formations', this.formationCount);
      this._animateCounter('stat-card-products', this.productCount);
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    }, 1000);
  }

  setTab(tab: string): void {
  const allowedTabs: AdminTab[] = [
    'users',
    'add',
    'settings',
    'edit',
    'products',
    'formations',
    'forum',
    'petitions',
    'donations'
  ];

  if (!allowedTabs.includes(tab as AdminTab)) return;
  if (tab === this.activeTab) return;

  this.successMsg = '';
  this.errorMsg = '';
  this.activeTab = tab as AdminTab;
}

  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private _loadDashboardStats(): void {
    this.adminService.getUsers(0, 1).subscribe({
      next: data => {
        this.userCount = data.totalElements;
        this._animateCounter('stat-card-users', this.userCount);
      },
      error: () => {}
    });

    this.productService.getAll().subscribe({
      next: products => {
        this.productCount = products.length;
        this._animateCounter('stat-card-products', this.productCount);
      },
      error: () => {}
    });

    this.formationService.getAll().subscribe({
      next: formations => {
        this.formationCount = formations.length;
        this._animateCounter('stat-card-formations', this.formationCount);
      },
      error: () => {}
    });

    this.forumService.getAllPosts().subscribe({
      next: posts => {
        this.forumStats.totalPosts = posts.length;
        this.forumStats.flaggedCount = posts.filter(p => p.isFlagged).length;
        this._animateCounter('stat-card-community', this.forumStats.totalPosts);
      },
      error: () => {}
    });
  }

  private _animateCounter(cardId: string, target: number): void {
    const card = document.getElementById(cardId);
    if (!card) return;

    const span = card.querySelector<HTMLElement>('.vc-stat-number-inner');
    if (!span) return;

    if (target === 0) {
      span.textContent = '0';
      return;
    }

    const duration = 1200;
    const startTime = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration);
      const progress = easeOut(elapsed / duration);
      const current = Math.round(progress * target);

      span.textContent = current.toLocaleString();

      if (elapsed < duration) requestAnimationFrame(tick);
      else span.textContent = target.toLocaleString();
    };

    requestAnimationFrame(tick);
  }

  private _initDateHelpers(): void {
    const now = new Date();

    this.currentDate = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    this.currentMonth = now.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const today = now.getDate();

    this.calendarDates = [-3, -2, -1, 0, 1, 2, 3].map(offset => ({
      num: today + offset,
      isToday: offset === 0
    }));
  }

  private ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }
}