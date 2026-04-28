import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService, AdminUpdateUserRequest } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-admin-user-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-user-edit.component.html',
  styleUrls: ['./admin-users.css']
})
export class AdminUserEditComponent implements OnInit {
  userId: number | null = null;
  loading = true;
  error = '';
  errorMessage = '';
  submitting = false;
  editUserForm: AdminUpdateUserRequest = {};

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.router.navigate(['/admin/users']);
      return;
    }
    this.userId = Number(idParam);
    this.adminService.getUserById(this.userId).subscribe({
      next: (user) => {
        this.editUserForm = {
          fullName: user.fullName,
          email: user.email,
          role: user.role as 'USER' | 'ADMIN' | 'PARTNER',
          verified: user.verified,
          banned: user.banned
        };
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load this user.';
        this.loading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/users']);
  }

  save(): void {
    if (!this.userId || this.submitting) return;

    const fullName = (this.editUserForm.fullName || '').trim();
    const email = (this.editUserForm.email || '').trim();

    if (!fullName || !email) {
      this.errorMessage = 'Full name and email are required.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const id = this.userId;
    const payload: AdminUpdateUserRequest = {
      ...this.editUserForm,
      fullName,
      email
    };

    this.adminService.updateUser(id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.notificationService.success('User profile updated.');
        this.router.navigate(['/admin/users']);
      },
      error: (err) => {
        this.submitting = false;
        const status = err?.status;
        if (status === 401 || status === 403) {
          this.errorMessage = 'You are not authorised. Sign in again as an administrator.';
        } else if (status === 409) {
          this.errorMessage = 'A user with that email already exists.';
        } else if (status === 0) {
          this.errorMessage = 'Cannot reach the backend. Is it running on :8080?';
        } else {
          this.errorMessage = err?.error?.message || 'Failed to update user profile.';
        }
        this.notificationService.error(this.errorMessage);
      }
    });
  }
}
