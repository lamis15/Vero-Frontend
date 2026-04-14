import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormationService } from '../../services/formation.service';
import { Formation } from '../../services/formation.models';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

const ICONS = ['💍', '🌿', '♻️', '🌸', '👗', '🌱', '📚', '🎓', '🔬', '🎨'];
const GRADIENTS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];

@Component({
  selector: 'app-formations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formations.component.html',
  styleUrl: './formations.component.css'
})
export class FormationsComponent implements OnInit {
  formations: Formation[] = [];
  loading = true;
  error: string | null = null;
  isDark = false;
  filter = 'all';

  constructor(
    private formationService: FormationService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFormations();
  }

  loadFormations(): void {
    this.loading = true;
    this.formationService.getAvailable().subscribe({
      next: (data) => {
        this.formations = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des formations';
        this.loading = false;
        console.error(err);
      }
    });
  }

  filteredFormations(): Formation[] {
    if (this.filter === 'all') return this.formations;
    return this.formations.filter(f => f.status === this.filter);
  }

  register(formationId: number): void {
    if (!this.authService.isLoggedIn) {
      this.notificationService.show('Veuillez vous connecter pour vous inscrire', 'warning');
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/formations', formationId, 'checkout']);
  }

  viewDetails(formationId: number): void {
    this.router.navigate(['/formations', formationId]);
  }

  getAvailableSpots(formation: Formation): number {
    return formation.maxCapacity - (formation.participantIds?.length || 0);
  }

  hasPrice(formation: Formation): boolean {
    const p = formation.price;
    return p !== null && p !== undefined && Number(p) > 0;
  }

  getProgress(formation: Formation): number {
    if (!formation.maxCapacity) return 0;
    return Math.round(((formation.participantIds?.length || 0) / formation.maxCapacity) * 100);
  }

  getProgressClass(formation: Formation): string {
    const pct = this.getProgress(formation);
    if (pct >= 70) return 'red';
    if (pct >= 50) return 'orange';
    return 'green';
  }

  badgeClass(status: string): string {
    const map: Record<string, string> = {
      'PLANNED': 'planifiee',
      'IN_PROGRESS': 'en-cours',
      'COMPLETED': 'terminee'
    };
    return map[status] || 'planifiee';
  }

  badgeLabel(status: string): string {
    const map: Record<string, string> = {
      'PLANNED': 'Planifiée',
      'IN_PROGRESS': 'En cours',
      'COMPLETED': 'Terminée'
    };
    return map[status] || status;
  }

  getGradient(index: number): string {
    return GRADIENTS[index % GRADIENTS.length];
  }

  getIcon(formation: Formation): string {
    const idx = (formation.id || 0) % ICONS.length;
    return ICONS[idx];
  }

  tilt(e: MouseEvent, el: HTMLElement): void {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 18;
    const y = -((e.clientY - r.top) / r.height - 0.5) * 14;
    el.style.transform = `perspective(800px) rotateY(${x}deg) rotateX(${y}deg) translateY(-6px)`;
  }

  untilt(el: HTMLElement): void {
    el.style.transform = '';
  }
}
