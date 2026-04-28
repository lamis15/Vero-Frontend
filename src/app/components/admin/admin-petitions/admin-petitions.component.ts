import { ChangeDetectorRef, Component, OnInit, EventEmitter, Output, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { timeout, catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

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

type PetitionFilter =
  | 'ALL'
  | 'PENDING'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CLOSED'
  | 'ACHIEVED'
  | 'REVIEW';

type PetitionSort =
  | 'NEWEST'
  | 'SCORE_DESC'
  | 'SCORE_ASC'
  | 'SIGNATURES';

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
  @Output() error = new EventEmitter<string>();

  private readonly API = 'http://localhost:8080';

  petitions: AdminPetition[] = [];
  loading = false;
  processingIds = new Set<number>();

  filter: PetitionFilter = 'ALL';
  sortBy: PetitionSort = 'NEWEST';

  currentPage = 1;
  readonly pageSize = 6;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  private headers(): HttpHeaders {
    const token =
      localStorage.getItem('vero_access_token') ||
      localStorage.getItem('vero_jwt_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      '';

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  load(): void {
    this.loading = true;

    this.http.get<any[]>(`${this.API}/api/petitions/admin/all`, {
      headers: this.headers()
    }).pipe(
      timeout(8000),
      catchError((e) => {
        this.petitions = [];
        this.error.emit(
          e?.name === 'TimeoutError'
            ? 'Le chargement des pétitions prend trop de temps. Vérifiez /api/petitions/admin/all.'
            : e?.error?.message || 'Erreur chargement pétitions'
        );
        return of([]);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.petitions = (data || []).map(p => ({
          id: p.id,
          title: p.title || '',
          description: p.description || '',
          status: p.status || 'PENDING',
          moderationScore: p.moderationScore ?? null,
          moderationNote: p.moderationNote ?? null,
          createdAt: p.createdAt || p.created_at || '',
          category: p.category || null,
          city: p.city || null,
          userId: p.createdBy?.id ?? p.userId ?? null,
          userName: p.createdBy?.fullName ?? p.createdBy?.email ?? p.userName ?? null,
          signatureCount: p.currentSignatures ?? p.signatureCount ?? 0,
          signatureGoal: p.targetSignatures ?? p.signatureGoal ?? 100,
          currentSignatures: p.currentSignatures ?? p.signatureCount ?? 0,
          targetSignatures: p.targetSignatures ?? p.signatureGoal ?? 100,
          createdBy: p.createdBy ?? null
        }));
        this.cdr.detectChanges();
      }
    });
  }

  setFilter(value: PetitionFilter): void {
    this.filter = value;
    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredView.length / this.pageSize));
  }

  get pagedView(): AdminPetition[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredView.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (this.currentPage > 3) pages.push(-1);
    for (let i = Math.max(2, this.currentPage - 1); i <= Math.min(total - 1, this.currentPage + 1); i++) pages.push(i);
    if (this.currentPage < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  isProcessing(id: number): boolean {
    return this.processingIds.has(id);
  }

  get filteredView(): AdminPetition[] {
    let list = [...this.petitions];

    if (this.filter === 'REVIEW') {
      list = list.filter(p =>
        p.moderationScore !== null &&
        p.moderationScore >= 55 &&
        p.moderationScore < 70
      );
    } else if (this.filter !== 'ALL') {
      list = list.filter(p => p.status === this.filter);
    }

    switch (this.sortBy) {
      case 'SCORE_DESC':
        return list.sort((a, b) => (b.moderationScore ?? 0) - (a.moderationScore ?? 0));

      case 'SCORE_ASC':
        return list.sort((a, b) => (a.moderationScore ?? 0) - (b.moderationScore ?? 0));

      case 'SIGNATURES':
        return list.sort((a, b) => (b.signatureCount ?? 0) - (a.signatureCount ?? 0));

      default:
        return list.sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
    }
  }

  getCount(status: string): number {
    return this.petitions.filter(p => p.status === status).length;
  }

  getFlagged(): number {
    return this.petitions.filter(p =>
      p.moderationScore !== null &&
      p.moderationScore >= 55 &&
      p.moderationScore < 70
    ).length;
  }

  getTotalSigs(): number {
    return this.petitions.reduce((sum, p) => sum + (p.signatureCount || 0), 0);
  }

  validate(id: number): void {
    if (this.processingIds.has(id)) return;
    this.processingIds.add(id);

    this.http.put<any>(
      `${this.API}/api/petitions/${id}/validate`,
      {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        const p = this.petitions.find(item => item.id === id);
        if (p) p.status = 'ACTIVE';
        this.processingIds.delete(id);
        this.cdr.detectChanges();
        this.success.emit('✅ Pétition validée — elle est maintenant ACTIVE');
      },
      error: (e) => {
        this.processingIds.delete(id);
        this.cdr.detectChanges();
        this.error.emit(e?.error?.message || 'Erreur validation pétition');
      }
    });
  }

  reject(id: number): void {
    const reason = prompt('Raison du rejet :') || 'Rejeté par admin';
    if (this.processingIds.has(id)) return;
    this.processingIds.add(id);

    this.http.put<any>(
      `${this.API}/api/petitions/${id}/reject?reason=${encodeURIComponent(reason)}`,
      {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        const p = this.petitions.find(item => item.id === id);
        if (p) p.status = 'REJECTED';
        this.processingIds.delete(id);
        this.cdr.detectChanges();
        this.success.emit('❌ Pétition rejetée');
      },
      error: (e) => {
        this.processingIds.delete(id);
        this.cdr.detectChanges();
        this.error.emit(e?.error?.message || 'Erreur rejet pétition');
      }
    });
  }

  close(id: number): void {
    if (!confirm('Fermer cette pétition ? Elle ne pourra plus recevoir de signatures.')) return;
    if (this.processingIds.has(id)) return;
    this.processingIds.add(id);

    this.http.put<any>(
      `${this.API}/api/petitions/${id}/close`,
      {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        const p = this.petitions.find(item => item.id === id);
        if (p) p.status = 'CLOSED';
        this.processingIds.delete(id);
        this.cdr.detectChanges();
        this.success.emit('🔒 Pétition fermée');
      },
      error: (e) => {
        this.processingIds.delete(id);
        this.cdr.detectChanges();
        this.error.emit(e?.error?.message || 'Erreur fermeture pétition');
      }
    });
  }

  downloadExcel(): void {
    this.http.get(`${this.API}/api/export/petitions`, {
      headers: this.headers(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'petitions-report.xlsx';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        this.success.emit('📊 Excel téléchargé avec succès');
      },
      error: () => this.error.emit('❌ Erreur export Excel')
    });
  }

  scoreClass(score: number | null): string {
    if (score === null || score === undefined) return 'score-none';
    if (score >= 70) return 'score-high';
    if (score >= 55) return 'score-medium';
    return 'score-low';
  }

  scoreBarClass(score: number | null): string {
    return this.scoreClass(score);
  }

  scoreLabel(score: number | null): string {
    if (score === null || score === undefined) return 'Non analysée';
    if (score >= 70) return 'Clean / Haute confiance';
    if (score >= 55) return 'Review recommandé';
    return 'Risque élevé / Rejet IA';
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      PENDING: 'status-pending',
      ACTIVE: 'status-active',
      VALIDATED: 'status-validated',
      REJECTED: 'status-rejected',
      CLOSED: 'status-closed',
      ACHIEVED: 'status-achieved',
      REVIEW: 'status-review',
    };

    return m[status] || 'status-pending';
  }

  statusLabel(status: string): string {
    const m: Record<string, string> = {
      PENDING: 'En attente',
      ACTIVE: 'Active',
      VALIDATED: 'Validée',
      REJECTED: 'Rejetée',
      CLOSED: 'Fermée',
      ACHIEVED: 'Objectif atteint',
      REVIEW: 'À réviser',
    };

    return m[status] || status;
  }

  sigPct(pet: AdminPetition): number {
    const goal = pet.signatureGoal || pet.targetSignatures || 100;
    const count = pet.signatureCount || pet.currentSignatures || 0;

    return Math.min(100, Math.round((count / goal) * 100));
  }

  initials(name: string | null): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }
}