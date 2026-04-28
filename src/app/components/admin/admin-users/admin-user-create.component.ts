import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, AdminCreateUserRequest } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-admin-user-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-user-create.component.html',
  styleUrls: ['./admin-users.css']
})
export class AdminUserCreateComponent {
  newUser: AdminCreateUserRequest = {
    fullName: '',
    email: '',
    password: '',
    role: 'USER',
    verified: true,
    banned: false
  };

  submitting = false;
  errorMessage = '';

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  cancel(): void {
    this.router.navigate(['/admin/users']);
  }

  createUser(): void {
    if (this.submitting) return;

    const fullName = (this.newUser.fullName || '').trim();
    const email = (this.newUser.email || '').trim();
    const password = (this.newUser.password || '').trim();

    if (!fullName || !email || !password) {
      this.errorMessage = 'Full name, email and password are all required.';
      return;
    }
    if (password.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    const payload: AdminCreateUserRequest = { ...this.newUser, fullName, email, password };

    this.adminService.createUser(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.notificationService.success('New user account provisioned.');
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
          this.errorMessage = err?.error?.message || 'Failed to create user account.';
        }
        this.notificationService.error(this.errorMessage);
        console.error('[admin-user-create] createUser failed:', err);
      }
    });
  }
}
