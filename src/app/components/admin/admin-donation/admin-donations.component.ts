import { Component, OnInit, EventEmitter, Output, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface AdminDonation {
  id: number;
  amount: number;
  type: string;
  status: string;
  fraudScore: number | null;
  fraudNote: string | null;
  donationDate: string;
  message: string | null;
  anonymous: boolean;
  transactionId: string | null;
  userId: number | null;
  userName: string | null;
  eventId: number | null;
  eventTitle: string | null;
}

export interface DonationStats {
  total: number;
  pending: number;
  pendingReview: number;
  validated: number;
  rejected: number;
  totalValidatedAmount: number;
}

@Component({
  selector: 'app-admin-donations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-donations.component.html',
  styleUrls: ['./admin-donations.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AdminDonationsComponent implements OnInit {

  @Output() success = new EventEmitter<string>();
  @Output() error   = new EventEmitter<string>();

  private readonly API = 'http://localhost:8080';

  donations: AdminDonation[] = [];
  loading = false;
  filter: 'ALL' | 'PENDING' | 'PENDING_REVIEW' | 'VALIDATED' | 'REJECTED' = 'ALL';

  stats: DonationStats = {
    total: 0, pending: 0, pendingReview: 0,
    validated: 0, rejected: 0, totalValidatedAmount: 0
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); this.loadStats(); }

  private headers(): HttpHeaders {
    const token =
      localStorage.getItem('vero_access_token') ||
      localStorage.getItem('vero_jwt_token')     ||
      localStorage.getItem('token')              ||
      localStorage.getItem('authToken')          || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  load(): void {
    this.loading = true;
    this.http.get<AdminDonation[]>(`${this.API}/api/donations`, { headers: this.headers() }).subscribe({
      next: (data) => { this.donations = data; this.loading = false; },
      error: (e) => { this.loading = false; this.error.emit(e?.error?.message || 'Erreur chargement donations'); }
    });
  }

  loadStats(): void {
    this.http.get<DonationStats>(`${this.API}/api/donations/stats`, { headers: this.headers() }).subscribe({
      next: (s) => this.stats = s,
      error: () => {}
    });
  }

  get filtered(): AdminDonation[] {
    if (this.filter === 'ALL') return this.donations;
    return this.donations.filter(d => d.status === this.filter);
  }

  validate(id: number): void {
    this.http.put<any>(`${this.API}/api/donations/${id}/validate`, {}, { headers: this.headers() }).subscribe({
      next: () => {
        const d = this.donations.find(d => d.id === id);
        if (d) d.status = 'VALIDATED';
        this.loadStats();
        this.success.emit('✅ Don validé');
      },
      error: (e) => this.error.emit(e?.error?.message || 'Erreur validation')
    });
  }

  reject(id: number): void {
    this.http.put<any>(`${this.API}/api/donations/${id}/reject`,
      { reason: 'Rejeté par admin' }, { headers: this.headers() }).subscribe({
      next: () => {
        const d = this.donations.find(d => d.id === id);
        if (d) d.status = 'REJECTED';
        this.loadStats();
        this.success.emit('❌ Don rejeté');
      },
      error: (e) => this.error.emit(e?.error?.message || 'Erreur rejet')
    });
  }

  fraudLabel(score: number | null): string {
    if (score === null || score === undefined) return '—';
    if (score >= 0.6) return 'HIGH';
    if (score >= 0.4) return 'MEDIUM';
    return 'LOW';
  }

  fraudClass(score: number | null): string {
    if (!score && score !== 0) return 'fraud-low';
    if (score >= 0.6) return 'fraud-high';
    if (score >= 0.4) return 'fraud-medium';
    return 'fraud-low';
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      PENDING:        'status-pending',
      PENDING_REVIEW: 'status-review',
      VALIDATED:      'status-validated',
      REJECTED:       'status-rejected',
    };
    return m[status] || 'status-pending';
  }

  initials(name: string | null): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }
}