import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ForumService } from '../../services/forum.service';
import { Post } from '../../services/forum.models';
import { FadeInDirective } from '../../fade-in.directive';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FadeInDirective],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css'
})
export class CommunityComponent implements OnInit {
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
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn;
    this.currentUserEmail = this.authService.currentUserEmail;
    this.loadPosts();
  }

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
    
    // Removed native window.confirm() because some browsers/extensions silently block it, 
    // causing the entire function to crash.
    
    this.forumService.deletePost(id).subscribe({
      next: () => {
        this.posts = this.posts.filter(p => p.id !== id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.toastService.show('Deletion Failed', err.error?.message || err.message, 'alert');
      }
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
