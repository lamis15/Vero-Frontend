import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AdminService, AdminUserListItem } from '../../services/admin.service';

export interface FeatureExplanation {
  feature: string;
  label: string;
  raw_value: number;
  z_score: number;
  flagged: boolean;
  type: string;
}

export interface AnomalyResult {
  user_id: number;
  is_anomaly: number;
  ensemble_score: number;
  risk_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  risk_label: string;
  anomaly_type: string;
  iso_score: number;
  lstm_error: number;
  explanation: FeatureExplanation[];
}

export interface BatchSummary {
  total: number;
  anomalies: number;
  normal: number;
  rate: number;
}

@Component({
  selector: 'app-anomaly-detector',
  standalone: true,
  imports: [CommonModule, FormsModule],
templateUrl: './anomaly-detector.component.html',
styleUrls: ['./anomaly-detector.component.css'],
changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnomalyDetectorComponent implements OnInit, OnDestroy {

  private readonly ML_API = 'http://localhost:5000';

  mode: 'manual' | 'batch' | 'realtime' = 'manual';

  form = {
    user_id: 1,
    n_actions: 5,
    n_reservations: 4,
    n_cancellations: 0,
    mean_interval_sec: 86400,
    min_interval_sec: 3600,
    n_unique_events: 4,
    n_unique_sessions: 3,
    n_unique_ips: 2,
    reservations_per_hour: 0.1,
  };

  mlAvailable = true;
  loading = false;

  userSearchQuery = '';
  userLookupLoading = false;
  adminUsers: AdminUserListItem[] = [];
  filteredAdminUsers: AdminUserListItem[] = [];
  selectedAdminUser: AdminUserListItem | null = null;
  result: AnomalyResult | null = null;
  batchResults: AnomalyResult[] = [];
  batchSummary: BatchSummary | null = null;
  expandedUser: number | null = null;
  selectedResult: AnomalyResult | null = null;

  realtimeLog: Array<{ time: string; result: AnomalyResult }> = [];
  realtimeRunning = false;
  private realtimeTimer: any;

  presets = [
    {
      label: 'Normal User',
      icon: '✅',
      color: '#06d6a0',
      values: {
        n_actions: 5,
        n_reservations: 4,
        n_cancellations: 0,
        mean_interval_sec: 86400,
        min_interval_sec: 3600,
        n_unique_events: 4,
        n_unique_sessions: 3,
        n_unique_ips: 2,
        reservations_per_hour: 0.1
      }
    },
    {
      label: 'Mass Booking',
      icon: '🤖',
      color: '#f72585',
      values: {
        n_actions: 20,
        n_reservations: 18,
        n_cancellations: 0,
        mean_interval_sec: 3,
        min_interval_sec: 1,
        n_unique_events: 15,
        n_unique_sessions: 1,
        n_unique_ips: 1,
        reservations_per_hour: 12
      }
    },
    {
      label: 'Repeat Cancel',
      icon: '🔁',
      color: '#f77f00',
      values: {
        n_actions: 10,
        n_reservations: 8,
        n_cancellations: 7,
        mean_interval_sec: 900,
        min_interval_sec: 30,
        n_unique_events: 5,
        n_unique_sessions: 4,
        n_unique_ips: 3,
        reservations_per_hour: 1.5
      }
    },
    {
      label: 'Bot Pattern',
      icon: '⚡',
      color: '#ff2d95',
      values: {
        n_actions: 25,
        n_reservations: 22,
        n_cancellations: 0,
        mean_interval_sec: 1.5,
        min_interval_sec: 1,
        n_unique_events: 10,
        n_unique_sessions: 1,
        n_unique_ips: 1,
        reservations_per_hour: 15
      }
    },
  ];

  constructor(
    private http: HttpClient,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkML();
    this.loadUsersForLookup();
  }

  ngOnDestroy(): void {
    if (this.realtimeTimer) {
      clearInterval(this.realtimeTimer);
    }
  }

  checkML(): void {
    this.http.get(`${this.ML_API}/health`).subscribe({
      next: () => {
        this.mlAvailable = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.mlAvailable = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyPreset(p: any): void {
    Object.assign(this.form, p.values);
    this.result = null;
    this.cdr.markForCheck();
  }


  loadUsersForLookup(): void {
    this.userLookupLoading = true;

    this.adminService.getAllUsers().subscribe({
      next: (data: unknown) => {
        let users = data as AdminUserListItem[];
        if (!Array.isArray(users)) {
          const anyData = data as any;
          users = anyData?.content ?? anyData?.data ?? anyData?.users ?? [];
        }

        const q = this.userSearchQuery.trim().toLowerCase();
        const filtered = q
          ? users.filter((u) =>
            (u.fullName || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            String(u.id).includes(q)
          )
          : users;

        this.adminUsers = filtered.slice(0, 500);
        this.filteredAdminUsers = this.adminUsers.slice(0, 12);

        if (!this.selectedAdminUser && this.adminUsers.length > 0) {
          this.selectAdminUser(this.adminUsers[0], false);
        }

        this.userLookupLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.adminUsers = [];
        this.filteredAdminUsers = [];
        this.userLookupLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onUserSearchChange(): void {
    const q = this.userSearchQuery.trim().toLowerCase();

    if (!q) {
      this.filteredAdminUsers = this.adminUsers.slice(0, 12);
      this.cdr.markForCheck();
      return;
    }

    this.filteredAdminUsers = this.adminUsers
      .filter((u) =>
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        String(u.id).includes(q)
      )
      .slice(0, 12);

    this.cdr.markForCheck();
  }

  selectAdminUser(user: AdminUserListItem, clearSearch = true): void {
    this.selectedAdminUser = user;
    this.form.user_id = user.id;

    if (clearSearch) {
      this.userSearchQuery = user.fullName || user.email || `User #${user.id}`;
      this.filteredAdminUsers = [];
    }

    this.result = null;
    this.cdr.markForCheck();
  }

  userInitials(user?: AdminUserListItem | null): string {
    const name = user?.fullName || user?.email || '?';
    return name.trim().charAt(0).toUpperCase();
  }

  analyze(): void {
    this.loading = true;
    this.result = null;

    const cancel_rate = this.form.n_cancellations / Math.max(1, this.form.n_reservations);
    const events_per_reservation = this.form.n_unique_events / Math.max(1, this.form.n_reservations);
    const std_interval = this.form.mean_interval_sec * 0.3;
    const max_interval = this.form.mean_interval_sec * 2;

    this.http.post<any>(`${this.ML_API}/anomaly/detect`, {
      users: [
        {
          ...this.form,
          cancel_rate,
          events_per_reservation,
          std_interval_sec: std_interval,
          max_interval_sec: max_interval
        }
      ]
    }).subscribe({
      next: (res) => {
        this.result = res.results?.[0] ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  runBatch(): void {
    this.loading = true;
    const users = this.generateBatchUsers(30);

    this.http.post<any>(`${this.ML_API}/anomaly/detect`, { users }).subscribe({
      next: (res) => {
        this.batchResults = res.results ?? [];
        this.batchSummary = res.summary ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private generateBatchUsers(n: number): any[] {
    const users = [];

    for (let i = 1; i <= n; i++) {
      const isAnomaly = Math.random() < 0.25;

      if (!isAnomaly) {
        users.push({
          user_id: i,
          n_actions: 3 + Math.floor(Math.random() * 10),
          n_reservations: 2 + Math.floor(Math.random() * 8),
          n_cancellations: Math.floor(Math.random() * 2),
          cancel_rate: Math.random() * 0.2,
          mean_interval_sec: 3600 + Math.random() * 86400,
          std_interval_sec: 1000 + Math.random() * 5000,
          min_interval_sec: 600 + Math.random() * 3600,
          max_interval_sec: 86400 + Math.random() * 86400,
          n_unique_events: 2 + Math.floor(Math.random() * 8),
          n_unique_sessions: 2 + Math.floor(Math.random() * 5),
          n_unique_ips: 1 + Math.floor(Math.random() * 3),
          reservations_per_hour: 0.05 + Math.random() * 0.3,
          events_per_reservation: 0.5 + Math.random() * 2,
        });
      } else {
        const type = Math.floor(Math.random() * 3);

        if (type === 0) {
          users.push({
            user_id: i,
            n_actions: 20,
            n_reservations: 18,
            n_cancellations: 0,
            cancel_rate: 0,
            mean_interval_sec: 2,
            std_interval_sec: 0.3,
            min_interval_sec: 1,
            max_interval_sec: 3,
            n_unique_events: 15,
            n_unique_sessions: 1,
            n_unique_ips: 1,
            reservations_per_hour: 12,
            events_per_reservation: 1
          });
        } else if (type === 1) {
          users.push({
            user_id: i,
            n_actions: 10,
            n_reservations: 8,
            n_cancellations: 7,
            cancel_rate: 0.875,
            mean_interval_sec: 900,
            std_interval_sec: 200,
            min_interval_sec: 30,
            max_interval_sec: 2000,
            n_unique_events: 5,
            n_unique_sessions: 4,
            n_unique_ips: 3,
            reservations_per_hour: 1.5,
            events_per_reservation: 0.6
          });
        } else {
          users.push({
            user_id: i,
            n_actions: 25,
            n_reservations: 22,
            n_cancellations: 0,
            cancel_rate: 0,
            mean_interval_sec: 1.5,
            std_interval_sec: 0.2,
            min_interval_sec: 1,
            max_interval_sec: 2,
            n_unique_events: 10,
            n_unique_sessions: 1,
            n_unique_ips: 1,
            reservations_per_hour: 15,
            events_per_reservation: 0.5
          });
        }
      }
    }

    return users;
  }

  toggleRealtime(): void {
    if (this.realtimeRunning) {
      clearInterval(this.realtimeTimer);
      this.realtimeRunning = false;
    } else {
      this.realtimeRunning = true;
      this.realtimeTimer = setInterval(() => this.realtimeTick(), 2000);
      this.realtimeTick();
    }

    this.cdr.markForCheck();
  }

  private realtimeTick(): void {
    const user = this.generateBatchUsers(1)[0];
    user.user_id = Math.floor(Math.random() * 1000) + 1;

    this.http.post<any>(`${this.ML_API}/anomaly/detect`, { users: [user] }).subscribe({
      next: (res) => {
        const result = res.results?.[0];

        if (result) {
          this.realtimeLog.unshift({
            time: new Date().toLocaleTimeString(),
            result
          });
        }

        if (this.realtimeLog.length > 15) {
          this.realtimeLog.pop();
        }

        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  getRiskColor(level: string): string {
    return level === 'HIGH'
      ? '#f72585'
      : level === 'MEDIUM'
        ? '#f77f00'
        : level === 'LOW'
          ? '#06d6a0'
          : '#8892b0';
  }

  getRiskBg(level: string): string {
    return level === 'HIGH'
      ? 'rgba(247, 37, 133, .14)'
      : level === 'MEDIUM'
        ? 'rgba(247, 127, 0, .14)'
        : level === 'LOW'
          ? 'rgba(6, 214, 160, .14)'
          : 'rgba(255,255,255,.06)';
  }

  getAnomalyIcon(type: string): string {
    const m: Record<string, string> = {
      MASS_BOOKING: '🤖💥',
      REPEAT_CANCEL: '🔁⚠️',
      BOT_PATTERN: '⚡🤖',
      SUSPICIOUS_IP: '🌐🚨',
      UNUSUAL_PATTERN: '🧠❗',
      NORMAL: '✅✨'
    };

    return m[type] || '🧠';
  }

  getScoreGradient(score: number): string {
    if (score >= 0.75) return 'linear-gradient(135deg, #f72585, #ff2d95)';
    if (score >= 0.5) return 'linear-gradient(135deg, #f77f00, #ffd166)';
    if (score >= 0.35) return 'linear-gradient(135deg, #06d6a0, #00ffc6)';
    return 'linear-gradient(135deg, #4361ee, #00b4a6)';
  }

  getBarWidth(v: number): number {
    return Math.round(Math.min(1, Math.max(0, v)) * 100);
  }

  zBarWidth(z: number): number {
    return Math.min(100, Math.abs(z) * 30);
  }

  toggleExpand(uid: number): void {
    this.expandedUser = this.expandedUser === uid ? null : uid;
    this.cdr.markForCheck();
  }

  openDetail(r: AnomalyResult): void {
    this.selectedResult = r;
    this.cdr.markForCheck();
  }

  closeDetail(): void {
    this.selectedResult = null;
    this.cdr.markForCheck();
  }
}
