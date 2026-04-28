import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
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
  @Input() activeTab: string = 'forum';
  @Output() tabChange = new EventEmitter<string>();

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
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.forumService.getAllPosts().subscribe({
      next: (data) => {
        this.posts = data;
        this.computeStats();
        this.loading = false;
      },
      error: () => {
        this.notificationService.error('Failed to load forum data.');
        this.loading = false;
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
      error: () => this.notificationService.error('Failed to update post status.')
    });
  }

  deletePost(id: number): void {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    this.forumService.deletePost(id).subscribe({
      next: () => {
        this.notificationService.success('Post deleted.');
        this.loadData();
      },
      error: () => this.notificationService.error('Failed to delete post.')
    });
  }
}