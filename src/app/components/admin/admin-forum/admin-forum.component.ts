import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../../services/forum.service';
import { Post } from '../../../services/forum.models';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-admin-forum',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-forum.html',
  styleUrls: ['./admin-forum.css']
})
export class AdminForumComponent implements OnInit {
  posts: Post[] = [];
  loading = false;

  stats = {
    totalPosts: 0,
    totalEngagement: 0,
    flaggedCount: 0,
    topCategory: 'N/A'
  };

  currentView: 'stats' | 'oversight' | 'moderation' = 'stats';
  searchQuery = '';
  showFlaggedOnly = false;

  constructor(
    private forumService: ForumService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.forumService.getAllPosts().subscribe({
      next: (data) => {
        this.posts = data;
        this.computeStats();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notificationService.error('Failed to load forum data.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  computeStats(): void {
    this.stats.totalPosts = this.posts.length;
    this.stats.totalEngagement = this.posts.reduce(
      (acc, p) => acc + (p.likes || 0) + (p.views || 0), 0
    );
    this.stats.flaggedCount = this.posts.filter(p => p.isFlagged).length;

    const cats: Record<string, number> = {};
    this.posts.forEach(p => {
      if (!p.category) return;
      cats[p.category] = (cats[p.category] || 0) + 1;
    });
    const keys = Object.keys(cats);
    this.stats.topCategory = keys.length
      ? keys.reduce((a, b) => cats[a] > cats[b] ? a : b)
      : 'N/A';
  }

  setView(view: 'stats' | 'oversight' | 'moderation'): void {
    this.currentView = view;
    this.searchQuery = '';
    this.showFlaggedOnly = false;
  }

  get filteredPosts(): Post[] {
    let list = [...this.posts];

    if (this.currentView === 'moderation') {
      list = list.filter(p => p.isFlagged);
    }

    if (this.currentView === 'oversight' && this.showFlaggedOnly) {
      list = list.filter(p => p.isFlagged);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q) ||
        p.user?.fullName?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  toggleFlag(post: Post): void {
    this.forumService.updatePost(post.id!, { ...post, isFlagged: !post.isFlagged }).subscribe({
      next: () => {
        this.notificationService.success(post.isFlagged ? 'Post unflagged.' : 'Post flagged.');
        this.loadData();
      },
      error: () => {
        this.notificationService.error('Failed to update post status.');
        this.cdr.detectChanges();
      }
    });
  }
  deletePost(id: number): void {
    if (!confirm('Are you sure you want to delete this post?')) return;

    const targetId = Number(id);
    
    // Optimistic UI update
    this.posts = this.posts.filter(p => p.id != targetId);
    this.computeStats();
    this.notificationService.success('Post deleted.');
    this.cdr.detectChanges();

    this.forumService.deletePost(targetId).subscribe({
      next: () => {
        // Success - UI already updated
      },
      error: (err) => {
        if (err.status !== 204 && err.status !== 200) {
          this.notificationService.error('Failed to delete post on server.');
          this.loadData();
        }
      }
    });
  }
}