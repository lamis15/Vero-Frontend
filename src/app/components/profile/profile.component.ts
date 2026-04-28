import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UserResponse, AuthService, PasskeyCredentialResponse } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { UserService, EcoProfileResult } from '../../services/user.service';
import { MessagerieService, TopicCounts } from '../../services/messagerie.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: UserResponse | null = null;
  loading = false;
  error = '';
  success = '';

  fullName = '';
  email = '';
  image = '';
  currentPassword = '';
  newPassword = '';

  activeTab: 'profile' | 'edit' = 'profile';
  setTab(tab: 'profile' | 'edit'): void {
    this.activeTab = tab;
    this.success = '';
    this.error = '';
    if (tab === 'profile') {
      this.loadEcoStats();
    }
  }

  scrollEdit(): void {
    this.setTab('edit');
  }

  ecoStats: TopicCounts = { eco: 0, lifestyle: 0, product: 0, transport: 0, other: 0 };
  ecoProfile: EcoProfileResult | null = null;
  ecoProfileLoading = false;
  passkeys: PasskeyCredentialResponse[] = [];
  passkeysLoading = false;
  passkeysBusy = false;
  passkeysError = '';
  passkeysInfo = '';

  private incomingMessageSub?: Subscription;

  constructor(
    private userService: UserService,
    private messagerieService: MessagerieService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadProfile();
    this.loadEcoStats();
    this.loadEcoProfile();
    this._subscribeToIncomingMessages();
    this.loadPasskeys();
  }

  ngOnDestroy(): void {
    this.incomingMessageSub?.unsubscribe();
  }

  private _subscribeToIncomingMessages(): void {
    // Connect to WebSocket if not already connected
    const currentUser = this.authService.currentUser;
    if (currentUser) {
      this.messagerieService.connect(currentUser.id, false);
    }

    // Subscribe to incoming messages to update eco stats in real-time
    this.incomingMessageSub = this.messagerieService.incomingMessage$.subscribe((msg) => {
      if (!msg) return;

      // Only count messages sent by the current user
      const myId = this.user?.id || this.authService.currentUser?.id;
      if (msg.sender.id !== myId) return;

      const raw = (msg.topic ?? '').toString().trim().toLowerCase();
      const topic =
        raw === 'eco' || raw === 'lifestyle' || raw === 'product' || raw === 'transport' || raw === 'other'
          ? (raw as keyof TopicCounts)
          : null;
      if (topic) {
        this.ecoStats = {
          ...this.ecoStats,
          [topic]: (this.ecoStats[topic] || 0) + 1
        };
      }
    });
  }

  loadEcoProfile(): void {
    this.ecoProfileLoading = true;
    this.userService.getEcoProfile().subscribe({
      next: (res) => {
        this.ecoProfile = res;
        this.ecoProfileLoading = false;
      },
      error: () => {
        this.ecoProfileLoading = false;
      }
    });
  }

  loadEcoStats(): void {
    this.messagerieService.loadMyEcoStats().subscribe({
      next: (counts) => {
        this.ecoStats = {
          eco: Number(counts?.eco) || 0,
          lifestyle: Number(counts?.lifestyle) || 0,
          product: Number(counts?.product) || 0,
          transport: Number(counts?.transport) || 0,
          other: Number(counts?.other) || 0
        };
      },
      error: () => { /* optional — swallow */ }
    });
  }

  get ecoTotal(): number {
    const e = this.ecoStats;
    return (e.eco || 0) + (e.lifestyle || 0) + (e.product || 0) + (e.transport || 0) + (e.other || 0);
  }

  /** Part des messages classés hors « other » (affichage au centre du cercle). */
  get voiceEngagementPercent(): number {
    const t = this.ecoTotal;
    if (!t) return 0;
    const tagged = (this.ecoStats.eco || 0) + (this.ecoStats.lifestyle || 0) + (this.ecoStats.product || 0) + (this.ecoStats.transport || 0);
    return Math.round((tagged / t) * 100);
  }

  /** Dégradé conique proportionnel à chaque thème (anneau dynamique). */
  ecoRingConicGradient(): string {
    const e = this.ecoStats;
    const eco = e.eco || 0;
    const lifestyle = e.lifestyle || 0;
    const product = e.product || 0;
    const transport = e.transport || 0;
    const other = e.other || 0;
    const t = eco + lifestyle + product + transport + other;
    if (t <= 0) {
      return 'conic-gradient(var(--pf-purple-soft) 0deg, var(--pf-purple-soft) 360deg)';
    }
    const toDeg = (n: number) => (n / t) * 360;
    let cursor = 0;
    const parts: string[] = [];
    const add = (color: string, n: number) => {
      if (n <= 0) return;
      const a = cursor;
      const b = cursor + toDeg(n);
      cursor = b;
      parts.push(`${color} ${a}deg ${b}deg`);
    };
    add('#34d399', eco);
    add('#60a5fa', lifestyle);
    add('#fb923c', product);
    add('#2dd4bf', transport);
    add('#64748b', other);
    if (parts.length === 0) {
      return 'conic-gradient(var(--pf-purple-soft) 0deg, var(--pf-purple-soft) 360deg)';
    }
    return `conic-gradient(${parts.join(', ')})`;
  }

  /** Part du seul thème « eco » (texte secondaire / analytics). */
  get ecoScore(): number {
    if (!this.ecoTotal) return 0;
    return Math.round((this.ecoStats.eco / this.ecoTotal) * 100);
  }

  /** Get percentage for any topic category */
  topicPercent(label: keyof TopicCounts): number {
    if (!this.ecoTotal) return 0;
    return Math.round((this.ecoStats[label] / this.ecoTotal) * 100);
  }

  loadProfile(): void {
    this.loading = true;
    this.error = '';
    this.userService.getMe().subscribe({
      next: (user) => {
        this.user = user;
        this.fullName = user.fullName;
        this.email = user.email;
        this.image = user.image ?? '';
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load profile.';
        this.loading = false;
      }
    });
  }

  loadPasskeys(): void {
    this.passkeysLoading = true;
    this.passkeysError = '';
    this.authService.listMyPasskeys().subscribe({
      next: (items) => {
        this.passkeys = items || [];
        this.passkeysLoading = false;
      },
      error: () => {
        this.passkeysError = 'Impossible de charger les passkeys.';
        this.passkeysLoading = false;
      }
    });
  }

  async createPasskeyFromProfile(): Promise<void> {
    const email = this.user?.email || this.authService.currentUserEmail;
    if (!email) {
      this.passkeysError = 'Utilisateur introuvable pour activer Face ID.';
      return;
    }
    this.passkeysBusy = true;
    this.passkeysError = '';
    this.passkeysInfo = '';
    try {
      const options = await firstValueFrom(this.authService.passkeyRegisterOptions(email));
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: this.base64UrlToBuffer(options.challenge),
          rp: { id: options.rpId, name: options.rpName },
          user: {
            id: this.base64UrlToBuffer(options.userId),
            name: options.userName,
            displayName: options.displayName
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'preferred',
            userVerification: 'required'
          },
          timeout: 60000,
          attestation: 'none'
        }
      })) as PublicKeyCredential | null;

      if (!credential) {
        this.passkeysError = 'Création Face ID annulée.';
        return;
      }

      await firstValueFrom(
        this.authService.passkeyRegisterVerify(
          email,
          this.bufferToBase64Url(credential.rawId),
          options.challenge
        )
      );
      this.passkeysInfo = 'Face ID activé sur ce compte.';
      this.loadPasskeys();
    } catch (error: any) {
      const message = this.mapPasskeyError(error);
      this.passkeysError = message;
    } finally {
      this.passkeysBusy = false;
    }
  }

  deletePasskey(credentialId: number): void {
    this.passkeysBusy = true;
    this.passkeysError = '';
    this.passkeysInfo = '';
    this.authService.deleteMyPasskey(credentialId).subscribe({
      next: () => {
        this.passkeysInfo = 'Passkey supprimée.';
        this.passkeysBusy = false;
        this.loadPasskeys();
      },
      error: () => {
        this.passkeysError = 'Suppression impossible.';
        this.passkeysBusy = false;
      }
    });
  }

  private base64UrlToBuffer(base64Url: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  private bufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private mapPasskeyError(error: any): string {
    const backendMessage =
      error?.error?.message ||
      error?.error?.error ||
      (typeof error?.error === 'string' ? error.error : '');
    const normalized = (backendMessage || '').toLowerCase();
    if (error?.name === 'NotAllowedError') {
      return 'Action Face ID annulée ou expirée.';
    }
    if (normalized.includes('challenge') && normalized.includes('expir')) {
      return 'Challenge expiré, relancez l’activation.';
    }
    if (normalized.includes('already') || error?.name === 'InvalidStateError') {
      return 'Cette passkey existe déjà.';
    }
    return backendMessage || 'Erreur lors de l’activation Face ID.';
  }

  updateProfile(): void {
    this.success = '';
    this.error = '';
    this.userService.updateMe({
      fullName: this.fullName,
      email: this.email,
      image: this.image || undefined
    }).subscribe({
      next: (user) => {
        this.user = user;
        this.success = 'Profile updated successfully.';
      },
      error: () => {
        this.error = 'Profile update failed.';
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB max
        this.error = 'Image size must be less than 2MB.';
        return;
      }
      this.error = '';
      const reader = new FileReader();
      reader.onload = () => {
        this.image = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  updatePassword(): void {
    if (!this.currentPassword || !this.newPassword) {
      return;
    }
    this.success = '';
    this.error = '';
    this.userService.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.currentPassword = '';
        this.newPassword = '';
        this.success = 'Password updated successfully.';
      },
      error: () => {
        this.error = 'Password update failed.';
      }
    });
  }

  get personaTitle(): string {
    const raw = this.ecoProfile?.profile;
    if (!raw) return 'Your eco persona';
    return raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  get badgeImage(): string | null {
    if (!this.ecoProfile?.profile) return null;
    const p = this.ecoProfile.profile;
    if (p.includes('Eco-Guardian')) return 'assets/images/badges/eco-guardian.png';
    if (p.includes('Eco-Warrior')) return 'assets/images/badges/eco-warrior.png';
    if (p.includes('Eco-Learner')) return 'assets/images/badges/eco-learner.png';
    if (p.includes('Urban Commuter')) return 'assets/images/badges/urban-commuter.png';
    if (p.includes('High Impact')) return 'assets/images/badges/high-impact.png';
    return null;
  }
}
