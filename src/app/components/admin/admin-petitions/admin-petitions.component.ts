import { Component, OnInit, EventEmitter, Output, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface AdminPetition {
  id: number;
  title: string;
  description: string;
  status: string;
  moderationScore: number | null;
  moderationNote: string | null;
  createdAt: string;
  category: string | null;
  city: string | null;
  userId: number | null;
  userName: string | null;
  signatureCount: number;
  signatureGoal: number;
  currentSignatures?: number;
  targetSignatures?: number;
  createdBy?: any;
}

@Component({
  selector: 'app-admin-petitions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-petitions.component.html',
  styleUrls: ['./admin-petitions.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AdminPetitionsComponent implements OnInit {

  @Output() success = new EventEmitter<string>();
  @Output() error   = new EventEmitter<string>();

  private readonly API = 'http://localhost:8080';

  petitions: AdminPetition[] = [];
  loading = false;
  filter: 'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CLOSED' | 'ACHIEVED' | 'REVIEW' = 'ALL';

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  private headers(): HttpHeaders {
    const token =
      localStorage.getItem('vero_access_token') ||
      localStorage.getItem('vero_jwt_token')     ||
      localStorage.getItem('token')              ||
      localStorage.getItem('authToken')          || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  // ── Load ──────────────────────────────────────────────────
  load(): void {
    this.loading = true;
    this.http.get<any[]>(`${this.API}/api/petitions/admin/all`, { headers: this.headers() }).subscribe({
      next: (data) => {
        this.petitions = data.map(p => ({
          id:               p.id,
          title:            p.title             || '',
          description:      p.description       || '',
          status:           p.status            || 'PENDING',
          moderationScore:  p.moderationScore   ?? null,
          moderationNote:   p.moderationNote    ?? null,
          createdAt:        p.createdAt         || p.created_at || '',
          category:         p.category          || null,
          city:             p.city              || null,
          userId:           p.createdBy?.id     ?? null,
          userName:         p.createdBy?.fullName ?? p.createdBy?.email ?? null,
          signatureCount:   p.currentSignatures ?? p.signatureCount  ?? 0,
          signatureGoal:    p.targetSignatures  ?? p.signatureGoal   ?? 100,
        }));
        this.loading = false;
      },
      error: (e) => {
        this.loading = false;
        this.error.emit(e?.error?.message || 'Erreur chargement pétitions');
      }
    });
  }

  // ── Filtered view (used in template as filteredView) ──────
  get filteredView(): AdminPetition[] {
    if (this.filter === 'ALL') return this.petitions;
    if (this.filter === 'REVIEW')
      return this.petitions.filter(p =>
        p.moderationScore !== null &&
        p.moderationScore! >= 55   &&
        p.moderationScore! < 70
      );
    return this.petitions.filter(p => p.status === this.filter);
  }

  // ── KPI helpers ───────────────────────────────────────────
  getCount(status: string): number {
    return this.petitions.filter(p => p.status === status).length;
  }

  getFlagged(): number {
    return this.petitions.filter(p =>
      p.moderationScore !== null &&
      p.moderationScore! >= 55   &&
      p.moderationScore! < 70
    ).length;
  }

  getTotalSigs(): number {
    return this.petitions.reduce((sum, p) => sum + (p.signatureCount || 0), 0);
  }

  // ── Actions ───────────────────────────────────────────────
  validate(id: number): void {
    this.http.put<any>(
      `${this.API}/api/petitions/${id}/validate`, {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        const p = this.petitions.find(p => p.id === id);
        if (p) p.status = 'ACTIVE';
        this.success.emit('✅ Pétition validée — elle est maintenant ACTIVE');
      },
      error: (e) => this.error.emit(e?.error?.message || 'Erreur validation pétition')
    });
  }

  reject(id: number): void {
    const reason = prompt('Raison du rejet :') || 'Rejeté par admin';
    this.http.put<any>(
      `${this.API}/api/petitions/${id}/reject?reason=${encodeURIComponent(reason)}`, {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        const p = this.petitions.find(p => p.id === id);
        if (p) p.status = 'REJECTED';
        this.success.emit('❌ Pétition rejetée');
      },
      error: (e) => this.error.emit(e?.error?.message || 'Erreur rejet pétition')
    });
  }

  close(id: number): void {
    if (!confirm('Fermer cette pétition ? Elle ne pourra plus recevoir de signatures.')) return;
    this.http.put<any>(
      `${this.API}/api/petitions/${id}/close`, {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        const p = this.petitions.find(p => p.id === id);
        if (p) p.status = 'CLOSED';
        this.success.emit('🔒 Pétition fermée');
      },
      error: (e) => this.error.emit(e?.error?.message || 'Erreur fermeture pétition')
    });
  }

  downloadExcel(): void {
    this.http.get(`${this.API}/api/export/petitions`, {
      headers: this.headers(), responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'petitions-report.xlsx'; a.click();
        window.URL.revokeObjectURL(url);
        this.success.emit('📊 Excel téléchargé avec succès');
      },
      error: () => this.error.emit('❌ Erreur export Excel')
    });
  }

  // ── Score helpers ─────────────────────────────────────────
  scoreClass(score: number | null): string {
    if (score === null || score === undefined) return 'score-none';
    if (score >= 70) return 'score-high';
    if (score >= 55) return 'score-medium';
    return 'score-low';
  }

  scoreBarClass(score: number | null): string {
    if (score === null || score === undefined) return 'score-none';
    if (score >= 70) return 'score-high';
    if (score >= 55) return 'score-medium';
    return 'score-low';
  }

  scoreLabel(score: number | null): string {
    if (score === null || score === undefined) return '—';
    if (score >= 70) return 'Haute confiance';
    if (score >= 55) return 'Nécessite révision';
    return 'Score insuffisant';
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      PENDING:   'status-pending',
      ACTIVE:    'status-active',
      VALIDATED: 'status-validated',
      REJECTED:  'status-rejected',
      CLOSED:    'status-closed',
      ACHIEVED:  'status-achieved',
      REVIEW:    'status-review',
    };
    return m[status] || '';
  }

  sigPct(pet: AdminPetition): number {
    const goal  = pet.signatureGoal  || pet.targetSignatures  || 100;
    const count = pet.signatureCount || pet.currentSignatures || 0;
    return Math.min(100, Math.round((count / goal) * 100));
  }

  initials(name: string | null): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }
}