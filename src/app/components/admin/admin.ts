import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService, AdminCreateUserRequest, AdminUpdateUserRequest, AdminUserListItem } from '../../services/admin.service';
import { AuthService, UserResponse } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { FormationService } from '../../services/formation.service';
import { ForumService } from '../../services/forum.service';
import { MessagerieService, ConversationSummary, DirectMessage, TopicCounts } from '../../services/messagerie.service';
import { NotificationService } from '../../services/notification.service';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminProductsComponent } from './admin-products/admin-products.component';
import { AdminFormationsComponent } from './admin-formations/admin-formations.component';
import { AdminForumComponent } from './admin-forum/admin-forum.component';
import { AdminEventsComponent } from '../admin-events/Admin events.component';
import { AdminReservationsComponent } from '../admin-events/Admin reservations.component';
import { AnomalyDetectorComponent } from '../events/Anomaly detector.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminUsersComponent,
    AdminProductsComponent,
    AdminFormationsComponent,
    AdminForumComponent,
    AdminEventsComponent,
    AdminReservationsComponent,
    AnomalyDetectorComponent
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit, OnDestroy, AfterViewInit {

  private static readonly USERS_CACHE_KEY = 'vero_admin_users_cache';
  private static readonly CONVS_CACHE_KEY = 'vero_admin_convs_cache';

  // ── Users state ───────────────────────────────────────────────────────────
  users: AdminUserListItem[] = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.users ?? [];
  loading = this.users.length === 0;
  error = '';
  totalUsers = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.total ?? 0;
  currentPage = 1;
  usersPerPage = 10;
  totalPages = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.pages ?? 0;
  searchQuery = '';
  selectedRole = '';

  // ── Tab & UI state ────────────────────────────────────────────────────────
activeTab:
    | 'users'
    | 'add'
    | 'settings'
    | 'edit'
    | 'messages'
    | 'products'
    | 'events'
    | 'reservations'
    | 'anomaly'
    | 'formations'
    | 'forum' = 'users';

  successMessage = '';
  errorMessage = '';
  confirmDeleteId: number | null = null;
  editingUserId: number | null = null;
  editUserForm: AdminUpdateUserRequest = {};
  eventsMenuOpen = true;
  pendingReservationCount = 0;

  // ── New user form ─────────────────────────────────────────────────────────
  newUser: AdminCreateUserRequest = {
    fullName: '',
    email: '',
    password: '',
    role: 'USER',
    verified: true,
    banned: false
  };
  addLoading = false;
  addMessage = '';

  // ── Profile & stats ───────────────────────────────────────────────────────
  adminMe: UserResponse | null = null;
  userCount = 0;
  productCount = 0;
  formationCount = 0;
  forumStats = { totalPosts: 0, flaggedCount: 0 };

  // ── Dashboard helpers ─────────────────────────────────────────────────────
  currentDate: string = '';
  currentMonth: string = '';
  calendarDates: { num: number; isToday: boolean }[] = [];

  // ── Conversations & heatmap ───────────────────────────────────────────────
  conversationSearch = '';
  adminConversations: ConversationSummary[] = Admin.readCache<ConversationSummary[]>(Admin.CONVS_CACHE_KEY) ?? [];
  topicHeatmap: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
  selectedConversation: ConversationSummary | null = null;
  selectedConversationMessages: DirectMessage[] = [];
  messagesLoading = this.adminConversations.length === 0;
  threadLoading = false;

  // ── Private internals ─────────────────────────────────────────────────────
  private selectedConversationRequestKey = '';
  private selectedConversationRequestId = 0;
  private usersLoadRequestId = 0;
  private conversationsLoadRequestId = 0;
  private adminLiveSyncInterval: ReturnType<typeof setInterval> | null = null;
  private usersLiveSyncInterval: ReturnType<typeof setInterval> | null = null;
  private search$ = new Subject<string>();
  private adminMessageSub?: Subscription;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private productService: ProductService,
    private formationService: FormationService,
    private forumService: ForumService,
    private messagerieService: MessagerieService,
    private route: ActivatedRoute,
    private router: Router,
    private el: ElementRef
  ) {}

  // ── Cache helpers ─────────────────────────────────────────────────────────
  private static readCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }

  private static writeCache(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota or private mode — ignore */ }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this._initDateHelpers();

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadUsers();
    });

    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'products') {
        this.setTab('products');
      } else if (params['tab'] === 'formations') {
        this.setTab('formations');
      } else if (params['tab'] === 'events') {
        this.setTab('events');
      } else if (params['tab'] === 'reservations' || params['tab'] === 'bookings') {
        this.setTab('reservations');
      } else if (params['tab'] === 'anomaly') {
        this.setTab('anomaly');
      }
    });

    const url = this.router.url;
    if (url.includes('/admin/events')) {
      this.activeTab = 'events';
      this.eventsMenuOpen = true;
    } else if (url.includes('/admin/reservations')) {
      this.activeTab = 'reservations';
      this.eventsMenuOpen = true;
    } else if (url.includes('/admin/anomaly')) {
      this.activeTab = 'anomaly';
      this.eventsMenuOpen = true;
    }

    this.loadUsers();
    this.startUsersLiveSync();
    this.loadAdminConversations();
    this.loadTopicHeatmap();

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

    this.adminMessageSub = this.messagerieService.adminIncoming$.subscribe((message) => {
      if (!message) return;
      this.upsertConversationFromMessage(message);
      this.showDesktopMessageNotification(message.sender.fullName, message.content);
      const label = (message.topic ?? null) as keyof TopicCounts | null;
      if (label && this.topicHeatmap[label] != null) {
        this.topicHeatmap = { ...this.topicHeatmap, [label]: this.topicHeatmap[label] + 1 };
      }
      if (!this.selectedConversation && this.activeTab === 'messages' && this.adminConversations.length > 0) {
        this.openAdminConversation(this.adminConversations[0]);
        return;
      }
      if (this.selectedConversation && this.belongsToSelectedConversation(message, this.selectedConversation)) {
        this.selectedConversationMessages = [...this.selectedConversationMessages, message];
      } else if (this.activeTab === 'messages') {
        this.loadAdminConversations();
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this._animateCounter('stat-card-users', this.userCount);
      this._animateCounter('stat-card-formations', this.formationCount);
      this._animateCounter('stat-card-products', this.productCount);
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    }, 1000);
  }

  ngOnDestroy(): void {
    this.search$.complete();
    this.adminMessageSub?.unsubscribe();
    if (this.adminLiveSyncInterval != null) {
      clearInterval(this.adminLiveSyncInterval);
      this.adminLiveSyncInterval = null;
    }
    this.stopUsersLiveSync();
  }

  // ── Dashboard stats ───────────────────────────────────────────────────────
  private _loadDashboardStats(): void {
    this.adminService.getUsers(0, 1).subscribe(data => {
      this.userCount = data.totalElements;
      this._animateCounter('stat-card-users', this.userCount);
    });

    this.productService.getAll().subscribe(products => {
      this.productCount = products.length;
      this._animateCounter('stat-card-products', this.productCount);
    });

    this.formationService.getAll().subscribe(formations => {
      this.formationCount = formations.length;
      this._animateCounter('stat-card-formations', this.formationCount);
    });

    this.forumService.getAllPosts().subscribe(posts => {
      this.forumStats.totalPosts = posts.length;
      this.forumStats.flaggedCount = posts.filter((p: any) => p.isFlagged).length;
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    });
  }

  private _animateCounter(cardId: string, target: number): void {
    const card = document.getElementById(cardId);
    if (!card) return;
    const span = card.querySelector<HTMLElement>('.vc-stat-number-inner');
    if (!span) return;
    if (target === 0) { span.textContent = '0'; return; }

    const duration = 1200;
    const startTime = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration);
      const progress = easeOut(elapsed / duration);
      span.textContent = Math.round(progress * target).toLocaleString();
      if (elapsed < duration) requestAnimationFrame(tick);
      else span.textContent = target.toLocaleString();
    };

    requestAnimationFrame(tick);
  }

  // ── Live sync ─────────────────────────────────────────────────────────────
  private startUsersLiveSync(): void {
    this.stopUsersLiveSync();
    this.usersLiveSyncInterval = setInterval(() => {
      this.loadUsers();
    }, 30000);
  }

  private stopUsersLiveSync(): void {
    if (this.usersLiveSyncInterval != null) {
      clearInterval(this.usersLiveSyncInterval);
      this.usersLiveSyncInterval = null;
    }
  }

  private startAdminLiveSync(): void {
    if (this.adminLiveSyncInterval != null) return;
    this.adminLiveSyncInterval = setInterval(() => {
      this.loadAdminConversations();
    }, 15000);
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  loadUsers(): void {
    const requestId = ++this.usersLoadRequestId;
    this.loading = this.users.length === 0;
    this.error = '';

    this.adminService.getUsers(
      this.currentPage - 1,
      this.usersPerPage,
      this.searchQuery,
      this.selectedRole
    ).subscribe({
      next: (data) => {
        if (this.usersLoadRequestId !== requestId) return;
        this.users = data.content ?? [];
        this.totalUsers = data.totalElements ?? this.users.length;
        this.totalPages = Math.max(data.totalPages ?? 0, 1);
        this.currentPage = (data.number ?? 0) + 1;
        this.loading = false;
        if (!this.searchQuery && !this.selectedRole && this.currentPage === 1) {
          Admin.writeCache(Admin.USERS_CACHE_KEY, {
            users: this.users,
            total: this.totalUsers,
            pages: this.totalPages
          });
        }
      },
      error: () => {
        if (this.usersLoadRequestId !== requestId) return;
        this.error = 'Failed to load users. Are you an admin?';
        this.loading = false;
      }
    });
  }

  onSearchChange(): void { this.search$.next(this.searchQuery.trim()); }
  onRoleFilterChange(): void { this.currentPage = 1; this.loadUsers(); }
  onPageSizeChange(): void { this.currentPage = 1; this.loadUsers(); }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadUsers();
    }
  }

  startEdit(user: AdminUserListItem): void {
    this.addMessage = '';
    this.editingUserId = user.id;
    this.editUserForm = {
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      verified: user.verified,
      banned: user.banned
    };
    this.activeTab = 'edit';
  }

  cancelEdit(): void {
    this.editingUserId = null;
    this.activeTab = 'users';
  }

  saveEdit(id: number): void {
    const payload = { ...this.editUserForm };
    const index = this.users.findIndex(user => user.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...payload, id } as AdminUserListItem;
    }
    this.editingUserId = null;
    this.setTab('users');
    this.adminService.updateUser(id, payload).subscribe({
      next: () => this.showSuccess('User profile updated.'),
      error: () => { this.showError('Error updating user profile.'); this.loadUsers(); }
    });
  }

  toggleBan(user: AdminUserListItem): void {
    const isBanned = user.banned;
    const req = isBanned
      ? this.adminService.unbanUser(user.id)
      : this.adminService.banUser(user.id);
    req.subscribe({
      next: () => {
        user.banned = !isBanned;
        this.showSuccess(isBanned ? 'User successfully unbanned!' : 'User access suspended!');
      },
      error: (err) => this.showError('Failed to alter ban status: ' + (err?.error?.message || err.message))
    });
  }

  requestDelete(id: number): void { this.confirmDeleteId = id; }
  cancelDelete(): void { this.confirmDeleteId = null; }

  confirmDelete(): void {
    if (!this.confirmDeleteId) return;
    const id = this.confirmDeleteId;
    this.confirmDeleteId = null;

    const previousUsers = this.users;
    const previousTotal = this.totalUsers;
    this.users = this.users.filter(user => user.id !== id);
    this.totalUsers = Math.max(this.totalUsers - 1, 0);
    this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);

    this.adminService.deleteUser(id).subscribe({
      next: () => {
        this.showSuccess('Account permanently deleted.');
        if (this.users.length === 0 && this.currentPage > 1) {
          this.currentPage -= 1;
          this.loadUsers();
        }
      },
      error: (err) => {
        this.users = previousUsers;
        this.totalUsers = previousTotal;
        this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);
        this.showError(err?.error?.message || 'Database Constraint: Cannot delete user because they have active platform data.');
      }
    });
  }

  createUser(): void {
    const payload = { ...this.newUser };
    this.newUser = { fullName: '', email: '', password: '', role: 'USER', verified: true, banned: false };
    this.setTab('users');
    this.adminService.createUser(payload).subscribe({
      next: () => { this.loadUsers(); this.showSuccess('New user account provisioned.'); },
      error: (err) => this.showError(err?.error?.message || 'Failed to create user account.')
    });
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  setTab(tab: string): void {
    this.activeTab = tab as any;
    this.addMessage = '';

    const routeMap: Record<string, string> = {
      users: '/admin/users',
      add: '/admin/users/new',
      messages: '/admin/messages',
      products: '/admin/products',
      formations: '/admin/formations',
      events: '/admin/events',
      reservations: '/admin/reservations',
      anomaly: '/admin/anomaly'
    };

    const targetUrl = routeMap[tab];
    if (targetUrl && this.router.url !== targetUrl) {
      this.router.navigateByUrl(targetUrl);
    }

    if (tab === 'users' || tab === 'add' || tab === 'edit') {
      this.loadUsers();
      this.startUsersLiveSync();
      if (this.adminLiveSyncInterval != null) {
        clearInterval(this.adminLiveSyncInterval);
        this.adminLiveSyncInterval = null;
      }
    } else if (tab === 'messages') {
      this.stopUsersLiveSync();
      this.loadAdminConversations();
      this.startAdminLiveSync();
    } else {
      if (this.adminLiveSyncInterval != null) {
        clearInterval(this.adminLiveSyncInterval);
        this.adminLiveSyncInterval = null;
      }
      this.stopUsersLiveSync();
    }
  }

  toggleEventsMenu(): void {
    this.eventsMenuOpen = !this.eventsMenuOpen;
  }

  // ── Conversations ─────────────────────────────────────────────────────────
  loadAdminConversations(): void {
    const requestId = ++this.conversationsLoadRequestId;
    this.messagesLoading = this.adminConversations.length === 0;

    this.messagerieService.loadAdminConversations(this.conversationSearch).subscribe({
      next: (conversations) => {
        if (this.conversationsLoadRequestId !== requestId) return;
        this.adminConversations = conversations;
        this.messagesLoading = false;
        if (!this.conversationSearch) {
          Admin.writeCache(Admin.CONVS_CACHE_KEY, conversations);
        }
        this.preloadAdminVisibleHistories(conversations);
        if (!this.selectedConversation && conversations.length > 0) {
          this.openAdminConversation(conversations[0]);
        }
      },
      error: () => {
        if (this.conversationsLoadRequestId !== requestId) return;
        this.messagesLoading = false;
        this.showError('Failed to load conversations.');
      }
    });
  }

  filterConversations(): void {
    this.loadAdminConversations();
  }

  loadTopicHeatmap(): void {
    this.messagerieService.loadTopicHeatmap().subscribe({
      next: (counts) => (this.topicHeatmap = counts),
      error: () => { /* heatmap is optional — swallow */ }
    });
  }

  get topicHeatmapTotal(): number {
    const h = this.topicHeatmap;
    return (h.eco || 0) + (h.lifestyle || 0) + (h.product || 0) + (h.other || 0);
  }

  topicPercent(label: keyof TopicCounts): number {
    const total = this.topicHeatmapTotal;
    if (!total) return 0;
    return Math.round((this.topicHeatmap[label] / total) * 100);
  }

  openAdminConversation(conversation: ConversationSummary): void {
    this.selectedConversation = conversation;
    const requestKey = conversation.conversationKey;
    this.selectedConversationRequestKey = requestKey;
    const requestId = ++this.selectedConversationRequestId;
    this.threadLoading = true;

    this.messagerieService.loadAdminHistoryCached(conversation.userA.id, conversation.userB.id).subscribe({
      next: (messages) => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) return;
        this.selectedConversationMessages = messages;
        this.threadLoading = false;
      },
      error: () => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) return;
        this.threadLoading = false;
        this.showError('Failed to load this conversation.');
      }
    });
  }

  onAdminConversationPointerDown(conversation: ConversationSummary): void {
    this.openAdminConversation(conversation);
  }

  private preloadAdminVisibleHistories(conversations: ConversationSummary[]): void {
    conversations.slice(0, 5).forEach(conv => {
      this.messagerieService.loadAdminHistoryCached(conv.userA.id, conv.userB.id).subscribe();
    });
  }

  private upsertConversationFromMessage(message: DirectMessage): void {
    const key = (message as any).conversationKey
      ?? [(message.sender.id), (message as any).receiver?.id].sort().join('-');
    const existing = this.adminConversations.find(c => c.conversationKey === key);
    if (existing) {
      existing.lastMessagePreview = message.content;
      existing.lastMessageTime = message.timestamp;
      this.adminConversations = [
        existing,
        ...this.adminConversations.filter(c => c.conversationKey !== key)
      ];
    } else {
      this.loadAdminConversations();
    }
  }

  private belongsToSelectedConversation(message: DirectMessage, conv: ConversationSummary): boolean {
    const ids = new Set([conv.userA.id, conv.userB.id]);
    return ids.has(message.sender.id) && ((message as any).receiver == null || ids.has((message as any).receiver.id));
  }

  // ── Computed getters ──────────────────────────────────────────────────────
  get suspendedOnPage(): number {
    return this.users.filter(user => user.banned).length;
  }

  get monitoredConversationCount(): number {
    return this.adminConversations.length;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  private _initDateHelpers(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
    this.currentMonth = now.toLocaleDateString('en-US', {
      month: 'long', year: 'numeric'
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

  private showDesktopMessageNotification(senderName: string, content: string): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const body = content.length > 90 ? `${content.slice(0, 87)}...` : content;
    const notification = new Notification('Nouveau message (Admin)', {
      body: `${senderName}: ${body}`
    });
    notification.onclick = () => {
      window.focus();
      this.setTab('messages');
    };
  }

  showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 4000);
  }

  showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = '';
    setTimeout(() => this.errorMessage = '', 6000);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}