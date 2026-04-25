import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  group,
} from '@angular/animations';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';

export const slideAnimation = trigger('slideAnimation', [
  // Login → Register (slide left)
  transition('login => register', [
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%'
      })
    ], { optional: true }),
    group([
      query(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(0)', opacity: 1 })
        ),
      ], { optional: true }),
      query(':leave', [
        style({ transform: 'translateX(0)', opacity: 1 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(-100%)', opacity: 0 })
        ),
      ], { optional: true }),
    ]),
  ]),

  // Register → Login (slide right)
  transition('register => login', [
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%'
      })
    ], { optional: true }),
    group([
      query(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(0)', opacity: 1 })
        ),
      ], { optional: true }),
      query(':leave', [
        style({ transform: 'translateX(0)', opacity: 1 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(100%)', opacity: 0 })
        ),
      ], { optional: true }),
    ]),
  ]),

  // Login / Register → Forgot Password (slide left)
  transition('* => forgot-password', [
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%'
      })
    ], { optional: true }),
    group([
      query(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(0)', opacity: 1 })
        ),
      ], { optional: true }),
      query(':leave', [
        style({ transform: 'translateX(0)', opacity: 1 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(-100%)', opacity: 0 })
        ),
      ], { optional: true }),
    ]),
  ]),

  // Forgot Password → Login (slide right)
  transition('forgot-password => *', [
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%'
      })
    ], { optional: true }),
    group([
      query(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(0)', opacity: 1 })
        ),
      ], { optional: true }),
      query(':leave', [
        style({ transform: 'translateX(0)', opacity: 1 }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateX(100%)', opacity: 0 })
        ),
      ], { optional: true }),
    ]),
  ]),
]);

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  animations: [slideAnimation],
})
export class LoginComponent implements OnInit {
  loginEmail = '';
  loginPassword = '';
  registerFullName = '';
  registerEmail = '';
  registerPassword = '';
  registerImage = '';
  forgotPasswordEmail = '';

  errFullName = '';
  errEmail = '';
  errPassword = '';
  errImage = '';
  errForgotEmail = '';

  mode: 'login' | 'register' | 'forgot-password' = 'login';
  loginError = '';
  passkeyInfo = '';
  loginLoading = false;
  registrationSuccess = false;
  forgotPasswordSuccess = false;
  socialBusy = false;
  passkeySupported = false;

  private returnUrl = '/track';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const r = this.route.snapshot.queryParamMap.get('returnUrl');
    if (r && r.startsWith('/') && !r.startsWith('//')) {
      this.returnUrl = r;
    }

    this.passkeySupported =
      typeof window !== 'undefined' && 'PublicKeyCredential' in window;
    if (!this.passkeySupported) {
      this.passkeyInfo =
        'Passkey sign-in is only available on compatible devices and browsers.';
    }

    const queryParams = new URLSearchParams(window.location.search);
    const social = queryParams.get('social');
    const socialError = queryParams.get('socialError');
    const reason = queryParams.get('reason');

    if (social === 'success' && this.authService.applySocialSession(queryParams)) {
      window.history.replaceState({}, document.title, '/login');
      if (this.authService.currentUserRole === 'ADMIN') {
        void this.router.navigateByUrl('/admin');
      } else {
        this.goAfterAuth();
      }
      return;
    }

