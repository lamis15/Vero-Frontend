import { Component, OnInit, OnDestroy, AfterViewInit, ViewEncapsulation, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { ProductService } from '../../../services/product.service';
import { FormationService } from '../../../services/formation.service';
import { ForumService } from '../../../services/forum.service';
import { MessagerieService, TopicCounts } from '../../../services/messagerie.service';
import { AuthService, UserResponse } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AdminDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  adminMe: UserResponse | null = null;

  userCount = 0;
  productCount = 0;
  formationCount = 0;
  forumStats = { totalPosts: 0, flaggedCount: 0 };
  topicHeatmap: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
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
    this.currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    const cached = this.authService.currentUser;
    if (cached) this.adminMe = cached;
    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        // Connect to WebSocket as admin to receive all messages
        this.messagerieService.connect(me.id, true);
        this._subscribeToAdminMessages();
      },
      error: () => {}
    });

    this._loadStats();
  }

  ngOnDestroy(): void {
    this.adminMessageSub?.unsubscribe();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this._animateCounter('stat-card-users', this.userCount);
      this._animateCounter('stat-card-formations', this.formationCount);
      this._animateCounter('stat-card-products', this.productCount);
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
      this._animateCounter('stat-card-messages', this.topicHeatmapTotal);
    }, 400);
  }

  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  private _loadStats(): void {
    this.adminService.getAllUsers().subscribe(d => {
      this.userCount = d.length;
      this._animateCounter('stat-card-users', this.userCount);
    });
    this.productService.getAll().subscribe(p => {
      this.productCount = p.length;
      this._animateCounter('stat-card-products', this.productCount);
    });
    this.formationService.getAll().subscribe(f => {
      this.formationCount = f.length;
      this._animateCounter('stat-card-formations', this.formationCount);
    });
    this.forumService.getAllPosts().subscribe(posts => {
      this.forumStats.totalPosts = posts.length;
      this.forumStats.flaggedCount = posts.filter(p => p.isFlagged).length;
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    });
    this.messagerieService.loadTopicHeatmap().subscribe({
      next: (counts: TopicCounts) => {
        this.topicHeatmap = counts;
        this.topicHeatmapTotal = (counts.eco || 0) + (counts.lifestyle || 0) + (counts.product || 0) + (counts.other || 0);
        this._animateCounter('stat-card-messages', this.topicHeatmapTotal);
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  topicPercent(label: keyof TopicCounts): number {
    if (!this.topicHeatmapTotal) return 0;
    return Math.round((this.topicHeatmap[label] / this.topicHeatmapTotal) * 100);
  }

  private _subscribeToAdminMessages(): void {
    // Subscribe to admin incoming messages to update heatmap in real-time
    this.adminMessageSub = this.messagerieService.adminIncoming$.subscribe((msg) => {
      if (!msg) return;
      
      // Update heatmap counts based on the message topic
      const topic = msg.topic as keyof TopicCounts | null;
      if (topic && topic in this.topicHeatmap) {
        this.topicHeatmap[topic] = (this.topicHeatmap[topic] || 0) + 1;
        this.topicHeatmapTotal = (this.topicHeatmap.eco || 0) + 
                                  (this.topicHeatmap.lifestyle || 0) + 
                                  (this.topicHeatmap.product || 0) + 
                                  (this.topicHeatmap.other || 0);
        this.cdr.detectChanges();
      }
    });
  }

  private _refreshHeatmap(): void {
    this.messagerieService.loadTopicHeatmap().subscribe({
      next: (counts: TopicCounts) => {
        this.topicHeatmap = counts;
        this.topicHeatmapTotal = (counts.eco || 0) + (counts.lifestyle || 0) + (counts.product || 0) + (counts.other || 0);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private _animateCounter(cardId: string, target: number): void {
    const card = this.host.nativeElement.querySelector<HTMLElement>(`#${cardId}`);
    const span = card?.querySelector<HTMLElement>('.vc-stat-number-inner');
    if (!span) return;

    if (target === 0) { span.textContent = '0'; return; }

    const duration = 1200;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = Math.min(now - start, duration);
      const progress = easeOut(elapsed / duration);
      span.textContent = Math.round(progress * target).toLocaleString();
      if (elapsed < duration) requestAnimationFrame(tick);
      else span.textContent = target.toLocaleString();
    };
    requestAnimationFrame(tick);
  }
}
