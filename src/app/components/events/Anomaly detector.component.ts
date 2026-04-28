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
  templateUrl: './Anomaly detector.component.html',
  styleUrls: ['./Anomaly detector.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnomalyDetectorComponent implements OnInit, OnDestroy {

  // ── HuggingFace API ───────────────────────────────────────────────────────
  private readonly HF_API = 'http://localhost:8080';

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

  mlAvailable = true;  // HF toujours disponible
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
      label: 'Normal User', icon: '✅', color: '#06d6a0',
      values: {
        n_actions: 5, n_reservations: 4, n_cancellations: 0,
        mean_interval_sec: 86400, min_interval_sec: 3600,
        n_unique_events: 4, n_unique_sessions: 3, n_unique_ips: 2,
        reservations_per_hour: 0.1
      }
    },
    {
      label: 'Mass Booking', icon: '🤖', color: '#f72585',
      values: {
        n_actions: 20, n_reservations: 18, n_cancellations: 0,
        mean_interval_sec: 3, min_interval_sec: 1,
        n_unique_events: 15, n_unique_sessions: 1, n_unique_ips: 1,
        reservations_per_hour: 12
      }
    },
    {
      label: 'Repeat Cancel', icon: '🔁', color: '#f77f00',
      values: {
        n_actions: 10, n_reservations: 8, n_cancellations: 7,
        mean_interval_sec: 900, min_interval_sec: 30,
        n_unique_events: 5, n_unique_sessions: 4, n_unique_ips: 3,
        reservations_per_hour: 1.5
      }
    },
    {
      label: 'Bot Pattern', icon: '⚡', color: '#ff2d95',
      values: {
        n_actions: 25, n_reservations: 22, n_cancellations: 0,
        mean_interval_sec: 1.5, min_interval_sec: 1,
        n_unique_events: 10, n_unique_sessions: 1, n_unique_ips: 1,
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
    // HuggingFace Spaces — toujours disponible, pas de health check
    this.mlAvailable = true;
    this.loadUsersForLookup();
  }

  ngOnDestroy(): void {
    if (this.realtimeTimer) clearInterval(this.realtimeTimer);
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
          ? users.filter(u =>
              (u.fullName || '').toLowerCase().includes(q) ||
              (u.email || '').toLowerCase().includes(q) ||
              String(u.id).includes(q))
          : users;

        this.adminUsers = filtered.slice(0, 500);
        this.filteredAdminUsers = this.adminUsers.slice(0, 12);
        if (!this.selectedAdminUser && this.adminUsers.length > 0) this.selectAdminUser(this.adminUsers[0], false);
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
    if (!q) { this.filteredAdminUsers = this.adminUsers.slice(0, 12); this.cdr.markForCheck(); return; }
    this.filteredAdminUsers = this.adminUsers
      .filter(u =>
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        String(u.id).includes(q))
      .slice(0, 12);
    this.cdr.markForCheck();
  }

  selectAdminUser(user: AdminUserListItem, clearSearch = true): void {
    this.selectedAdminUser = user;
    this.form.user_id = user.id;
    if (clearSearch) { this.userSearchQuery = user.fullName || user.email || `User #${user.id}`; this.filteredAdminUsers = []; }
    this.result = null;
    this.cdr.markForCheck();
  }

  userInitials(user?: AdminUserListItem | null): string {
    const name = user?.fullName || user?.email || '?';
    return name.trim().charAt(0).toUpperCase();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANOMALY DETECT — HuggingFace fn_index: 1
  // predict_anomaly(n_actions, n_reserv, n_cancel, cancel_rate,
  //                 mean_int, std_int, min_int, max_int,
  //                 n_events, n_sessions, n_ips, reserv_h, ev_reserv)
  // ─────────────────────────────────────────────────────────────────────────
  analyze(): void {
    this.loading = true;
    this.result  = null;

    const cancel_rate         = this.form.n_cancellations / Math.max(1, this.form.n_reservations);
    const events_per_reserv   = this.form.n_unique_events  / Math.max(1, this.form.n_reservations);
    const std_interval        = this.form.mean_interval_sec * 0.3;
    const max_interval        = this.form.mean_interval_sec * 2;

    // Ordre exact des paramètres de predict_anomaly dans app.py :
    // n_actions, n_reserv, n_cancel, cancel_rate,
    // mean_int, std_int, min_int, max_int,
    // n_events, n_sessions, n_ips, reserv_h, ev_reserv
    this.http.post<any>(`${this.HF_API}/api/ml/predict`, {
      fn_index: 1,
      data: [
        this.form.n_actions,           // n_actions
        this.form.n_reservations,      // n_reserv
        this.form.n_cancellations,     // n_cancel
        cancel_rate,                   // cancel_rate
        this.form.mean_interval_sec,   // mean_int
        std_interval,                  // std_int
        this.form.min_interval_sec,    // min_int
        max_interval,                  // max_int
        this.form.n_unique_events,     // n_events
        this.form.n_unique_sessions,   // n_sessions
        this.form.n_unique_ips,        // n_ips
        this.form.reservations_per_hour, // reserv_h
        events_per_reserv              // ev_reserv
      ]
    }).subscribe({
      next: res => {
        const markdown: string = res.data?.[0] ?? '';
        this.result = this._parseAnomalyMarkdown(markdown, this.form.user_id);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Parse le Markdown retourné par predict_anomaly :
   *
   * ## 🚨 ANOMALIE DÉTECTÉE   ou   ## ✅ Comportement Normal
   * **Score ensemble :** `0.823` / 1.0
   * **Sévérité :** 🔴 Élevée
   * | Isolation Forest | `0.812` |
   * | LSTM Autoencoder | `0.834` |
   * **Seuil LSTM :** `0.0423`
   * **Précision modèle :** `0.953`
   */
  private _parseAnomalyMarkdown(md: string, userId: number): AnomalyResult {
    const isAnomaly = md.includes('ANOMALIE') || md.includes('🚨');

    const scoreMatch = md.match(/Score ensemble[^`]*`([\d.]+)`/);
    const ensScore   = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

    const isoMatch  = md.match(/Isolation Forest\s*\|\s*`([\d.]+)`/);
    const lstmMatch = md.match(/LSTM Autoencoder\s*\|\s*`([\d.]+)`/);
    const isoScore  = isoMatch  ? parseFloat(isoMatch[1])  : 0;
    const lstmError = lstmMatch ? parseFloat(lstmMatch[1]) : 0;

    // Déterminer le risk level depuis la sévérité
    let riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
    if (md.includes('Élevée') || md.includes('HIGH'))        riskLevel = 'HIGH';
    else if (md.includes('Moyenne') || md.includes('MEDIUM')) riskLevel = 'MEDIUM';
    else if (md.includes('Faible') || md.includes('LOW'))     riskLevel = 'LOW';

    // Déterminer le type d'anomalie depuis les valeurs du formulaire
    let anomalyType = 'NORMAL';
    if (isAnomaly) {
      const f = this.form;
      if (f.reservations_per_hour > 5 && f.n_unique_sessions <= 1) anomalyType = 'BOT_PATTERN';
      else if (f.n_cancellations / Math.max(1, f.n_reservations) > 0.5)  anomalyType = 'REPEAT_CANCEL';
      else if (f.n_reservations > 15 && f.mean_interval_sec < 10)         anomalyType = 'MASS_BOOKING';
      else anomalyType = 'UNUSUAL_PATTERN';
    }

    // Construire les explications de features
    const explanation: FeatureExplanation[] = [
      { feature: 'n_actions',        label: 'Actions count',          raw_value: this.form.n_actions,         z_score: this._z(this.form.n_actions, 8, 5),          flagged: this.form.n_actions > 20,           type: 'behavioral' },
      { feature: 'n_reservations',   label: 'Reservations',           raw_value: this.form.n_reservations,    z_score: this._z(this.form.n_reservations, 4, 3),     flagged: this.form.n_reservations > 12,      type: 'behavioral' },
      { feature: 'cancel_rate',      label: 'Cancellation rate',      raw_value: this.form.n_cancellations / Math.max(1, this.form.n_reservations), z_score: this._z(this.form.n_cancellations / Math.max(1, this.form.n_reservations), 0.1, 0.15), flagged: this.form.n_cancellations / Math.max(1, this.form.n_reservations) > 0.5, type: 'behavioral' },
      { feature: 'mean_interval_sec',label: 'Mean interval (sec)',    raw_value: this.form.mean_interval_sec,  z_score: this._z(this.form.mean_interval_sec, 43200, 30000), flagged: this.form.mean_interval_sec < 60, type: 'temporal'   },
      { feature: 'n_unique_ips',     label: 'Unique IPs',             raw_value: this.form.n_unique_ips,       z_score: this._z(this.form.n_unique_ips, 2, 1.5),    flagged: this.form.n_unique_ips > 5,         type: 'network'    },
      { feature: 'reserv_per_hour',  label: 'Reservations / hour',    raw_value: this.form.reservations_per_hour, z_score: this._z(this.form.reservations_per_hour, 0.2, 0.3), flagged: this.form.reservations_per_hour > 3, type: 'temporal' },
    ];

    return {
      user_id:        userId,
      is_anomaly:     isAnomaly ? 1 : 0,
      ensemble_score: ensScore,
      risk_level:     riskLevel,
      risk_label:     riskLevel,
      anomaly_type:   anomalyType,
      iso_score:      isoScore,
      lstm_error:     lstmError,
      explanation
    };
  }

  private _z(val: number, mean: number, std: number): number {
    return std === 0 ? 0 : parseFloat(((val - mean) / std).toFixed(2));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BATCH MODE — appel HF pour chaque user généré
  // ─────────────────────────────────────────────────────────────────────────
  runBatch(): void {
    this.loading = true;
    const users = this.generateBatchUsers(30);
    let completed = 0;
    const results: AnomalyResult[] = [];
    let anomalies = 0;

    users.forEach((u, idx) => {
      const cancel_rate   = u.n_cancellations / Math.max(1, u.n_reservations);
      const ev_per_reserv = u.n_unique_events  / Math.max(1, u.n_reservations);
      const std_int       = u.mean_interval_sec * 0.3;
      const max_int       = u.mean_interval_sec * 2;

      this.http.post<any>(`${this.HF_API}/api/ml/predict`, {
        fn_index: 1,
        data: [
          u.n_actions, u.n_reservations, u.n_cancellations, cancel_rate,
          u.mean_interval_sec, std_int, u.min_interval_sec, max_int,
          u.n_unique_events, u.n_unique_sessions, u.n_unique_ips,
          u.reservations_per_hour, ev_per_reserv
        ]
      }).subscribe({
        next: res => {
          const markdown: string = res.data?.[0] ?? '';
          const parsed = this._parseAnomalyMarkdown(markdown, u.user_id);
          results[idx] = parsed;
          if (parsed.is_anomaly) anomalies++;
          completed++;
          if (completed === users.length) this._finalizeBatch(results, anomalies);
          this.cdr.markForCheck();
        },
        error: () => {
          completed++;
          if (completed === users.length) this._finalizeBatch(results, anomalies);
        }
      });
    });
  }

  private _finalizeBatch(results: AnomalyResult[], anomalies: number): void {
    this.batchResults = results.filter(Boolean);
    this.batchSummary = {
      total:     this.batchResults.length,
      anomalies,
      normal:    this.batchResults.length - anomalies,
      rate:      parseFloat((anomalies / Math.max(1, this.batchResults.length) * 100).toFixed(1))
    };
    this.loading = false;
    this.cdr.markForCheck();
  }

  private generateBatchUsers(n: number): any[] {
    const users = [];
    for (let i = 1; i <= n; i++) {
      const isAnomaly = Math.random() < 0.25;
      if (!isAnomaly) {
        users.push({ user_id: i, n_actions: 3 + Math.floor(Math.random() * 10), n_reservations: 2 + Math.floor(Math.random() * 8), n_cancellations: Math.floor(Math.random() * 2), mean_interval_sec: 3600 + Math.random() * 86400, min_interval_sec: 600 + Math.random() * 3600, n_unique_events: 2 + Math.floor(Math.random() * 8), n_unique_sessions: 2 + Math.floor(Math.random() * 5), n_unique_ips: 1 + Math.floor(Math.random() * 3), reservations_per_hour: 0.05 + Math.random() * 0.3 });
      } else {
        const type = Math.floor(Math.random() * 3);
        if (type === 0) {
          users.push({ user_id: i, n_actions: 20, n_reservations: 18, n_cancellations: 0, mean_interval_sec: 2, min_interval_sec: 1, n_unique_events: 15, n_unique_sessions: 1, n_unique_ips: 1, reservations_per_hour: 12 });
        } else if (type === 1) {
          users.push({ user_id: i, n_actions: 10, n_reservations: 8, n_cancellations: 7, mean_interval_sec: 900, min_interval_sec: 30, n_unique_events: 5, n_unique_sessions: 4, n_unique_ips: 3, reservations_per_hour: 1.5 });
        } else {
          users.push({ user_id: i, n_actions: 25, n_reservations: 22, n_cancellations: 0, mean_interval_sec: 1.5, min_interval_sec: 1, n_unique_events: 10, n_unique_sessions: 1, n_unique_ips: 1, reservations_per_hour: 15 });
        }
      }
    }
    return users;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REALTIME MODE
  // ─────────────────────────────────────────────────────────────────────────
  toggleRealtime(): void {
    if (this.realtimeRunning) {
      clearInterval(this.realtimeTimer);
      this.realtimeRunning = false;
    } else {
      this.realtimeRunning = true;
      this.realtimeTimer = setInterval(() => this.realtimeTick(), 3000); // 3s pour HF (plus lent que localhost)
      this.realtimeTick();
    }
    this.cdr.markForCheck();
  }

  private realtimeTick(): void {
    const u = this.generateBatchUsers(1)[0];
    u.user_id = Math.floor(Math.random() * 1000) + 1;

    const cancel_rate   = u.n_cancellations / Math.max(1, u.n_reservations);
    const ev_per_reserv = u.n_unique_events  / Math.max(1, u.n_reservations);
    const std_int       = u.mean_interval_sec * 0.3;
    const max_int       = u.mean_interval_sec * 2;

    this.http.post<any>(`${this.HF_API}/api/ml/predict`, {
      fn_index: 1,
      data: [
        u.n_actions, u.n_reservations, u.n_cancellations, cancel_rate,
        u.mean_interval_sec, std_int, u.min_interval_sec, max_int,
        u.n_unique_events, u.n_unique_sessions, u.n_unique_ips,
        u.reservations_per_hour, ev_per_reserv
      ]
    }).subscribe({
      next: res => {
        const markdown: string = res.data?.[0] ?? '';
        const result = this._parseAnomalyMarkdown(markdown, u.user_id);
        this.realtimeLog.unshift({ time: new Date().toLocaleTimeString(), result });
        if (this.realtimeLog.length > 15) this.realtimeLog.pop();
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS UI
  // ─────────────────────────────────────────────────────────────────────────
  getRiskColor(level: string): string {
    return level === 'HIGH' ? '#f72585' : level === 'MEDIUM' ? '#f77f00' : level === 'LOW' ? '#06d6a0' : '#8892b0';
  }

  getRiskBg(level: string): string {
    return level === 'HIGH' ? 'rgba(247,37,133,.14)' : level === 'MEDIUM' ? 'rgba(247,127,0,.14)' : level === 'LOW' ? 'rgba(6,214,160,.14)' : 'rgba(255,255,255,.06)';
  }

  getAnomalyIcon(type: string): string {
    const m: Record<string, string> = {
      MASS_BOOKING:    '🤖💥',
      REPEAT_CANCEL:   '🔁⚠️',
      BOT_PATTERN:     '⚡🤖',
      SUSPICIOUS_IP:   '🌐🚨',
      UNUSUAL_PATTERN: '🧠❗',
      NORMAL:          '✅✨'
    };
    return m[type] || '🧠';
  }

  getScoreGradient(score: number): string {
    if (score >= 0.75) return 'linear-gradient(135deg, #f72585, #ff2d95)';
    if (score >= 0.5)  return 'linear-gradient(135deg, #f77f00, #ffd166)';
    if (score >= 0.35) return 'linear-gradient(135deg, #06d6a0, #00ffc6)';
    return 'linear-gradient(135deg, #4361ee, #00b4a6)';
  }

  getBarWidth(v: number): number   { return Math.round(Math.min(1, Math.max(0, v)) * 100); }
  zBarWidth(z: number):   number   { return Math.min(100, Math.abs(z) * 30); }

  toggleExpand(uid: number): void  { this.expandedUser = this.expandedUser === uid ? null : uid; this.cdr.markForCheck(); }
  openDetail(r: AnomalyResult): void  { this.selectedResult = r; this.cdr.markForCheck(); }
  closeDetail(): void { this.selectedResult = null; this.cdr.markForCheck(); }
}