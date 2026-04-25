import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, timeout, catchError, of } from 'rxjs';
import { AdminService, AdminCreateUserRequest, AdminUpdateUserRequest, AdminUserListItem } from '../../services/admin.service';
import { AuthService, UserResponse } from '../../services/auth.service';
import { MessagerieService, ConversationSummary, DirectMessage, TopicCounts } from '../../services/messagerie.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { FormationService } from '../../services/formation.service';
import { SessionService } from '../../services/session.service';
import { Product } from '../../services/product.models';
import { Formation, FormationResource, FormationStatus, Session, SessionStatus } from '../../services/formation.models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
})
export class Admin implements OnInit, OnDestroy {
  private static readonly USERS_CACHE_KEY = 'vero_admin_users_cache';
  private static readonly CONVS_CACHE_KEY = 'vero_admin_convs_cache';

  users: AdminUserListItem[] = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.users ?? [];
  loading = this.users.length === 0;
  error = '';
  totalUsers = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.total ?? 0;

  currentPage = 1;
  usersPerPage = 10;
  totalPages = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.pages ?? 0;

  searchQuery = '';
  selectedRole = '';

  activeTab: 'users' | 'add' | 'settings' | 'edit' | 'messages' | 'products' | 'formations' = 'users';

  // ── Products ──────────────────────────────────────────────────────────────
  products: Product[] = [];
  productsLoading = false;
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '', description: '', price: 0, stock: 0,
    category: 'NATURAL_COSMETICS', image: '', origin: '', isEcological: true
  };
  productSaving = false;
  // Local image cache: productId -> base64 image (persisted across reloads)
  productImageCache = new Map<number, string>();

  private loadImageCache(): void {
    try {
      const raw = localStorage.getItem('vero_product_images');
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, string>;
        Object.entries(obj).forEach(([k, v]) => this.productImageCache.set(Number(k), v));
      }
    } catch { /* ignore */ }
  }

  private saveImageCache(): void {
    try {
      const obj: Record<string, string> = {};
      this.productImageCache.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem('vero_product_images', JSON.stringify(obj));
    } catch { /* quota exceeded */ }
  }

  getProductImage(p: Product): string | null {
    return this.productImageCache.get(p.id) ?? p.image ?? null;
  }

  readonly productCategories = [
    'NATURAL_COSMETICS','ECO_FRIENDLY_HOME','SUSTAINABLE_FASHION',
    'KITCHEN_AND_DINING','ECO_GARDENING','ECO_PET_PRODUCTS','ECO_GIFT_SETS'
  ];

  readonly countries = [
    { name: 'Tunisia', flag: '🇹🇳' }, { name: 'France', flag: '🇫🇷' },
    { name: 'Italy', flag: '🇮🇹' }, { name: 'Spain', flag: '🇪🇸' },
    { name: 'Germany', flag: '🇩🇪' }, { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Netherlands', flag: '🇳🇱' }, { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Switzerland', flag: '🇨🇭' }, { name: 'Austria', flag: '🇦🇹' },
    { name: 'Greece', flag: '🇬🇷' }, { name: 'Turkey', flag: '🇹🇷' },
    { name: 'Morocco', flag: '🇲🇦' }, { name: 'Algeria', flag: '🇩🇿' },
    { name: 'Egypt', flag: '🇪🇬' }, { name: 'USA', flag: '🇺🇸' },
    { name: 'Canada', flag: '🇨🇦' }, { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Brazil', flag: '🇧🇷' }, { name: 'Argentina', flag: '🇦🇷' },
    { name: 'UK', flag: '🇬🇧' }, { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Sweden', flag: '🇸🇪' }, { name: 'Norway', flag: '🇳🇴' },
    { name: 'Denmark', flag: '🇩🇰' }, { name: 'Finland', flag: '🇫🇮' },
    { name: 'Poland', flag: '🇵🇱' }, { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Romania', flag: '🇷🇴' }, { name: 'Japan', flag: '🇯🇵' },
    { name: 'China', flag: '🇨🇳' }, { name: 'South Korea', flag: '🇰🇷' },
    { name: 'India', flag: '🇮🇳' }, { name: 'Thailand', flag: '🇹🇭' },
    { name: 'Vietnam', flag: '🇻🇳' }, { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Australia', flag: '🇦🇺' }, { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'South Africa', flag: '🇿🇦' }, { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Local', flag: '🌍' }
  ];

  // ── Formations ────────────────────────────────────────────────────────────
  formations: Formation[] = [];
  formationsLoading = false;
  showFormationModal = false;
  editingFormation: Formation | null = null;
  formationForm = { title: '', description: '', duration: 0, maxCapacity: 0, price: 0, status: 'PLANNED' as FormationStatus };

  // ── Sessions ──────────────────────────────────────────────────────────────
  selectedFormationForSessions: Formation | null = null;
  sessions: Session[] = [];
  sessionsLoading = false;
  showSessionModal = false;
  editingSession: Session | null = null;
  sessionForm = { title: '', startDate: '', endDate: '', status: 'SCHEDULED' as SessionStatus, type: 'ONLINE' as 'ONLINE' | 'IN_PERSON', meetLink: '', trainerId: 0, formationId: 0 };
  successMessage = '';
  errorMessage = '';

  // ── Participants ──────────────────────────────────────────────────────────
  allUsers: any[] = [];
  expandedFormationId: number | null = null;

  // ── Resources ─────────────────────────────────────────────────────────────
  selectedResourceFile: File | null = null;
  resourceUploading = false;
  formationResources: FormationResource[] = [];

  // ── Quiz ──────────────────────────────────────────────────────────────────
  showQuizModal = false;
  generatingQuiz = false;
  showQuizPreviewModal = false;
  quizPreview: any = null;
  quizPreviewAnswers: Map<number, number> = new Map();
  quizPreviewSubmitting = false;
  quizPreviewResult: any = null;
  quizPreviewLoading = false;
  quizForm: {
    title: string;
    passingScore: number;
    questions: Array<{ text: string; options: Array<{ text: string; isCorrect: boolean }> }>;
  } = { title: '', passingScore: 80, questions: [] };

  // ── AI Description ────────────────────────────────────────────────────────
  generatingDescription = false;

  // ── Formation status lists ────────────────────────────────────────────────
  readonly formationStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
  readonly sessionStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  confirmDeleteId: number | null = null;
  editingUserId: number | null = null;
  editUserForm: AdminUpdateUserRequest = {};

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

  adminMe: UserResponse | null = null;
  conversationSearch = '';
  adminConversations: ConversationSummary[] = Admin.readCache<ConversationSummary[]>(Admin.CONVS_CACHE_KEY) ?? [];
  topicHeatmap: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
  selectedConversation: ConversationSummary | null = null;
  selectedConversationMessages: DirectMessage[] = [];
  messagesLoading = this.adminConversations.length === 0;
  threadLoading = false;
  private selectedConversationRequestKey = '';
  private selectedConversationRequestId = 0;
  private usersLoadRequestId = 0;
  private conversationsLoadRequestId = 0;
  private adminLiveSyncInterval: ReturnType<typeof setInterval> | null = null;
  private usersLiveSyncInterval: ReturnType<typeof setInterval> | null = null;

  private search$ = new Subject<string>();
  private adminMessageSub?: Subscription;

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private messagerieService: MessagerieService,
    private productService: ProductService,
    private orderService: OrderService,
    private userService: UserService,
    private notificationService: NotificationService,
    private formationService: FormationService,
    private sessionService: SessionService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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
    } catch {
      /* quota or private mode — ignore */
    }
  }

  ngOnInit(): void {
    this.loadImageCache();
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadUsers();
    });

    // Read ?tab= from navbar links
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'products') {
        this.setTab('products');
      } else if (params['tab'] === 'formations') {
        this.setTab('formations');
      }
    });

    this.loadUsers();
    this.startUsersLiveSync();
    this.loadAdminConversations();
    this.loadTopicHeatmap();
    this.loadAllUsers();

    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.messagerieService.connect(me.id, me.role === 'ADMIN');
        this.ensureNotificationPermission();
      },
      error: () => {
        // getMe failed (token expired or no session) — use cached user if available
        const cached = this.authService.currentUser;
        if (cached) {
          this.adminMe = cached;
        }
      }
    });

    this.adminMessageSub = this.messagerieService.adminIncoming$.subscribe((message) => {
      if (!message) {
        return;
      }
      this.upsertConversationFromMessage(message);
      this.showDesktopMessageNotification(message.sender.fullName, message.content);
      // New message → bump the heatmap count optimistically.
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
        // Keep monitor list in sync instantly even when another thread is open.
        this.loadAdminConversations();
      }
    });
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
        if (this.usersLoadRequestId !== requestId) {
          return;
        }
        this.users = data.content ?? [];
        this.totalUsers = data.totalElements ?? this.users.length;
        this.totalPages = Math.max(data.totalPages ?? 0, 1);
        this.currentPage = (data.number ?? 0) + 1;
        this.loading = false;
        // Cache first unfiltered page so next admin visit is instant.
        if (!this.searchQuery && !this.selectedRole && this.currentPage === 1) {
          Admin.writeCache(Admin.USERS_CACHE_KEY, {
            users: this.users,
            total: this.totalUsers,
            pages: this.totalPages
          });
        }
      },
      error: () => {
        if (this.usersLoadRequestId !== requestId) {
          return;
        }
        this.error = 'Failed to load users. Are you an admin?';
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.search$.next(this.searchQuery.trim());
  }

  onRoleFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

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
    // Optimistic update: apply to the visible row and flip back to the list right away.
    const index = this.users.findIndex(user => user.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...payload, id } as AdminUserListItem;
    }
    this.editingUserId = null;
    this.setTab('users');
    this.adminService.updateUser(id, payload).subscribe({
      next: () => this.showSuccess('User profile updated.'),
      error: () => {
        this.showError('Error updating user profile.');
        this.loadUsers();
      }
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

  requestDelete(id: number): void {
    this.confirmDeleteId = id;
  }

  cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  confirmDelete(): void {
    if (!this.confirmDeleteId) return;
    const id = this.confirmDeleteId;
    this.confirmDeleteId = null;

    // Optimistic: pull the row out of the list instantly, reconcile on response.
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
        // Rollback on failure.
        this.users = previousUsers;
        this.totalUsers = previousTotal;
        this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);
        this.showError(err?.error?.message || 'Database Constraint: Cannot delete user because they have active platform data.');
      }
    });
  }

  createUser(): void {
    const payload = { ...this.newUser };
    // Optimistic: flip back to the directory immediately, reset the form, fire-and-refresh.
    this.newUser = { fullName: '', email: '', password: '', role: 'USER', verified: true, banned: false };
    this.setTab('users');
    this.adminService.createUser(payload).subscribe({
      next: () => {
        this.loadUsers();
        this.showSuccess('New user account provisioned.');
      },
      error: (err) => this.showError(err?.error?.message || 'Failed to create user account.')
    });
  }

  setTab(tab: 'users' | 'add' | 'settings' | 'edit' | 'messages' | 'products' | 'formations'): void {
    this.activeTab = tab;
    this.addMessage = '';
    if (tab === 'users') {
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
    } else if (tab === 'products') {
      this.stopUsersLiveSync();
      this.loadProducts();
    } else if (tab === 'formations') {
      this.stopUsersLiveSync();
      this.loadFormations();
    } else if (this.adminLiveSyncInterval != null) {
      clearInterval(this.adminLiveSyncInterval);
      this.adminLiveSyncInterval = null;
      this.stopUsersLiveSync();
    }
  }

  loadProducts(): void {
    this.productsLoading = true;
    this.cdr.detectChanges();
    this.productService.getAll().pipe(
      timeout(15000),
      catchError(() => {
        this.showError('Products request timed out — restart the backend.');
        this.productsLoading = false;
        this.cdr.detectChanges();
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.products = data.map(p => ({ ...p, image: p.image && p.image.length > 200 ? null : p.image })) as any;
        this.productsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showError('Failed to load products.');
        this.productsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteProduct(id: number): void {
    if (!confirm('Delete this product?')) return;
    this.productService.delete(id).subscribe({
      next: () => { this.products = this.products.filter(p => p.id !== id); this.showSuccess('Product deleted.'); },
      error: () => this.showError('Failed to delete product.')
    });
  }

  openProductModal(product?: Product): void {
    this.editingProduct = product ?? null;
    if (product) {
      this.productForm = {
        name: product.name, description: product.description,
        price: product.price, stock: product.stock,
        category: product.category as string,
        image: this.productImageCache.get(product.id) ?? product.image ?? '',
        origin: product.origin ?? '',
        isEcological: product.isEcological
      };
    } else {
      this.productForm = { name: '', description: '', price: 0, stock: 0,
        category: 'NATURAL_COSMETICS', image: '', origin: '', isEcological: true };
    }
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.editingProduct = null;
  }

  onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const file = input.files[0];
    if (file.size > 500 * 1024) { this.showError('Image must be under 500KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { this.productForm.image = reader.result as string; };
    reader.readAsDataURL(file);
  }

  saveProduct(): void {
    if (!this.productForm.name.trim()) { this.showError('Name is required.'); return; }
    if (!this.productForm.price || this.productForm.price <= 0) { this.showError('Price must be > 0.'); return; }
    this.productSaving = true;
    const imageToCache = this.productForm.image;
    const payload: any = { ...this.productForm };
    if (this.editingProduct) {
      payload.id = this.editingProduct.id;
      this.productService.update(payload).subscribe({
        next: (updated) => {
          if (imageToCache) { this.productImageCache.set(updated.id, imageToCache); this.saveImageCache(); }
          const idx = this.products.findIndex(p => p.id === updated.id);
          if (idx !== -1) this.products[idx] = updated;
          this.products = [...this.products];
          this.showSuccess('Product updated.');
          this.closeProductModal();
          this.productSaving = false;
          this.cdr.detectChanges();
        },
        error: () => { this.showError('Failed to update product.'); this.productSaving = false; }
      });
    } else {
      this.productService.create(payload).subscribe({
        next: (created) => {
          if (imageToCache) { this.productImageCache.set(created.id, imageToCache); this.saveImageCache(); }
          this.products = [created, ...this.products];
          this.showSuccess('Product created.');
          this.closeProductModal();
          this.productSaving = false;
          this.cdr.detectChanges();
        },
        error: () => { this.showError('Failed to create product.'); this.productSaving = false; }
      });
    }
  }

  loadFormations(): void {
    this.formationsLoading = true;
    this.cdr.detectChanges();
    this.formationService.getAll().pipe(
      timeout(15000),
      catchError(() => {
        this.showError('Formations request timed out — restart the backend.');
        this.formationsLoading = false;
        this.cdr.detectChanges();
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.formations = data;
        this.formationsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showError('Failed to load formations.');
        this.formationsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteFormation(id: number): void {
    if (!confirm('Delete this formation?')) return;
    this.formationService.delete(id).subscribe({
      next: () => { this.formations = this.formations.filter(f => f.id !== id); this.showSuccess('Formation deleted.'); },
      error: () => this.showError('Failed to delete formation.')
    });
  }

  updateFormationStatus(id: number, status: FormationStatus): void {
    this.formationService.updateStatus(id, status).subscribe({
      next: () => { this.showSuccess('Status updated.'); this.loadFormations(); },
      error: () => this.showError('Failed to update status.')
    });
  }

  openFormationModal(formation?: Formation): void {
    if (formation) {
      this.editingFormation = formation;
      this.formationForm = { title: formation.title, description: formation.description, duration: formation.duration, maxCapacity: formation.maxCapacity, price: formation.price || 0, status: formation.status };
    } else {
      this.editingFormation = null;
      this.formationForm = { title: '', description: '', duration: 0, maxCapacity: 0, price: 0, status: 'PLANNED' as FormationStatus };
    }
    this.showFormationModal = true;
  }

  closeFormationModal(): void {
    this.showFormationModal = false;
    this.editingFormation = null;
  }

  saveFormation(): void {
    if (!this.formationForm.title.trim()) { this.showError('Title is required.'); return; }
    const data: any = { ...this.formationForm, pinned: false };
    if (this.editingFormation) {
      data.id = this.editingFormation.id;
      data.participantIds = this.editingFormation.participantIds || [];
      this.formationService.update(data).subscribe({
        next: () => { this.showSuccess('Formation updated.'); this.loadFormations(); this.closeFormationModal(); },
        error: () => this.showError('Failed to update formation.')
      });
    } else {
      this.formationService.create(data).subscribe({
        next: () => { this.showSuccess('Formation created.'); this.loadFormations(); this.closeFormationModal(); },
        error: () => this.showError('Failed to create formation.')
      });
    }
  }

  viewFormationSessions(formation: Formation): void {
    this.selectedFormationForSessions = formation;
    this.sessionsLoading = true;
    this.sessionService.getByFormation(formation.id!).subscribe({
      next: (s) => { this.sessions = s; this.sessionsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.showError('Failed to load sessions.'); this.sessionsLoading = false; }
    });
    this.loadResources(formation.id!);
  }

  closeSessionsView(): void {
    this.selectedFormationForSessions = null;
    this.sessions = [];
  }

  openSessionModal(session?: Session): void {
    if (!this.selectedFormationForSessions) return;
    // Reload users to ensure trainer list is fresh
    if (this.allUsers.length === 0) this.loadAllUsers();
    if (session) {
      this.editingSession = session;
      this.sessionForm = { title: session.title, startDate: session.startDate?.slice(0, 16) || '', endDate: session.endDate?.slice(0, 16) || '', status: session.status as SessionStatus, type: (session as any).type || 'ONLINE', meetLink: (session as any).meetLink || '', trainerId: session.trainerId || 0, formationId: this.selectedFormationForSessions.id! };
    } else {
      this.editingSession = null;
      this.sessionForm = { title: '', startDate: '', endDate: '', status: 'SCHEDULED' as SessionStatus, type: 'ONLINE', meetLink: '', trainerId: 0, formationId: this.selectedFormationForSessions.id! };
    }
    this.showSessionModal = true;
  }

  closeSessionModal(): void {
    this.showSessionModal = false;
    this.editingSession = null;
  }

  saveSession(): void {
    if (!this.sessionForm.title.trim()) { this.showError('Session title is required.'); return; }
    if (!this.sessionForm.startDate) { this.showError('Start date is required.'); return; }
    if (!this.sessionForm.endDate) { this.showError('End date is required.'); return; }

    // Auto-compute status from dates
    const now = new Date();
    const start = new Date(this.sessionForm.startDate);
    const end = new Date(this.sessionForm.endDate);
    let computedStatus: SessionStatus = 'SCHEDULED' as SessionStatus;
    if (now >= start && now <= end) computedStatus = 'IN_PROGRESS' as SessionStatus;
    else if (now > end) computedStatus = 'COMPLETED' as SessionStatus;

    const data: any = { ...this.sessionForm, status: computedStatus, type: 'ONLINE' };
    if (this.editingSession) {
      data.id = this.editingSession.id;
      this.sessionService.update(data).subscribe({
        next: () => { this.showSuccess('Session updated.'); this.viewFormationSessions(this.selectedFormationForSessions!); this.closeSessionModal(); },
        error: () => this.showError('Failed to update session.')
      });
    } else {
      this.sessionService.create(data, this.selectedFormationForSessions!.id!).subscribe({
        next: () => { this.showSuccess('Session created.'); this.viewFormationSessions(this.selectedFormationForSessions!); this.closeSessionModal(); },
        error: () => this.showError('Failed to create session.')
      });
    }
  }

  deleteSession(id: number): void {
    this.sessionService.delete(id).subscribe({
      next: () => { this.sessions = this.sessions.filter(s => s.id !== id); this.showSuccess('Session deleted.'); },
      error: () => this.showError('Failed to delete session.')
    });
  }

  onTabPointerDown(tab: 'users' | 'add' | 'settings' | 'edit' | 'messages' | 'products' | 'formations'): void {
    this.setTab(tab);
  }

  loadAdminConversations(): void {
    const requestId = ++this.conversationsLoadRequestId;
    this.messagesLoading = this.adminConversations.length === 0;

    this.messagerieService.loadAdminConversations(this.conversationSearch).subscribe({
      next: (conversations) => {
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
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
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
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
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) {
          return;
        }
        this.selectedConversationMessages = messages;
        this.threadLoading = false;
      },
      error: () => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) {
          return;
        }
        this.threadLoading = false;
        this.showError('Failed to load this conversation.');
      }
    });
  }

  onAdminConversationPointerDown(conversation: ConversationSummary): void {
    this.openAdminConversation(conversation);
  }



  get suspendedOnPage(): number {
    return this.users.filter((user) => user.banned).length;
  }

  get monitoredConversationCount(): number {
    return this.adminConversations.length;
  }
  initials(name: string | undefined): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  private belongsToSelectedConversation(message: DirectMessage, conversation: ConversationSummary): boolean {
    const ids = [message.sender.id, message.receiver.id].sort((a, b) => a - b);
    const selectedIds = [conversation.userA.id, conversation.userB.id].sort((a, b) => a - b);
    return ids[0] === selectedIds[0] && ids[1] === selectedIds[1];
  }

  private upsertConversationFromMessage(message: DirectMessage): void {
    const idA = Math.min(message.sender.id, message.receiver.id);
    const idB = Math.max(message.sender.id, message.receiver.id);
    const key = `${idA}_${idB}`;

    const summary: ConversationSummary = {
      conversationKey: key,
      userA: idA === message.sender.id ? message.sender : message.receiver,
      userB: idB === message.sender.id ? message.sender : message.receiver,
      lastMessagePreview: message.content.length > 80 ? `${message.content.slice(0, 77)}...` : message.content,
      lastMessageTime: message.timestamp,
      lastMessageSenderId: message.sender.id,
      messageCount: 1
    };

    const existingIndex = this.adminConversations.findIndex(item => item.conversationKey === key);
    if (existingIndex >= 0) {
      this.adminConversations.splice(existingIndex, 1);
    }
    this.adminConversations = [summary, ...this.adminConversations];
    this.messagesLoading = false;
  }

  private preloadAdminVisibleHistories(conversations: ConversationSummary[]): void {
    const top = conversations.slice(0, 8);
    for (const conv of top) {
      this.messagerieService.preloadAdminHistory(conv.userA.id, conv.userB.id);
    }
  }

  private startAdminLiveSync(): void {
    if (this.adminLiveSyncInterval != null) {
      return;
    }
    this.adminLiveSyncInterval = setInterval(() => {
      if (this.activeTab !== 'messages') {
        return;
      }
      if (this.selectedConversation) {
        this.refreshSelectedConversationSilently(this.selectedConversation);
      }
    }, 1000);
  }

  private startUsersLiveSync(): void {
    if (this.usersLiveSyncInterval != null) {
      return;
    }
    this.usersLiveSyncInterval = setInterval(() => {
      if (this.activeTab !== 'users') {
        return;
      }
      this.refreshUsersSilently();
    }, 1000);
  }

  private stopUsersLiveSync(): void {
    if (this.usersLiveSyncInterval != null) {
      clearInterval(this.usersLiveSyncInterval);
      this.usersLiveSyncInterval = null;
    }
  }

  private refreshUsersSilently(): void {
    this.adminService.getUsers(
      this.currentPage - 1,
      this.usersPerPage,
      this.searchQuery,
      this.selectedRole
    ).subscribe({
      next: (data) => {
        if (this.activeTab !== 'users') {
          return;
        }
        this.users = data.content ?? [];
        this.totalUsers = data.totalElements ?? this.users.length;
        this.totalPages = Math.max(data.totalPages ?? 0, 1);
        this.currentPage = (data.number ?? 0) + 1;
        this.error = '';
        this.loading = false;
      }
    });
  }

  private refreshSelectedConversationSilently(conversation: ConversationSummary): void {
    if (this.threadLoading) {
      return;
    }
    const requestKey = conversation.conversationKey;
    this.messagerieService.loadAdminHistoryCached(conversation.userA.id, conversation.userB.id).subscribe({
      next: (messages) => {
        if (this.selectedConversationRequestKey !== requestKey) {
          return;
        }
        this.selectedConversationMessages = messages;
      }
    });
  }

  private ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }

  private showDesktopMessageNotification(senderName: string, content: string): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }
    const body = content.length > 90 ? `${content.slice(0, 87)}...` : content;
    const notification = new Notification(`Nouveau message (Admin)`, {
      body: `${senderName}: ${body}`
    });
    notification.onclick = () => {
      window.focus();
      this.setTab('messages');
    };
  }

  // ── Participants ──────────────────────────────────────────────────────────

  loadAllUsers(): void {
    this.userService.getAll().subscribe({
      next: (users) => { this.allUsers = users; },
      error: () => { /* non-critical */ }
    });
  }

  get trainers(): any[] {
    return this.allUsers.filter(u => u.role === 'TRAINER' || u.role === 'ADMIN' || u.role === 'USER');
  }

  getTrainerName(trainerId: number): string {
    const trainer = this.allUsers.find(u => u.id === trainerId);
    return trainer ? trainer.fullName : '—';
  }

  toggleParticipantsPanel(formationId: number): void {
    this.expandedFormationId = this.expandedFormationId === formationId ? null : formationId;
  }

  getParticipantDetails(participantIds: number[]): any[] {
    if (!participantIds || participantIds.length === 0) return [];
    return participantIds
      .map(id => this.allUsers.find(user => user.id === id))
      .filter(user => user !== undefined);
  }

  // ── Formation helpers ─────────────────────────────────────────────────────

  getFormationStatusClass(status: FormationStatus): string {
    const map: Record<string, string> = {
      'PLANNED': 'status-planned',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed'
    };
    return map[status] || 'status-planned';
  }

  getSessionStatusClass(status: SessionStatus): string {
    const map: Record<string, string> = {
      'SCHEDULED': 'status-scheduled',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return map[status] || 'status-scheduled';
  }

  getSessionStatusClassModern(status: SessionStatus): string {
    const map: Record<string, string> = {
      'SCHEDULED': 'status-upcoming',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return map[status] || 'status-upcoming';
  }

  getComputedSessionStatus(session: Session): string {
    const now = new Date();
    const start = new Date(session.startDate);
    const end = new Date(session.endDate);
    if ((session as any).status === 'CANCELLED') return 'CANCELLED';
    if (now < start) return 'SCHEDULED';
    if (now >= start && now <= end) return 'IN_PROGRESS';
    return 'COMPLETED';
  }

  getComputedSessionStatusLabel(session: Session): string {
    const now = new Date();
    const start = session.startDate ? new Date(session.startDate) : null;
    const end = session.endDate ? new Date(session.endDate) : null;
    if ((session as any).status === 'CANCELLED') return 'Cancelled';
    if (!start) return 'Upcoming';
    if (now < start) return 'Upcoming';
    if (end && now >= start && now <= end) return 'In Progress';
    return 'Done';
  }

  getComputedSessionStatusClass(session: Session): string {
    const s = this.getComputedSessionStatus(session);
    const map: Record<string, string> = {
      'SCHEDULED':   'status-upcoming',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED':   'status-completed',
      'CANCELLED':   'status-cancelled'
    };
    return map[s] || 'status-upcoming';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatDateShort(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatTimeOnly(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  togglePin(formation: Formation): void {
    this.formationService.togglePin(formation.id!).subscribe({
      next: (updated) => {
        formation.pinned = updated.pinned;
        this.formations.sort((a, b) => {
          if (a.pinned === b.pinned) return 0;
          return a.pinned ? -1 : 1;
        });
      },
      error: () => this.showError("Error toggling pin.")
    });
  }

  updateSessionStatus(id: number, status: SessionStatus): void {
    this.sessionService.updateStatus(id, status).subscribe({
      next: () => { this.showSuccess('Session status updated!'); this.viewFormationSessions(this.selectedFormationForSessions!); },
      error: () => this.showError('Error updating session status.')
    });
  }

  // ── Resources ─────────────────────────────────────────────────────────────

  onResourceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedResourceFile = input.files[0];
    }
  }

  uploadResource(formationId: number): void {
    if (!this.selectedResourceFile) { this.showError('Please select a file.'); return; }
    this.resourceUploading = true;
    this.formationService.uploadResource(formationId, this.selectedResourceFile).subscribe({
      next: () => {
        this.showSuccess('Resource uploaded successfully.');
        this.selectedResourceFile = null;
        this.resourceUploading = false;
        this.loadResources(formationId);
      },
      error: () => { this.showError('Error uploading resource.'); this.resourceUploading = false; }
    });
  }

  deleteResource(formationId: number, resourceId: number): void {
    if (!confirm('Delete this resource?')) return;
    this.formationService.deleteResource(formationId, resourceId).subscribe({
      next: () => { this.showSuccess('Resource deleted.'); this.loadResources(formationId); },
      error: () => this.showError('Error deleting resource.')
    });
  }

  loadResources(formationId: number): void {
    this.formationService.getResources(formationId).subscribe({
      next: (resources) => { this.formationResources = resources; },
      error: () => { /* non-critical */ }
    });
  }

  downloadResource(formationId: number, resourceId: number, fileName: string): void {
    this.formationService.downloadResource(formationId, resourceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.showError('Error downloading resource.')
    });
  }

  // ── AI Description ────────────────────────────────────────────────────────

  generateDescription(): void {
    if (!this.formationForm.title.trim()) { this.showError('Please enter a title first.'); return; }
    this.generatingDescription = true;
    this.formationService.generateDescription(this.formationForm.title, this.formationForm.duration).subscribe({
      next: (res) => { this.formationForm.description = res.description; this.generatingDescription = false; },
      error: () => { this.showError('Error generating description.'); this.generatingDescription = false; }
    });
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────

  generateQuizFromResources(): void {
    if (!this.selectedFormationForSessions) return;
    if (this.formationResources.length === 0) {
      this.showError('Upload resources for this formation first.');
      return;
    }
    this.generatingQuiz = true;
    this.formationService.generateQuizFromResources(this.selectedFormationForSessions.id!, 10).subscribe({
      next: () => {
        this.showSuccess('Quiz generated!');
        this.generatingQuiz = false;
        this.router.navigate(['/formations', this.selectedFormationForSessions!.id, 'quiz'], {
          queryParams: { preview: 'true', from: 'admin' }
        });
      },
      error: (err) => {
        this.showError(err?.error?.message || err?.message || 'Error generating quiz.');
        this.generatingQuiz = false;
      }
    });
  }

  openQuizPreview(formationId: number): void {
    this.quizPreviewLoading = true;
    this.quizPreviewAnswers = new Map();
    this.quizPreviewResult = null;
    this.showQuizPreviewModal = true;
    this.formationService.getQuizPreview(formationId).subscribe({
      next: (quiz) => { this.quizPreview = quiz; this.quizPreviewLoading = false; },
      error: () => { this.showError('Error loading quiz.'); this.showQuizPreviewModal = false; this.quizPreviewLoading = false; }
    });
  }

  closeQuizPreviewModal(): void {
    this.showQuizPreviewModal = false;
    this.quizPreview = null;
    this.quizPreviewAnswers = new Map();
    this.quizPreviewResult = null;
  }

  selectQuizPreviewOption(questionId: number, optionId: number): void {
    this.quizPreviewAnswers.set(questionId, optionId);
  }

  isQuizPreviewSelected(questionId: number, optionId: number): boolean {
    return this.quizPreviewAnswers.get(questionId) === optionId;
  }

  allQuizPreviewAnswered(): boolean {
    if (!this.quizPreview) return false;
    return this.quizPreviewAnswers.size === this.quizPreview.questions.length;
  }

  submitQuizPreview(): void {
    if (!this.allQuizPreviewAnswered() || !this.selectedFormationForSessions) return;
    this.quizPreviewSubmitting = true;
    const answers = Array.from(this.quizPreviewAnswers.entries()).map(([questionId, selectedOptionId]) => ({
      questionId, selectedOptionId
    }));
    this.formationService.submitQuiz(this.selectedFormationForSessions.id!, answers).subscribe({
      next: (result) => { this.quizPreviewResult = result; this.quizPreviewSubmitting = false; },
      error: () => { this.showError('Error submitting quiz.'); this.quizPreviewSubmitting = false; }
    });
  }

  openQuizModal(): void {
    this.quizForm = { title: '', passingScore: 80, questions: [] };
    this.showQuizModal = true;
  }

  closeQuizModal(): void {
    this.showQuizModal = false;
  }

  addQuestion(): void {
    this.quizForm.questions.push({ text: '', options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ]});
  }

  removeQuestion(index: number): void {
    this.quizForm.questions.splice(index, 1);
  }

  addOption(qIndex: number): void {
    this.quizForm.questions[qIndex].options.push({ text: '', isCorrect: false });
  }

  removeOption(qIndex: number, oIndex: number): void {
    this.quizForm.questions[qIndex].options.splice(oIndex, 1);
  }

  saveQuiz(formationId: number): void {
    if (!this.quizForm.title.trim()) { this.showError('Please enter a quiz title.'); return; }
    if (this.quizForm.questions.length === 0) { this.showError('Please add at least one question.'); return; }
    this.formationService.createQuiz(formationId, this.quizForm).subscribe({
      next: () => { this.showSuccess('Quiz created successfully.'); this.closeQuizModal(); },
      error: () => this.showError('Error creating quiz.')
    });
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
