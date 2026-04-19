import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef, NgZone, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ForumService } from '../../services/forum.service';
import { Post } from '../../services/forum.models';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CommunityComponent implements OnInit, AfterViewInit, OnDestroy {

  posts: Post[] = [];
  currentUserEmail: string | null = null;
  editingPostId: number | null = null;
  editPostContent = '';
  loading = false;
  isLoggedIn = false;

  showForm = false;
  newPost: Partial<Post> = {
    title: '',
    content: '',
    category: 'DISCUSSION'
  };

  toxicError = '';

  constructor(
    private forumService: ForumService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn;
    this.currentUserEmail = this.authService.currentUserEmail;
    this.loadPosts();
  }

  ngAfterViewInit(): void {

    // ── Universal Scroll-Typewriter: any element with data-tw types in when visible ──
    const typewriteEl = (el: HTMLElement) => {
      const text = el.getAttribute('data-tw') || '';
      if (!text || el.classList.contains('tw-done')) return;
      el.classList.add('tw-done');
      el.textContent = '';

      const charSpeed = text.length > 20 ? 30 : 45;
      let i = 0;
      const tick = () => {
        if (i <= text.length) {
          el.textContent = text.substring(0, i);
          i++;
          setTimeout(tick, charSpeed);
        }
      };
      tick();
    };

    const twObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            typewriteEl(entry.target as HTMLElement);
            twObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    setTimeout(() => {
      document.querySelectorAll('[data-tw]').forEach(el => twObserver.observe(el));
    }, 600);
  }

  ngOnDestroy(): void {}

  likePost(id?: number) {
    if (!this.isLoggedIn || !id) return;
    this.forumService.likePost(id).subscribe({
      next: (updated) => {
        const index = this.posts.findIndex(p => p.id === id);
        if (index > -1) this.posts[index].likes = updated.likes;
      }
    });
  }

  deletePost(id: number, event: Event) {
    event.stopPropagation();
    event.preventDefault(); // Prevents the router link
    if (!confirm('Are you sure you want to delete this discussion?')) return;
    
    this.forumService.deletePost(id).subscribe(() => {
      this.posts = this.posts.filter(p => p.id !== id);
      this.cdr.markForCheck();
    });
  }

  startEdit(post: Post, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.editingPostId = post.id!;
    this.editPostContent = post.content;
  }

  cancelEdit(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.editingPostId = null;
  }

  saveEdit(post: Post, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    if (!this.editPostContent.trim()) return;

    this.forumService.updatePost(post.id!, { ...post, content: this.editPostContent }).subscribe({
      next: (updated) => {
        post.content = updated.content;
        this.editingPostId = null;
        this.cdr.markForCheck();
      }
    });
  }

  loadPosts() {
    this.loading = true;
    this.forumService.getAllPosts().subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.posts = (data || []).sort((a,b) => 
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.markForCheck();
        });
      }
    });
  }

  submitPost() {
    this.toxicError = '';
    if(!this.newPost.title || !this.newPost.content) return;

    this.forumService.createPost(this.newPost).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.showForm = false;
          this.newPost = { title: '', content: '', category: 'DISCUSSION' };
          this.loadPosts();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          if(err.error && typeof err.error === 'string' && err.error.includes('bloqué')) {
            this.toxicError = err.error;
          } else {
            this.toxicError = 'An error occurred while posting.';
          }
          this.cdr.markForCheck();
        });
      }
    });
  }



  formatDate(d?: string) {
    if(!d) return '';
    return new Date(d).toLocaleDateString();
  }
}
