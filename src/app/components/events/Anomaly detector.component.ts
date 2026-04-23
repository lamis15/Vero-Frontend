import {
  Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

export interface FeatureExplanation {
  feature: string; label: string;
  raw_value: number; z_score: number;
  flagged: boolean; type: string;
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
  total: number; anomalies: number; normal: number; rate: number;
}

@Component({
  selector: 'app-anomaly-detector',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './anomaly detector.component.html',
  styleUrls: ['./anomaly detector.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnomalyDetectorComponent implements OnInit {

  private readonly ML_API = 'http://localhost:5000';

  // ── Mode ──────────────────────────────────────────────────
  mode: 'manual' | 'batch' | 'realtime' = 'manual';

  // ── Manual form ───────────────────────────────────────────
  form = {
    user_id:              1,
    n_actions:            5,
    n_reservations:       4,
    n_cancellations:      0,
    mean_interval_sec:    86400,
    min_interval_sec:     3600,
    n_unique_events:      4,
    n_unique_sessions:    3,
    n_unique_ips:         2,
    reservations_per_hour:0.1,
  };

  // ── State ─────────────────────────────────────────────────
  mlAvailable    = true;
  loading        = false;
  result:        AnomalyResult | null = null;
  batchResults:  AnomalyResult[]  = [];
  batchSummary:  BatchSummary | null = null;
  expandedUser:  number | null = null;
  selectedResult: AnomalyResult | null = null;

  // ── Realtime simulation ───────────────────────────────────
  realtimeLog: Array<{time: string; result: AnomalyResult}> = [];
  realtimeRunning = false;
  private realtimeTimer: any;

  // ── Presets ───────────────────────────────────────────────
  presets = [
    {
      label: 'Normal User', icon: '👤', color: '#1e6b45',
      values: { n_actions:5, n_reservations:4, n_cancellations:0,
                mean_interval_sec:86400, min_interval_sec:3600,
                n_unique_events:4, n_unique_sessions:3, n_unique_ips:2, reservations_per_hour:0.1 }
    },
    {
      label: 'Mass Booking', icon: '🤖', color: '#c0392b',
      values: { n_actions:20, n_reservations:18, n_cancellations:0,
                mean_interval_sec:3, min_interval_sec:1,
                n_unique_events:15, n_unique_sessions:1, n_unique_ips:1, reservations_per_hour:12 }
    },
    {
      label: 'Repeat Cancel', icon: '🔄', color: '#c47d0e',
      values: { n_actions:10, n_reservations:8, n_cancellations:7,
                mean_interval_sec:900, min_interval_sec:30,
                n_unique_events:5, n_unique_sessions:4, n_unique_ips:3, reservations_per_hour:1.5 }
    },
    {
      label: 'Bot Pattern', icon: '⚡', color: '#c0392b',
      values: { n_actions:25, n_reservations:22, n_cancellations:0,
                mean_interval_sec:1.5, min_interval_sec:1,
                n_unique_events:10, n_unique_sessions:1, n_unique_ips:1, reservations_per_hour:15 }
    },
  ];

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.auth.isAdmin) this.router.navigate(['/events']);
    this.checkML();
  }

  checkML(): void {
    this.http.get(`${this.ML_API}/health`).subscribe({
      next:  () => { this.mlAvailable = true;  this.cdr.markForCheck(); },
      error: () => { this.mlAvailable = false; this.cdr.markForCheck(); }
    });
  }

  applyPreset(p: any): void {
    Object.assign(this.form, p.values);
    this.cdr.markForCheck();
  }

  // ── Single user analyze ───────────────────────────────────
  analyze(): void {
    this.loading = true; this.result = null;
    const cancel_rate = this.form.n_cancellations / Math.max(1, this.form.n_reservations);
    const events_per_reservation = this.form.n_unique_events / Math.max(1, this.form.n_reservations);
    const std_interval = this.form.mean_interval_sec * 0.3;
    const max_interval = this.form.mean_interval_sec * 2;

    this.http.post<any>(`${this.ML_API}/anomaly/detect`, {
      users: [{ ...this.form, cancel_rate, events_per_reservation,
                std_interval_sec: std_interval, max_interval_sec: max_interval }]
    }).subscribe({
      next: (res) => {
        this.result  = res.results[0];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  // ── Batch simulation ──────────────────────────────────────
  runBatch(): void {
    this.loading = true;
    const users = this.generateBatchUsers(30);
    this.http.post<any>(`${this.ML_API}/anomaly/detect`, { users }).subscribe({
      next: (res) => {
        this.batchResults  = res.results;
        this.batchSummary  = res.summary;
        this.loading       = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  private generateBatchUsers(n: number): any[] {
    const users = [];
    for (let i = 1; i <= n; i++) {
      const isAnomaly = Math.random() < 0.25;
      if (!isAnomaly) {
        users.push({
          user_id: i, n_actions: 3+Math.floor(Math.random()*10),
          n_reservations: 2+Math.floor(Math.random()*8),
          n_cancellations: Math.floor(Math.random()*2),
          cancel_rate: Math.random()*0.2,
          mean_interval_sec: 3600+Math.random()*86400,
          std_interval_sec: 1000+Math.random()*5000,
          min_interval_sec: 600+Math.random()*3600,
          max_interval_sec: 86400+Math.random()*86400,
          n_unique_events: 2+Math.floor(Math.random()*8),
          n_unique_sessions: 2+Math.floor(Math.random()*5),
          n_unique_ips: 1+Math.floor(Math.random()*3),
          reservations_per_hour: 0.05+Math.random()*0.3,
          events_per_reservation: 0.5+Math.random()*2,
        });
      } else {
        const type = Math.floor(Math.random()*3);
        if (type===0) users.push({ user_id:i, n_actions:20, n_reservations:18, n_cancellations:0, cancel_rate:0, mean_interval_sec:2, std_interval_sec:0.3, min_interval_sec:1, max_interval_sec:3, n_unique_events:15, n_unique_sessions:1, n_unique_ips:1, reservations_per_hour:12, events_per_reservation:1 });
        else if (type===1) users.push({ user_id:i, n_actions:10, n_reservations:8, n_cancellations:7, cancel_rate:0.875, mean_interval_sec:900, std_interval_sec:200, min_interval_sec:30, max_interval_sec:2000, n_unique_events:5, n_unique_sessions:4, n_unique_ips:3, reservations_per_hour:1.5, events_per_reservation:0.6 });
        else users.push({ user_id:i, n_actions:25, n_reservations:22, n_cancellations:0, cancel_rate:0, mean_interval_sec:1.5, std_interval_sec:0.2, min_interval_sec:1, max_interval_sec:2, n_unique_events:10, n_unique_sessions:1, n_unique_ips:1, reservations_per_hour:15, events_per_reservation:0.5 });
      }
    }
    return users;
  }

  // ── Realtime ──────────────────────────────────────────────
  toggleRealtime(): void {
    if (this.realtimeRunning) {
      clearInterval(this.realtimeTimer);
      this.realtimeRunning = false;
    } else {
      this.realtimeRunning = true;
      this.realtimeTimer   = setInterval(() => this.realtimeTick(), 2000);
      this.realtimeTick();
    }
    this.cdr.markForCheck();
  }

  private realtimeTick(): void {
    const u = this.generateBatchUsers(1)[0];
    u.user_id = Math.floor(Math.random() * 1000) + 1;
    this.http.post<any>(`${this.ML_API}/anomaly/detect`, { users: [u] }).subscribe({
      next: (res) => {
        const r = res.results[0];
        this.realtimeLog.unshift({ time: new Date().toLocaleTimeString(), result: r });
        if (this.realtimeLog.length > 15) this.realtimeLog.pop();
        this.cdr.markForCheck();
      }
    });
  }

  // ── UI Helpers ────────────────────────────────────────────
  getRiskColor(level: string): string {
    return level==='HIGH'?'#c0392b': level==='MEDIUM'?'#c47d0e': level==='LOW'?'#1e6b45':'#8aaa96';
  }
  getRiskBg(level: string): string {
    return level==='HIGH'?'rgba(192,57,43,.08)': level==='MEDIUM'?'rgba(196,125,14,.08)': level==='LOW'?'rgba(30,107,69,.08)':'rgba(0,0,0,.04)';
  }
  getAnomalyIcon(type: string): string {
    const m: any = { MASS_BOOKING:'🤖', REPEAT_CANCEL:'🔄', BOT_PATTERN:'⚡', SUSPICIOUS_IP:'🌐', UNUSUAL_PATTERN:'⚠️', NORMAL:'✅' };
    return m[type] || '❓';
  }
  getScoreGradient(score: number): string {
    if (score>=0.75) return 'linear-gradient(135deg, #c0392b, #e74c3c)';
    if (score>=0.5)  return 'linear-gradient(135deg, #c47d0e, #e67e22)';
    if (score>=0.35) return 'linear-gradient(135deg, #27ae60, #2ecc71)';
    return 'linear-gradient(135deg, #1e6b45, #2d8f5c)';
  }
  getBarWidth(v: number): number { return Math.round(Math.min(1, v) * 100); }
  zBarWidth(z: number): number   { return Math.min(100, Math.abs(z) * 30); }

  toggleExpand(uid: number): void {
    this.expandedUser = this.expandedUser===uid ? null : uid;
    this.cdr.markForCheck();
  }
  openDetail(r: AnomalyResult): void { this.selectedResult = r; this.cdr.markForCheck(); }
  closeDetail(): void { this.selectedResult = null; this.cdr.markForCheck(); }

  ngOnDestroy(): void { if (this.realtimeTimer) clearInterval(this.realtimeTimer); }
}