import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginEmail = '';
  loginPassword = '';
  loginError = '';
  loginLoading = false;

  constructor(private authService: AuthService, private router: Router) { }

  goBack(): void {
    window.history.back();
  }

  login(): void {
    if (!this.loginEmail || !this.loginPassword) return;
    this.loginError = '';
    this.loginLoading = true;
    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.loginLoading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loginLoading = false;
        this.loginError = err?.status === 401
          ? 'Invalid credentials. Please check your email and password.'
          : 'Connection failed. Is the backend running?';
      }
    });
  }
}
