import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ForumService } from '../../services/forum.service';
import { AuthService } from '../../services/auth.service';
import { Notification } from '../../services/forum.models';

export interface ToastNotification {
  id: number;
  message: string;
  type: string;
  visible: boolean;
  timeout?: any;
}

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount = 0;
  showDropdown = false;
  toasts: ToastNotification[] = [];
  private toastIdCounter = 0;
  private pollInterval: any;
  private wsSub?: Subscription;
  private authSub?: Subscription;

  constructor(
    private forumService: ForumService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
  }

  ngOnInit() {
    this.authSub = this.authService.roleStream$.subscribe(role => {
      const userId = this.authService.currentUserId;
      if (role && userId) {
        this.fetchNotifications();
        this.pollInterval ||= setInterval(() => this.fetchNotifications(), 30000);
        this.wsSub ||= this.forumService.subscribeToNotifications(userId).subscribe(n => this.handleNewNotification(n));
      } else {
        this.cleanup();
        this.notifications = [];
        this.toasts = [];
        this.unreadCount = 0;
        this.cdr.markForCheck();
      }
    });
  }

  private cleanup() {
    clearInterval(this.pollInterval);
    this.pollInterval = null;
    this.wsSub?.unsubscribe();
    this.wsSub = undefined;
    this.forumService.disconnectNotificationStomp();
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.cleanup();
  }

  fetchNotifications() {
    this.forumService.getUnreadNotifications().subscribe(nots => {
      this.notifications = nots.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.unreadCount = this.notifications.filter(n => !n.isRead).length;
      this.cdr.markForCheck();
    });
  }

  handleNewNotification(notif: Notification) {
    if (this.notifications.some(n => n.id === notif.id)) return;
    this.notifications.unshift(notif);
    if (!notif.isRead) this.unreadCount++;
    this.cdr.markForCheck();
    this.playNotificationSound();
    this.showToast(notif);
  }

  showToast(notif: Notification) {
    const toast: ToastNotification = { id: ++this.toastIdCounter, message: notif.message, type: notif.type, visible: false };
    this.toasts = [...this.toasts, toast];
    this.cdr.detectChanges();
    setTimeout(() => { toast.visible = true; this.cdr.detectChanges(); }, 50);
    toast.timeout = setTimeout(() => this.dismissToast(toast.id), 5000);
  }

  dismissToast(id: number) {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast) return;
    clearTimeout(toast.timeout);
    toast.visible = false;
    this.cdr.detectChanges();
    setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); this.cdr.detectChanges(); }, 400);
  }

  playNotificationSound() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.frequency.value = 600;
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    if (this.showDropdown) {
      this.fetchNotifications();
    }
  }

  markAsRead(n: Notification, event: Event) {
    event.stopPropagation();
    this.forumService.markNotificationAsRead(n.id).subscribe(() => {
      n.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.cdr.markForCheck();
    });
  }

  @HostListener('document:click')
  closeDropdown() {
    this.showDropdown = false;
  }
}
