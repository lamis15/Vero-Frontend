import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserResponse } from '../../services/auth.service';
import { UserService, EcoProfileResult } from '../../services/user.service';
import { MessagerieService, TopicCounts } from '../../services/messagerie.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  user: UserResponse | null = null;
  loading = false;
  error = '';
  success = '';

  fullName = '';
  email = '';
  image = '';
  currentPassword = '';
  newPassword = '';

  activeTab: 'profile' | 'security' = 'profile';
  setTab(tab: 'profile' | 'security'): void {
    this.activeTab = tab;
    this.success = '';
    this.error = '';
  }

  ecoStats: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
  ecoProfile: EcoProfileResult | null = null;
  ecoProfileLoading = false;

  constructor(
    private userService: UserService,
    private messagerieService: MessagerieService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadEcoStats();
    this.loadEcoProfile();
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
      next: (counts) => (this.ecoStats = counts),
      error: () => { /* optional — swallow */ }
    });
  }

  get ecoTotal(): number {
    const e = this.ecoStats;
    return (e.eco || 0) + (e.lifestyle || 0) + (e.product || 0) + (e.other || 0);
  }

  /** Share of eco-themed messages over total (0–100). */
  get ecoScore(): number {
    if (!this.ecoTotal) return 0;
    return Math.round((this.ecoStats.eco / this.ecoTotal) * 100);
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
