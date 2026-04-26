import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService, AdminCreateUserRequest, AdminUpdateUserRequest, AdminUserListItem } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.html',
  styleUrls: ['./admin-users.css']
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  activeTab: 'users' | 'add' | 'edit' = 'users';

  private static readonly USERS_CACHE_KEY = 'vero_admin_users_cache';

  users: AdminUserListItem[] = AdminUsersComponent.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(AdminUsersComponent.USERS_CACHE_KEY)?.users ?? [];
  loading = this.users.length === 0;
  error = '';
  totalUsers = AdminUsersComponent.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(AdminUsersComponent.USERS_CACHE_KEY)?.total ?? 0;

  currentPage = 1;
  usersPerPage = 10;
  totalPages = AdminUsersComponent.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(AdminUsersComponent.USERS_CACHE_KEY)?.pages ?? 0;

  searchQuery = '';
  selectedRole = '';

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

  private search$ = new Subject<string>();
  private usersLoadRequestId = 0;
  private usersLiveSyncInterval: ReturnType<typeof setInterval> | null = null;
  private routeSub?: Subscription;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router
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
    } catch {}
  }

  ngOnInit(): void {
    this.routeSub = this.route.data.subscribe(data => {
      this.activeTab = (data['mode'] as 'add' | 'edit') || 'users';
    });

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadUsers();
    });

    this.loadUsers();
    this.startUsersLiveSync();
  }

  ngOnDestroy(): void {
    this.search$.complete();
    this.stopUsersLiveSync();
    this.routeSub?.unsubscribe();
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  startUsersLiveSync(): void {
    if (this.usersLiveSyncInterval) return;
    this.usersLiveSyncInterval = setInterval(() => {
      if (this.activeTab === 'users' && !this.searchQuery && !this.selectedRole) {
        this.adminService.getUsers(this.currentPage - 1, this.usersPerPage, '', '').subscribe({
          next: (data) => {
            this.users = data.content ?? [];
            this.totalUsers = data.totalElements ?? this.users.length;
            this.totalPages = Math.max(data.totalPages ?? 0, 1);
          }
        });
      }
    }, 15000);
  }

  stopUsersLiveSync(): void {
    if (this.usersLiveSyncInterval != null) {
      clearInterval(this.usersLiveSyncInterval);
      this.usersLiveSyncInterval = null;
    }
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
        if (this.usersLoadRequestId !== requestId) return;
        this.users = data.content ?? [];
        this.totalUsers = data.totalElements ?? this.users.length;
        this.totalPages = Math.max(data.totalPages ?? 0, 1);
        this.currentPage = (data.number ?? 0) + 1;
        this.loading = false;

        if (!this.searchQuery && !this.selectedRole && this.currentPage === 1) {
          AdminUsersComponent.writeCache(AdminUsersComponent.USERS_CACHE_KEY, {
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
    this.editingUserId = user.id;
    this.editUserForm = {
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      verified: user.verified,
      banned: user.banned
    };
    this.router.navigate(['/admin/users', user.id, 'edit']);
  }

  cancelEdit(): void {
    this.editingUserId = null;
    this.router.navigate(['/admin/users']);
  }

  saveEdit(id: number): void {
    const payload = { ...this.editUserForm };
    const index = this.users.findIndex(user => user.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...payload, id } as AdminUserListItem;
    }
    this.editingUserId = null;
    this.router.navigate(['/admin/users']);
    this.adminService.updateUser(id, payload).subscribe({
      next: () => this.notificationService.success('User profile updated.'),
      error: () => {
        this.notificationService.error('Error updating user profile.');
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
        this.notificationService.success(isBanned ? 'User successfully unbanned!' : 'User access suspended!');
      },
      error: (err) => this.notificationService.error('Failed to alter ban status: ' + (err?.error?.message || err.message))
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

    const previousUsers = this.users;
    const previousTotal = this.totalUsers;
    this.users = this.users.filter(user => user.id !== id);
    this.totalUsers = Math.max(this.totalUsers - 1, 0);
    this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);

    this.adminService.deleteUser(id).subscribe({
      next: () => {
        this.notificationService.success('Account permanently deleted.');
        if (this.users.length === 0 && this.currentPage > 1) {
          this.currentPage -= 1;
          this.loadUsers();
        }
      },
      error: (err) => {
        this.users = previousUsers;
        this.totalUsers = previousTotal;
        this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);
        this.notificationService.error(err?.error?.message || 'Database Constraint: Cannot delete user because they have active platform data.');
      }
    });
  }

  createUser(): void {
    const payload = { ...this.newUser };
    this.newUser = { fullName: '', email: '', password: '', role: 'USER', verified: true, banned: false };
    this.router.navigate(['/admin/users']);
    this.adminService.createUser(payload).subscribe({
      next: () => {
        this.loadUsers();
        this.notificationService.success('New user account provisioned.');
      },
      error: (err) => this.notificationService.error(err?.error?.message || 'Failed to create user account.')
    });
  }

  initials(name?: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  get suspendedOnPage(): number {
    return this.users.filter(u => u.banned).length;
  }
}