    if (socialError) {
      this.loginError = reason
        ? `Social sign-in failed: ${reason}`
        : 'Social sign-in failed. Check your provider keys on the backend, then try again.';
      window.history.replaceState({}, document.title, '/login');
    }
  }

  private goAfterAuth(): void {
    void this.router.navigateByUrl(this.returnUrl);
  }

  goBack(): void {
    window.history.back();
  }

  setMode(mode: 'login' | 'register' | 'forgot-password'): void {
    this.mode = mode;
    this.loginError = '';
    this.errFullName = '';
    this.errEmail = '';
    this.errPassword = '';
    this.errImage = '';
    this.errForgotEmail = '';
    this.registrationSuccess = false;
    this.forgotPasswordSuccess = false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        this.errImage = 'Image is too large. Please select a file smaller than 500KB.';
        this.registerImage = '';
        return;
      }
      this.errImage = '';
      const reader = new FileReader();
      reader.onload = () => {
        this.registerImage = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  login(): void {
    this.errEmail = '';
    this.errPassword = '';
    this.loginError = '';

    let valid = true;
    if (!this.loginEmail.trim()) {
      this.errEmail = 'Email is required.';
      valid = false;
    }
    if (!this.loginPassword) {
      this.errPassword = 'Password is required.';
      valid = false;
    }
    if (!valid) return;

    this.loginLoading = true;
    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: (res) => {
        this.loginLoading = false;
        if (res?.user?.role === 'ADMIN') {
          this.router.navigateByUrl('/admin');
        } else {
          this.goAfterAuth();
        }
      },
      error: (err) => {
        this.loginLoading = false;
        const rawMessage =
          err?.error?.message ||
          err?.error?.error ||
          (typeof err?.error === 'string' ? err.error : null) ||
          err?.error?.details?.[0]?.defaultMessage ||
          err?.error?.errors?.[0]?.defaultMessage;

        const isGeneric =
          rawMessage === 'Forbidden' || rawMessage === 'Unauthorized';

        if (rawMessage && !isGeneric && err?.status !== 0) {
          this.loginError = rawMessage;
          return;
        }
        if (err?.status === 401 || err?.status === 403) {
          this.loginError =
            'Invalid credentials. Please check your email and password. If you just registered, you may need to verify your email first.';
          return;
        }
        if (err?.status === 0) {
          this.loginError =
            'Connection failed. Please ensure the backend is running.';
          return;
        }
        this.loginError = 'Authentication failed. Please try again.';
      },
    });
  }

  register(): void {
    this.errFullName = '';
    this.errEmail = '';
    this.errPassword = '';
    this.loginError = '';
    this.registrationSuccess = false;

    let valid = true;
    if (!this.registerFullName.trim()) {
      this.errFullName = 'Full name is required.';
      valid = false;
    }
    if (!this.registerEmail.trim() || !this.registerEmail.includes('@')) {
      this.errEmail = 'Please provide a valid email address.';
      valid = false;
    }
    if (!this.registerPassword || this.registerPassword.length < 6) {
      this.errPassword = 'Password must be at least 6 characters.';
      valid = false;
    }
    if (!valid) return;

    this.loginLoading = true;
    this.authService
      .register({
        fullName: this.registerFullName,
        email: this.registerEmail,
        password: this.registerPassword,
        image: this.registerImage || undefined,
      })
      .subscribe({
        next: () => {
          this.loginLoading = false;
          this.registrationSuccess = true;
        },
        error: (err) => {
          this.loginLoading = false;
          const backendMessage =
            err?.error?.message ||
            err?.error?.error ||
            (typeof err?.error === 'string' ? err.error : null) ||
            err?.error?.details?.[0]?.defaultMessage ||
            err?.error?.errors?.[0]?.defaultMessage;
          if (backendMessage) {
            this.loginError = backendMessage;
            return;
          }
          if (err?.status === 409) {
            this.loginError =
              'This email is already used. Try another email or login.';
            return;
          }
          this.loginError =
            'Registration failed. Please check your data and try again.';
        },
      });
  }

  forgotPassword(): void {
    this.errForgotEmail = '';
    this.loginError = '';

    if (
      !this.forgotPasswordEmail.trim() ||
      !this.forgotPasswordEmail.includes('@')
    ) {
      this.errForgotEmail = 'Please provide a valid email address.';
      return;
    }

    this.loginLoading = true;
    this.authService.forgotPassword(this.forgotPasswordEmail).subscribe({
      next: () => {
        this.loginLoading = false;
        this.forgotPasswordSuccess = true;
      },
      error: (err) => {
        this.loginLoading = false;
        const backendMessage =
          err?.error?.message ||
          err?.error?.error ||
          (typeof err?.error === 'string' ? err.error : null) ||
          err?.error?.details?.[0]?.defaultMessage ||
          err?.error?.errors?.[0]?.defaultMessage;
        if (backendMessage) {
          this.loginError = backendMessage;
          return;
        }
        this.loginError = 'Failed to send reset email. Please try again.';
      },
    });
  }

  continueWith(provider: 'google' | 'github' | 'facebook'): void {
    this.socialBusy = true;
    window.location.href = this.authService.getSocialAuthUrl(provider);
  }

  async signInWithPasskey(): Promise<void> {
    if (!this.passkeySupported) {
      this.passkeyInfo = 'Passkey sign-in is not available on this browser.';
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      this.passkeyInfo =
        'Passkey requires a secure context (https or localhost).';
      return;
    }

    this.loginError = '';
    this.passkeyInfo = 'Opening Face ID / Passkey...';
    const email = this.loginEmail.trim().toLowerCase();
    if (!email) {
      this.passkeyInfo = 'Please enter your email first.';
      return;
    }

    this.loginLoading = true;
    try {
      await this.tryPasskeyLogin(email);
    } catch (error: any) {
      const backendMessage = this.extractBackendErrorMessage(error);

      if (error?.status === 0) {
        this.passkeyInfo =
          'Connection failed. Please ensure the backend is running on port 9090.';
        return;
      }
      if (error?.name === 'NotAllowedError') {
        this.passkeyInfo =
          'Passkey request was canceled or blocked by the browser.';
        return;
      }
      const genericBadRequest =
        error?.status === 400 &&
        (!backendMessage || backendMessage === 'Bad Request');
      if (genericBadRequest) {
        if (this.loginPassword) {
          try {
            await this.createPasskeyForCurrentCredentials(
              email,
              this.loginPassword
            );
            await this.tryPasskeyLogin(email);
          } catch (createError: any) {
            this.passkeyInfo =
              this.extractBackendErrorMessage(createError) ||
              'Unable to create passkey for this account.';
          }
        } else {
          this.passkeyInfo =
            'Passkey not ready for this account. Enter email and password once, then click Face ID again.';
        }
        return;
      }

      const noPasskey =
        typeof backendMessage === 'string' &&
        backendMessage.toLowerCase().includes('no passkey');

      if (noPasskey && this.loginPassword) {
        try {
          await this.createPasskeyForCurrentCredentials(
            email,
            this.loginPassword
          );
          await this.tryPasskeyLogin(email);
        } catch (createError: any) {
          this.passkeyInfo =
            createError?.error?.message ||
            'Unable to create passkey for this account.';
        }
      } else if (noPasskey) {
        this.passkeyInfo =
          'No passkey registered for this account. Login once with password to create it.';
      } else {
        this.passkeyInfo = backendMessage || 'Passkey authentication failed.';
      }
    } finally {
      this.loginLoading = false;
    }
  }

  private extractBackendErrorMessage(error: any): string {
    return (
      error?.error?.message ||
      error?.error?.error ||
      error?.error?.details?.[0]?.defaultMessage ||
      error?.error?.errors?.[0]?.defaultMessage ||
      (typeof error?.error === 'string' ? error.error : '') ||
      ''
    );
  }

  private async createPasskeyForCurrentCredentials(
    email: string,
    password: string
  ): Promise<void> {
    await firstValueFrom(this.authService.login(email, password));
    const options = await firstValueFrom(
      this.authService.passkeyRegisterOptions(email)
    );

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: this.base64UrlToBuffer(options.challenge),
        rp: { id: options.rpId, name: options.rpName },
        user: {
          id: this.base64UrlToBuffer(options.userId),
          name: options.userName,
          displayName: options.displayName,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { userVerification: 'preferred' },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error('Passkey creation canceled.');
    }

    await firstValueFrom(
      this.authService.passkeyRegisterVerify(
        email,
        this.bufferToBase64Url(credential.rawId),
        options.challenge
      )
    );
    this.passkeyInfo =
      'Passkey created successfully. You can now use Face ID / biometrics.';
  }

  private async tryPasskeyLogin(email: string): Promise<void> {
    const options = await firstValueFrom(
      this.authService.passkeyLoginOptions(email)
    );
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: this.base64UrlToBuffer(options.challenge),
        rpId: options.rpId,
        allowCredentials: options.allowCredentialIds.map((id: string) => ({
          id: this.base64UrlToBuffer(id),
          type: 'public-key' as PublicKeyCredentialType,
        })),
        userVerification: 'preferred',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('Passkey login canceled.');
    }

    const res = await firstValueFrom(
      this.authService.passkeyLoginVerify(
        email,
        this.bufferToBase64Url(assertion.rawId),
        options.challenge
      )
    );
    if (res?.user?.role === 'ADMIN') {
      await this.router.navigateByUrl('/admin');
    } else {
      this.goAfterAuth();
    }
  }

  private base64UrlToBuffer(base64Url: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );
  }

  private bufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}