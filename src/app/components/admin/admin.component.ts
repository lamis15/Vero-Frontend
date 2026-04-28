import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, timeout, catchError, of } from 'rxjs';

// ── Services ───────────────────────────────────────────────────
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

// ── Sous-composants IA ─────────────────────────────────────────
import { AdminDonationsComponent } from './admin-donation/admin-donations.component';
import { AdminPetitionsComponent } from './admin-petitions/admin-petitions.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminDonationsComponent,
    AdminPetitionsComponent,
    AdminPetitionsComponent,
AdminDonationsComponent
  ],
  templateUrl: './admin.component.html',
styleUrls: ['./admin.css', './admin.component.css'],
})
export class Admin implements OnInit, OnDestroy {
  private static readonly USERS_CACHE_KEY = 'vero_admin_users_cache';
  private static readonly CONVS_CACHE_KEY  = 'vero_admin_convs_cache';

  // ── Users ──────────────────────────────────────────────────
  users: AdminUserListItem[] = Admin.readCache<any>(Admin.USERS_CACHE_KEY)?.users ?? [];
  loading    = this.users.length === 0;
  error      = '';
  totalUsers = Admin.readCache<any>(Admin.USERS_CACHE_KEY)?.total ?? 0;
  currentPage  = 1;
  usersPerPage = 10;
  totalPages   = Admin.readCache<any>(Admin.USERS_CACHE_KEY)?.pages ?? 0;
  searchQuery  = '';
  selectedRole = '';

  // ── Tabs ───────────────────────────────────────────────────
  activeTab: 'users' | 'add' | 'settings' | 'edit' | 'messages'
           | 'products' | 'formations' | 'donations' | 'petitions' = 'users';

  successMessage = '';
  errorMessage   = '';

  // ── Modals ─────────────────────────────────────────────────
  confirmDeleteId: number | null = null;
  editingUserId:   number | null = null;
  editUserForm: AdminUpdateUserRequest = {};

  newUser: AdminCreateUserRequest = {
    fullName: '', email: '', password: '', role: 'USER', verified: true, banned: false
  };
  addLoading = false;
  addMessage  = '';

  // ── Conversations ──────────────────────────────────────────
  adminMe: UserResponse | null = null;
  conversationSearch   = '';
  adminConversations: ConversationSummary[] = Admin.readCache<ConversationSummary[]>(Admin.CONVS_CACHE_KEY) ?? [];
  topicHeatmap: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
  selectedConversation: ConversationSummary | null = null;
  selectedConversationMessages: DirectMessage[] = [];
  messagesLoading = this.adminConversations.length === 0;
  threadLoading   = false;

  private selectedConversationRequestKey = '';
  private selectedConversationRequestId  = 0;
  private usersLoadRequestId             = 0;
  private conversationsLoadRequestId     = 0;
  private adminLiveSyncInterval: ReturnType<typeof setInterval> | null = null;
  private usersLiveSyncInterval: ReturnType<typeof setInterval>  | null = null;
  private search$        = new Subject<string>();
  private adminMessageSub?: Subscription;

  // ── Products ───────────────────────────────────────────────
  products: Product[] = [];
  productsLoading = false;
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = { name: '', description: '', price: 0, stock: 0, category: 'NATURAL_COSMETICS', image: '', origin: '', isEcological: true };
  productSaving = false;
  productImageCache = new Map<number, string>();

  readonly productCategories = ['NATURAL_COSMETICS','ECO_FRIENDLY_HOME','SUSTAINABLE_FASHION','KITCHEN_AND_DINING','ECO_GARDENING','ECO_PET_PRODUCTS','ECO_GIFT_SETS'];
  readonly countries = [
    { name: 'Tunisia', flag: '🇹🇳' }, { name: 'France', flag: '🇫🇷' }, { name: 'Italy', flag: '🇮🇹' },
    { name: 'Spain', flag: '🇪🇸' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'Morocco', flag: '🇲🇦' },
    { name: 'USA', flag: '🇺🇸' }, { name: 'UK', flag: '🇬🇧' }, { name: 'Local', flag: '🌍' }
  ];

