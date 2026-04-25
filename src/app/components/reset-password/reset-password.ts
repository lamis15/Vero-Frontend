import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword implements OnInit {
  newPassword = '';
  confirmPassword = '';
  token = '';
  loading = false;
  error = '';
  success = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.error = 'Invalid reset link. Please request a new password reset.';
    }
  }

  resetPassword(): void {
    this.error = '';

    if (!this.newPassword || this.newPassword.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.loading = false;
        const backendMessage =
          err?.error?.message ||
          err?.error?.error ||
          (typeof err?.error === 'string' ? err.error : null) ||
          err?.error?.details?.[0]?.defaultMessage ||
          err?.error?.errors?.[0]?.defaultMessage;
        if (backendMessage) {
          this.error = backendMessage;
        } else {
          this.error = 'Failed to reset password. Please try again.';
        }
      }
    });
  }
}
