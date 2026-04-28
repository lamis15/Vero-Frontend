import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewEncapsulation,
  ElementRef,
  ChangeDetectorRef,
  EventEmitter,
  Output
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { AdminService } from '../../../services/admin.service';
import { ProductService } from '../../../services/product.service';
import { FormationService } from '../../../services/formation.service';
import { ForumService } from '../../../services/forum.service';
import { MessagerieService, TopicCounts } from '../../../services/messagerie.service';
import { AuthService, UserResponse } from '../../../services/auth.service';

export type AdminTab =
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
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AdminDashboardComponent implements OnInit, OnDestroy, AfterViewInit {

  @Output() tabChange = new EventEmitter<AdminTab>();

  adminMe: UserResponse | null = null;

  userCount = 0;
  productCount = 0;
  formationCount = 0;
  messageCount = 0;

  petitionCount = 0;
  donationCount = 0;

  forumStats = {
    totalPosts: 0,
    flaggedCount: 0
  };

  topicHeatmap: TopicCounts = {
    eco: 0,
    lifestyle: 0,
    product: 0,
    other: 0
  };

  topicHeatmapTotal = 0;
  currentDate = '';

  private adminMessageSub?: Subscription;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private productService: ProductService,
    private formationService: FormationService,
    private forumService: ForumService,
    private messagerieService: MessagerieService,
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initDate();
    this.loadAdmin();
    this.loadStats();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.animateAllCounters(), 500);
  }

  ngOnDestroy(): void {
    this.adminMessageSub?.unsubscribe();
  }

  setTab(tab: AdminTab): void {
    this.tabChange.emit(tab);
  }

  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  topicPercent(label: keyof TopicCounts): number {
    if (!this.topicHeatmapTotal) return 0;
    const count = this.topicHeatmap[label] || 0;
    return Math.round((count / this.topicHeatmapTotal) * 100);
  }

  private initDate(): void {
    this.currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private loadAdmin(): void {
    const cached = this.authService.currentUser;

    if (cached) {
      this.adminMe = cached;
    }

    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.messagerieService.connect(me.id, me.role === 'ADMIN');

        if (me.role === 'ADMIN') {
          this.subscribeToAdminMessages();
        }

        this.cdr.detectChanges();
      },
      error: () => {
        if (cached) this.adminMe = cached;
      }
    });
  }

  private loadStats(): void {
    this.adminService.getAllUsers().subscribe({
      next: (data: any) => {
        let users = data ?? [];

        if (!Array.isArray(users)) {
          users = users.content || users.data || users.users || [];
        }

        this.userCount = users.length;
        this.animateCounter('stat-card-users', this.userCount);
      },
      error: () => {}
    });

    this.productService.getAll().subscribe({
      next: (products: any[]) => {
        this.productCount = products?.length || 0;
        this.animateCounter('stat-card-products', this.productCount);
      },
      error: () => {}
    });

    this.formationService.getAll().subscribe({
      next: (formations: any[]) => {
        this.formationCount = formations?.length || 0;
        this.animateCounter('stat-card-formations', this.formationCount);
      },
      error: () => {}
    });

    this.forumService.getAllPosts().subscribe({
      next: (posts: any[]) => {
        const list = posts || [];
        this.forumStats.totalPosts = list.length;
        this.forumStats.flaggedCount = list.filter((p: any) => p.isFlagged).length;
        this.animateCounter('stat-card-community', this.forumStats.totalPosts);
      },
      error: () => {}
    });

    this.refreshHeatmap();
  }

  private refreshHeatmap(): void {
    this.messagerieService.loadTopicHeatmap().subscribe({
      next: (counts: TopicCounts | any) => {
        this.topicHeatmap = {
          eco: counts?.eco || 0,
          lifestyle: counts?.lifestyle || 0,
          product: counts?.product || 0,
          other: counts?.other || 0
        };

        this.topicHeatmapTotal =
          this.topicHeatmap.eco +
          this.topicHeatmap.lifestyle +
          this.topicHeatmap.product +
          this.topicHeatmap.other;

        this.messageCount = this.topicHeatmapTotal;

        this.animateCounter('stat-card-messages', this.messageCount);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private subscribeToAdminMessages(): void {
    this.adminMessageSub?.unsubscribe();

    this.adminMessageSub = this.messagerieService.adminIncoming$.subscribe((msg) => {
      if (!msg) return;

      const topic = msg.topic as keyof TopicCounts | null;

      if (topic && topic in this.topicHeatmap) {
        this.topicHeatmap[topic] = (this.topicHeatmap[topic] || 0) + 1;

        this.topicHeatmapTotal =
          this.topicHeatmap.eco +
          this.topicHeatmap.lifestyle +
          this.topicHeatmap.product +
          this.topicHeatmap.other;

        this.messageCount = this.topicHeatmapTotal;

        this.animateCounter('stat-card-messages', this.messageCount);
        this.cdr.detectChanges();
      }
    });
  }

  private animateAllCounters(): void {
    this.animateCounter('stat-card-users', this.userCount);
    this.animateCounter('stat-card-formations', this.formationCount);
    this.animateCounter('stat-card-products', this.productCount);
    this.animateCounter('stat-card-community', this.forumStats.totalPosts);
    this.animateCounter('stat-card-messages', this.messageCount);
  }

  private animateCounter(cardId: string, target: number): void {
    const card = this.host.nativeElement.querySelector<HTMLElement>(`#${cardId}`);
    const span = card?.querySelector<HTMLElement>('.vc-stat-number-inner');

    if (!span) return;

    if (!target || target <= 0) {
      span.textContent = '0';
      return;
    }

    const duration = 1200;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = Math.min(now - start, duration);
      const progress = easeOut(elapsed / duration);

      span.textContent = Math.round(progress * target).toLocaleString();

      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        span.textContent = target.toLocaleString();
      }
    };

    requestAnimationFrame(tick);
  }
}