  // ── Formations ─────────────────────────────────────────────
  formations: Formation[] = [];
  formationsLoading = false;
  showFormationModal = false;
  editingFormation: Formation | null = null;
  formationForm = { title: '', description: '', duration: 0, maxCapacity: 0, price: 0, status: 'PLANNED' as FormationStatus };
  selectedFormationForSessions: Formation | null = null;
  sessions: Session[] = [];
  sessionsLoading = false;
  showSessionModal = false;
  editingSession: Session | null = null;
  sessionForm = { title: '', startDate: '', endDate: '', status: 'SCHEDULED' as SessionStatus, type: 'ONLINE' as 'ONLINE'|'IN_PERSON', meetLink: '', trainerId: 0, formationId: 0 };
  allUsers: any[] = [];
  expandedFormationId: number | null = null;
  selectedResourceFile: File | null = null;
  resourceUploading = false;
  formationResources: FormationResource[] = [];
  generatingQuiz = false;
  generatingDescription = false;
  showQuizPreviewModal = false;
  quizPreview: any = null;
  quizPreviewAnswers: Map<number, number> = new Map();
  quizPreviewSubmitting = false;
  quizPreviewResult: any = null;
  quizPreviewLoading = false;
  showQuizModal = false;
  quizForm: any = { title: '', passingScore: 80, questions: [] };
  readonly formationStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
  readonly sessionStatuses   = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

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
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : null; } catch { return null; }
  }
  private static writeCache(key: string, v: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }

  ngOnInit(): void {
    this.loadImageCache();
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => { this.currentPage = 1; this.loadUsers(); });
    this.route.queryParams.subscribe(p => {
      if (p['tab'] === 'products')   this.setTab('products');
      if (p['tab'] === 'formations') this.setTab('formations');
      if (p['tab'] === 'donations')  this.setTab('donations');
      if (p['tab'] === 'petitions')  this.setTab('petitions');
    });
    this.loadUsers();
    this.startUsersLiveSync();
    this.loadAdminConversations();
    this.loadTopicHeatmap();
    this.loadAllUsers();
    this.authService.getMe().subscribe({
      next: (me) => { this.adminMe = me; this.messagerieService.connect(me.id, me.role === 'ADMIN'); this.ensureNotificationPermission(); },
      error: () => { const c = this.authService.currentUser; if (c) this.adminMe = c; }
    });
    this.adminMessageSub = this.messagerieService.adminIncoming$.subscribe((msg) => {
      if (!msg) return;
      this.upsertConversationFromMessage(msg);
      this.showDesktopMessageNotification(msg.sender.fullName, msg.content);
      const label = (msg.topic ?? null) as keyof TopicCounts | null;
      if (label && this.topicHeatmap[label] != null) this.topicHeatmap = { ...this.topicHeatmap, [label]: this.topicHeatmap[label] + 1 };
      if (!this.selectedConversation && this.activeTab === 'messages' && this.adminConversations.length > 0) { this.openAdminConversation(this.adminConversations[0]); return; }
      if (this.selectedConversation && this.belongsToSelectedConversation(msg, this.selectedConversation)) this.selectedConversationMessages = [...this.selectedConversationMessages, msg];
      else if (this.activeTab === 'messages') this.loadAdminConversations();
    });
  }

  ngOnDestroy(): void {
    this.search$.complete();
    this.adminMessageSub?.unsubscribe();
    if (this.adminLiveSyncInterval) { clearInterval(this.adminLiveSyncInterval); this.adminLiveSyncInterval = null; }
    this.stopUsersLiveSync();
  }

  setTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
    this.addMessage = '';
    if (tab === 'users')       { this.loadUsers(); this.startUsersLiveSync(); if (this.adminLiveSyncInterval) { clearInterval(this.adminLiveSyncInterval); this.adminLiveSyncInterval = null; } }
    else if (tab === 'messages')   { this.stopUsersLiveSync(); this.loadAdminConversations(); this.startAdminLiveSync(); }
    else if (tab === 'products')   { this.stopUsersLiveSync(); this.loadProducts(); }
    else if (tab === 'formations') { this.stopUsersLiveSync(); this.loadFormations(); }
    else if (tab === 'donations' || tab === 'petitions') { this.stopUsersLiveSync(); }
    else { if (this.adminLiveSyncInterval) { clearInterval(this.adminLiveSyncInterval); this.adminLiveSyncInterval = null; } this.stopUsersLiveSync(); }
  }
  onTabPointerDown(tab: typeof this.activeTab): void { this.setTab(tab); }

  loadUsers(): void {
    const rid = ++this.usersLoadRequestId;
    this.loading = this.users.length === 0; this.error = '';
    this.adminService.getUsers(this.currentPage - 1, this.usersPerPage, this.searchQuery, this.selectedRole).subscribe({
      next: (d) => {
        if (this.usersLoadRequestId !== rid) return;
        this.users = d.content ?? []; this.totalUsers = d.totalElements ?? this.users.length;
        this.totalPages = Math.max(d.totalPages ?? 0, 1); this.currentPage = (d.number ?? 0) + 1; this.loading = false;
        if (!this.searchQuery && !this.selectedRole && this.currentPage === 1)
          Admin.writeCache(Admin.USERS_CACHE_KEY, { users: this.users, total: this.totalUsers, pages: this.totalPages });
      },
      error: () => { if (this.usersLoadRequestId !== rid) return; this.error = 'Failed to load users.'; this.loading = false; }
    });
  }
  onSearchChange()    { this.search$.next(this.searchQuery.trim()); }
  onRoleFilterChange(){ this.currentPage = 1; this.loadUsers(); }
  onPageSizeChange()  { this.currentPage = 1; this.loadUsers(); }
  goToPage(p: number){ if (p >= 1 && p <= this.totalPages && p !== this.currentPage) { this.currentPage = p; this.loadUsers(); } }
  startEdit(u: AdminUserListItem): void { this.editingUserId = u.id; this.editUserForm = { fullName: u.fullName, email: u.email, role: u.role, verified: u.verified, banned: u.banned }; this.activeTab = 'edit'; }
  cancelEdit(): void { this.editingUserId = null; this.activeTab = 'users'; }
  saveEdit(id: number): void {
    const p = { ...this.editUserForm };
    const i = this.users.findIndex(u => u.id === id);
    if (i !== -1) this.users[i] = { ...this.users[i], ...p, id } as AdminUserListItem;
    this.editingUserId = null; this.setTab('users');
    this.adminService.updateUser(id, p).subscribe({ next: () => this.showSuccess('User updated.'), error: () => { this.showError('Update failed.'); this.loadUsers(); } });
  }
  toggleBan(u: AdminUserListItem): void {
    (u.banned ? this.adminService.unbanUser(u.id) : this.adminService.banUser(u.id)).subscribe({
      next: () => { u.banned = !u.banned; this.showSuccess(u.banned ? 'User unbanned!' : 'User suspended!'); },
      error: (e) => this.showError('Failed: ' + (e?.error?.message || e.message))
    });
  }
  requestDelete(id: number){ this.confirmDeleteId = id; }
  cancelDelete(){ this.confirmDeleteId = null; }
  confirmDelete(): void {
    if (!this.confirmDeleteId) return;
    const id = this.confirmDeleteId; this.confirmDeleteId = null;
    const prev = this.users; const pt = this.totalUsers;
    this.users = this.users.filter(u => u.id !== id);
    this.totalUsers = Math.max(this.totalUsers - 1, 0); this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);
    this.adminService.deleteUser(id).subscribe({
      next: () => { this.showSuccess('Account deleted.'); if (this.users.length === 0 && this.currentPage > 1) { this.currentPage--; this.loadUsers(); } },
      error: (e) => { this.users = prev; this.totalUsers = pt; this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1); this.showError(e?.error?.message || 'Cannot delete user.'); }
    });
  }
  createUser(): void {
    const p = { ...this.newUser };
    this.newUser = { fullName: '', email: '', password: '', role: 'USER', verified: true, banned: false }; this.setTab('users');
    this.adminService.createUser(p).subscribe({ next: () => { this.loadUsers(); this.showSuccess('User created.'); }, error: (e) => this.showError(e?.error?.message || 'Failed.') });
  }

  loadAdminConversations(): void {
    const rid = ++this.conversationsLoadRequestId;
    this.messagesLoading = this.adminConversations.length === 0;
    this.messagerieService.loadAdminConversations(this.conversationSearch).subscribe({
      next: (c) => {
        if (this.conversationsLoadRequestId !== rid) return;
        this.adminConversations = c; this.messagesLoading = false;
        if (!this.conversationSearch) Admin.writeCache(Admin.CONVS_CACHE_KEY, c);
        this.preloadAdminVisibleHistories(c);
        if (!this.selectedConversation && c.length > 0) this.openAdminConversation(c[0]);
      },
      error: () => { if (this.conversationsLoadRequestId !== rid) return; this.messagesLoading = false; }
    });
  }
  filterConversations(){ this.loadAdminConversations(); }
  loadTopicHeatmap(){ this.messagerieService.loadTopicHeatmap().subscribe({ next: (c) => this.topicHeatmap = c, error: () => {} }); }
  get topicHeatmapTotal(){ const h = this.topicHeatmap; return (h.eco||0)+(h.lifestyle||0)+(h.product||0)+(h.other||0); }
  topicPercent(l: keyof TopicCounts){ const t = this.topicHeatmapTotal; if (!t) return 0; return Math.round((this.topicHeatmap[l]/t)*100); }
  openAdminConversation(c: ConversationSummary): void {
    this.selectedConversation = c;
    const key = c.conversationKey; this.selectedConversationRequestKey = key;
    const rid = ++this.selectedConversationRequestId;
    this.threadLoading = true;
    this.messagerieService.loadAdminHistoryCached(c.userA.id, c.userB.id).subscribe({
      next: (m) => { if (this.selectedConversationRequestKey !== key || this.selectedConversationRequestId !== rid) return; this.selectedConversationMessages = m; this.threadLoading = false; },
      error: () => { if (this.selectedConversationRequestKey !== key || this.selectedConversationRequestId !== rid) return; this.threadLoading = false; }
    });
  }
  onAdminConversationPointerDown(c: ConversationSummary){ this.openAdminConversation(c); }

  private loadImageCache(): void { try { const r = localStorage.getItem('vero_product_images'); if (r) { const o = JSON.parse(r); Object.entries(o).forEach(([k,v]) => this.productImageCache.set(Number(k), v as string)); } } catch {} }
  private saveImageCache(): void { try { const o: any = {}; this.productImageCache.forEach((v,k) => o[k]=v); localStorage.setItem('vero_product_images', JSON.stringify(o)); } catch {} }
  getProductImage(p: Product){ return this.productImageCache.get(p.id) ?? p.image ?? null; }
  loadProducts(): void {
    this.productsLoading = true;
    this.productService.getAll().pipe(timeout(15000), catchError(() => { this.showError('Products timeout.'); this.productsLoading = false; return of([]); })).subscribe({
      next: (d) => { this.products = d.map(p => ({ ...p, image: p.image && p.image.length > 200 ? null : p.image })) as any; this.productsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.showError('Failed to load products.'); this.productsLoading = false; }
    });
  }
  deleteProduct(id: number){ if (!confirm('Delete?')) return; this.productService.delete(id).subscribe({ next: () => { this.products = this.products.filter(p => p.id !== id); this.showSuccess('Deleted.'); }, error: () => this.showError('Failed.') }); }
  openProductModal(p?: Product): void { this.editingProduct = p ?? null; if (p) { this.productForm = { name: p.name, description: p.description, price: p.price, stock: p.stock, category: p.category as string, image: this.productImageCache.get(p.id) ?? p.image ?? '', origin: p.origin ?? '', isEcological: p.isEcological }; } else { this.productForm = { name: '', description: '', price: 0, stock: 0, category: 'NATURAL_COSMETICS', image: '', origin: '', isEcological: true }; } this.showProductModal = true; }
  closeProductModal(){ this.showProductModal = false; this.editingProduct = null; }
  onProductImageSelected(e: Event): void { const i = e.target as HTMLInputElement; if (!i.files?.[0]) return; const f = i.files[0]; if (f.size > 500*1024) { this.showError('Under 500KB.'); return; } const r = new FileReader(); r.onload = () => { this.productForm.image = r.result as string; }; r.readAsDataURL(f); }
  saveProduct(): void {
    if (!this.productForm.name.trim()) { this.showError('Name required.'); return; }
    this.productSaving = true;
    const img = this.productForm.image; const p: any = { ...this.productForm };
    if (this.editingProduct) {
      p.id = this.editingProduct.id;
      this.productService.update(p).subscribe({ next: (u) => { if (img) { this.productImageCache.set(u.id, img); this.saveImageCache(); } const i = this.products.findIndex(x => x.id === u.id); if (i !== -1) this.products[i] = u; this.products = [...this.products]; this.showSuccess('Updated.'); this.closeProductModal(); this.productSaving = false; this.cdr.detectChanges(); }, error: () => { this.showError('Failed.'); this.productSaving = false; } });
    } else {
      this.productService.create(p).subscribe({ next: (c) => { if (img) { this.productImageCache.set(c.id, img); this.saveImageCache(); } this.products = [c, ...this.products]; this.showSuccess('Created.'); this.closeProductModal(); this.productSaving = false; this.cdr.detectChanges(); }, error: () => { this.showError('Failed.'); this.productSaving = false; } });
    }
  }

  loadFormations(): void { this.formationsLoading = true; this.formationService.getAll().pipe(timeout(15000), catchError(() => { this.showError('Timeout.'); this.formationsLoading = false; return of([]); })).subscribe({ next: (d) => { this.formations = d; this.formationsLoading = false; this.cdr.detectChanges(); }, error: () => { this.showError('Failed.'); this.formationsLoading = false; } }); }
  deleteFormation(id: number){ if (!confirm('Delete?')) return; this.formationService.delete(id).subscribe({ next: () => { this.formations = this.formations.filter(f => f.id !== id); this.showSuccess('Deleted.'); }, error: () => this.showError('Failed.') }); }
  openFormationModal(f?: Formation): void { if (f) { this.editingFormation = f; this.formationForm = { title: f.title, description: f.description, duration: f.duration, maxCapacity: f.maxCapacity, price: f.price||0, status: f.status }; } else { this.editingFormation = null; this.formationForm = { title: '', description: '', duration: 0, maxCapacity: 0, price: 0, status: 'PLANNED' as FormationStatus }; } this.showFormationModal = true; }
  closeFormationModal(){ this.showFormationModal = false; this.editingFormation = null; }
  saveFormation(): void { if (!this.formationForm.title.trim()) { this.showError('Title required.'); return; } const d: any = { ...this.formationForm, pinned: false }; if (this.editingFormation) { d.id = this.editingFormation.id; d.participantIds = this.editingFormation.participantIds||[]; this.formationService.update(d).subscribe({ next: () => { this.showSuccess('Updated.'); this.loadFormations(); this.closeFormationModal(); }, error: () => this.showError('Failed.') }); } else { this.formationService.create(d).subscribe({ next: () => { this.showSuccess('Created.'); this.loadFormations(); this.closeFormationModal(); }, error: () => this.showError('Failed.') }); } }
  viewFormationSessions(f: Formation): void { this.selectedFormationForSessions = f; this.sessionsLoading = true; this.sessionService.getByFormation(f.id!).subscribe({ next: (s) => { this.sessions = s; this.sessionsLoading = false; this.cdr.detectChanges(); }, error: () => { this.showError('Failed.'); this.sessionsLoading = false; } }); this.loadResources(f.id!); }
  closeSessionsView(){ this.selectedFormationForSessions = null; this.sessions = []; }
  openSessionModal(s?: Session): void { if (!this.selectedFormationForSessions) return; if (this.allUsers.length === 0) this.loadAllUsers(); if (s) { this.editingSession = s; this.sessionForm = { title: s.title, startDate: s.startDate?.slice(0,16)||'', endDate: s.endDate?.slice(0,16)||'', status: s.status as SessionStatus, type: (s as any).type||'ONLINE', meetLink: (s as any).meetLink||'', trainerId: s.trainerId||0, formationId: this.selectedFormationForSessions.id! }; } else { this.editingSession = null; this.sessionForm = { title: '', startDate: '', endDate: '', status: 'SCHEDULED' as SessionStatus, type: 'ONLINE', meetLink: '', trainerId: 0, formationId: this.selectedFormationForSessions.id! }; } this.showSessionModal = true; }
  closeSessionModal(){ this.showSessionModal = false; this.editingSession = null; }
  saveSession(): void { if (!this.sessionForm.title.trim()||!this.sessionForm.startDate||!this.sessionForm.endDate) { this.showError('Fill all required fields.'); return; } const now=new Date(),start=new Date(this.sessionForm.startDate),end=new Date(this.sessionForm.endDate); let st: SessionStatus = 'SCHEDULED' as SessionStatus; if (now>=start&&now<=end) st='IN_PROGRESS' as SessionStatus; else if (now>end) st='COMPLETED' as SessionStatus; const d: any = { ...this.sessionForm, status: st, type: 'ONLINE' }; if (this.editingSession) { d.id = this.editingSession.id; this.sessionService.update(d).subscribe({ next: () => { this.showSuccess('Updated.'); this.viewFormationSessions(this.selectedFormationForSessions!); this.closeSessionModal(); }, error: () => this.showError('Failed.') }); } else { this.sessionService.create(d, this.selectedFormationForSessions!.id!).subscribe({ next: () => { this.showSuccess('Created.'); this.viewFormationSessions(this.selectedFormationForSessions!); this.closeSessionModal(); }, error: () => this.showError('Failed.') }); } }
  deleteSession(id: number){ this.sessionService.delete(id).subscribe({ next: () => { this.sessions = this.sessions.filter(s => s.id !== id); this.showSuccess('Deleted.'); }, error: () => this.showError('Failed.') }); }
  loadAllUsers(){ this.userService.getAll().subscribe({ next: (u) => this.allUsers = u, error: () => {} }); }
  get trainers(){ return this.allUsers.filter(u => u.role==='TRAINER'||u.role==='ADMIN'||u.role==='USER'); }
  getTrainerName(id: number){ const t = this.allUsers.find(u => u.id===id); return t ? t.fullName : '—'; }
  toggleParticipantsPanel(id: number){ this.expandedFormationId = this.expandedFormationId===id ? null : id; }
  getParticipantDetails(ids: number[]){ if (!ids?.length) return []; return ids.map(id => this.allUsers.find(u => u.id===id)).filter(Boolean); }
  getFormationStatusClass(s: FormationStatus){ return { PLANNED:'status-planned',IN_PROGRESS:'status-in-progress',COMPLETED:'status-completed' }[s]||'status-planned'; }
  getComputedSessionStatus(s: Session){ const now=new Date(),start=new Date(s.startDate),end=new Date(s.endDate); if ((s as any).status==='CANCELLED') return 'CANCELLED'; if (now<start) return 'SCHEDULED'; if (now>=start&&now<=end) return 'IN_PROGRESS'; return 'COMPLETED'; }
  getComputedSessionStatusLabel(s: Session){ const now=new Date(),start=s.startDate?new Date(s.startDate):null,end=s.endDate?new Date(s.endDate):null; if ((s as any).status==='CANCELLED') return 'Cancelled'; if (!start) return 'Upcoming'; if (now<start) return 'Upcoming'; if (end&&now>=start&&now<=end) return 'In Progress'; return 'Done'; }
  formatDate(d: string){ return new Date(d).toLocaleDateString('fr-FR',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
  togglePin(f: Formation){ this.formationService.togglePin(f.id!).subscribe({ next: (u) => { f.pinned=u.pinned; this.formations.sort((a,b)=>a.pinned===b.pinned?0:a.pinned?-1:1); }, error: () => this.showError('Error.') }); }
  onResourceFileSelected(e: Event){ const i=e.target as HTMLInputElement; if (i.files?.[0]) this.selectedResourceFile=i.files[0]; }
  uploadResource(id: number){ if (!this.selectedResourceFile) { this.showError('Select a file.'); return; } this.resourceUploading=true; this.formationService.uploadResource(id,this.selectedResourceFile).subscribe({ next: () => { this.showSuccess('Uploaded.'); this.selectedResourceFile=null; this.resourceUploading=false; this.loadResources(id); }, error: () => { this.showError('Failed.'); this.resourceUploading=false; } }); }
  deleteResource(fid: number, rid: number){ if (!confirm('Delete?')) return; this.formationService.deleteResource(fid,rid).subscribe({ next: () => { this.showSuccess('Deleted.'); this.loadResources(fid); }, error: () => this.showError('Failed.') }); }
  loadResources(id: number){ this.formationService.getResources(id).subscribe({ next: (r) => this.formationResources=r, error: () => {} }); }
  downloadResource(fid: number, rid: number, name: string){ this.formationService.downloadResource(fid,rid).subscribe({ next: (b) => { const u=window.URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=name; a.click(); window.URL.revokeObjectURL(u); }, error: () => this.showError('Failed.') }); }
  generateDescription(){ if (!this.formationForm.title.trim()) { this.showError('Enter a title first.'); return; } this.generatingDescription=true; this.formationService.generateDescription(this.formationForm.title,this.formationForm.duration).subscribe({ next: (r) => { this.formationForm.description=r.description; this.generatingDescription=false; }, error: () => { this.showError('Failed.'); this.generatingDescription=false; } }); }
  generateQuizFromResources(){ if (!this.selectedFormationForSessions) return; if (!this.formationResources.length) { this.showError('Upload resources first.'); return; } this.generatingQuiz=true; this.formationService.generateQuizFromResources(this.selectedFormationForSessions.id!,10).subscribe({ next: () => { this.showSuccess('Quiz generated!'); this.generatingQuiz=false; }, error: (e) => { this.showError(e?.error?.message||'Failed.'); this.generatingQuiz=false; } }); }
  closeQuizPreviewModal(){ this.showQuizPreviewModal=false; this.quizPreview=null; this.quizPreviewAnswers=new Map(); this.quizPreviewResult=null; }
  selectQuizPreviewOption(qid: number, oid: number){ this.quizPreviewAnswers.set(qid,oid); }
  isQuizPreviewSelected(qid: number, oid: number){ return this.quizPreviewAnswers.get(qid)===oid; }
  allQuizPreviewAnswered(){ if (!this.quizPreview) return false; return this.quizPreviewAnswers.size===this.quizPreview.questions.length; }
  submitQuizPreview(){ if (!this.allQuizPreviewAnswered()||!this.selectedFormationForSessions) return; this.quizPreviewSubmitting=true; const a=Array.from(this.quizPreviewAnswers.entries()).map(([q,o])=>({questionId:q,selectedOptionId:o})); this.formationService.submitQuiz(this.selectedFormationForSessions.id!,a).subscribe({ next: (r) => { this.quizPreviewResult=r; this.quizPreviewSubmitting=false; }, error: () => { this.showError('Failed.'); this.quizPreviewSubmitting=false; } }); }
  closeQuizModal(){ this.showQuizModal=false; }

  get suspendedOnPage(){ return this.users.filter(u => u.banned).length; }
  get monitoredConversationCount(){ return this.adminConversations.length; }
  initials(name: string | undefined){ return (name||'?').trim().charAt(0).toUpperCase(); }

  private belongsToSelectedConversation(msg: DirectMessage, conv: ConversationSummary): boolean {
    const ids=[msg.sender.id,msg.receiver.id].sort((a,b)=>a-b);
    const sel=[conv.userA.id,conv.userB.id].sort((a,b)=>a-b);
    return ids[0]===sel[0]&&ids[1]===sel[1];
  }
  private upsertConversationFromMessage(msg: DirectMessage): void {
    const idA=Math.min(msg.sender.id,msg.receiver.id), idB=Math.max(msg.sender.id,msg.receiver.id);
    const key=`${idA}_${idB}`;
    const s: ConversationSummary = { conversationKey:key, userA:idA===msg.sender.id?msg.sender:msg.receiver, userB:idB===msg.sender.id?msg.sender:msg.receiver, lastMessagePreview:msg.content.length>80?`${msg.content.slice(0,77)}...`:msg.content, lastMessageTime:msg.timestamp, lastMessageSenderId:msg.sender.id, messageCount:1 };
    const i=this.adminConversations.findIndex(c=>c.conversationKey===key);
    if (i>=0) this.adminConversations.splice(i,1);
    this.adminConversations=[s,...this.adminConversations]; this.messagesLoading=false;
  }
  private preloadAdminVisibleHistories(c: ConversationSummary[]){ for (const x of c.slice(0,8)) this.messagerieService.preloadAdminHistory(x.userA.id,x.userB.id); }
  private startAdminLiveSync(){ if (this.adminLiveSyncInterval) return; this.adminLiveSyncInterval=setInterval(()=>{ if (this.activeTab!=='messages') return; if (this.selectedConversation) this.refreshSelectedConversationSilently(this.selectedConversation); },1000); }
  private startUsersLiveSync(){ if (this.usersLiveSyncInterval) return; this.usersLiveSyncInterval=setInterval(()=>{ if (this.activeTab!=='users') return; this.refreshUsersSilently(); },1000); }
  private stopUsersLiveSync(){ if (this.usersLiveSyncInterval) { clearInterval(this.usersLiveSyncInterval); this.usersLiveSyncInterval=null; } }
  private refreshUsersSilently(){ this.adminService.getUsers(this.currentPage-1,this.usersPerPage,this.searchQuery,this.selectedRole).subscribe({ next: (d)=>{ if (this.activeTab!=='users') return; this.users=d.content??[]; this.totalUsers=d.totalElements??this.users.length; this.totalPages=Math.max(d.totalPages??0,1); this.currentPage=(d.number??0)+1; this.error=''; this.loading=false; } }); }
  private refreshSelectedConversationSilently(c: ConversationSummary){ if (this.threadLoading) return; const key=c.conversationKey; this.messagerieService.loadAdminHistoryCached(c.userA.id,c.userB.id).subscribe({ next: (m)=>{ if (this.selectedConversationRequestKey!==key) return; this.selectedConversationMessages=m; } }); }
  private ensureNotificationPermission(){ if (typeof window==='undefined'||!('Notification' in window)) return; if (Notification.permission==='default') Notification.requestPermission().catch(()=>undefined); }
  private showDesktopMessageNotification(sender: string, content: string){ if (typeof window==='undefined'||!('Notification' in window)) return; if (Notification.permission!=='granted') return; const n=new Notification('Nouveau message (Admin)',{body:`${sender}: ${content.length>90?content.slice(0,87)+'...':content}`}); n.onclick=()=>{ window.focus(); this.setTab('messages'); }; }
  showSuccess(msg: string){ this.successMessage=msg; this.errorMessage=''; setTimeout(()=>this.successMessage='',4000); }
  showError(msg: string)  { this.errorMessage=msg; this.successMessage=''; setTimeout(()=>this.errorMessage='',6000); }
  logout(){ this.authService.logout(); this.router.navigate(['/login']); }
}