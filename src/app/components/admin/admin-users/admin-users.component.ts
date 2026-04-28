import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, AdminUserListItem } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.html',
  styleUrls: ['./admin-users.css']
})
export class AdminUsersComponent implements OnInit {
  allUsers: AdminUserListItem[] = [];
  loading = false;
  error = '';

  searchQuery = '';
  selectedRole = '';
  usersPerPage = 10;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.adminService.getAllUsers().subscribe({
      next: (data) => {
        this.allUsers = data ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load users.';
        this.cdr.markForCheck();
        console.error('[admin-users] load failed', err);
      }
    });
  }

  get users(): AdminUserListItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.allUsers.filter(u => {
      if (this.selectedRole && u.role !== this.selectedRole) return false;
      if (!q) return true;
      return (u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    });
  }

  get totalUsers(): number { return this.users.length; }
  get totalPages(): number { return 1; }
  get currentPage(): number { return 1; }
  get suspendedOnPage(): number { return this.users.filter(u => u.banned).length; }

  navigateToCreate(): void {
    this.router.navigate(['/admin/users/new']);
  }

  startEdit(user: AdminUserListItem): void {
    this.router.navigate(['/admin/users', user.id, 'edit']);
  }

  onSearchChange(): void {}
  onRoleFilterChange(): void {}
  onPageSizeChange(): void {}
  goToPage(_: number): void {}

  toggleBan(user: AdminUserListItem): void {
    const isBanned = user.banned;
    const req = isBanned
      ? this.adminService.unbanUser(user.id)
      : this.adminService.banUser(user.id);

    req.subscribe({
      next: () => {
        user.banned = !isBanned;
        this.notificationService.success(isBanned ? 'User unbanned.' : 'User suspended.');
        this.cdr.markForCheck();
      },
      error: (err) => this.notificationService.error('Failed: ' + (err?.error?.message || err.message))
    });
  }

  initials(name?: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
}
