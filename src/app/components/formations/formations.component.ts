import { Component, OnInit, Renderer2, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormationService } from '../../services/formation.service';
import { Formation } from '../../services/formation.models';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

const ICONS = ['💍', '🌿', '♻️', '🌸', '👗', '🌱', '📚', '🎓', '🔬', '🎨'];
const GRADIENTS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];

interface Trainer {
  id: number;
  name: string;
  role: string;
  imageUrl: string;
  specialty: string;
}

@Component({
  selector: 'app-formations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formations.component.html',
  styleUrl: './formations.component.css'
})
export class FormationsComponent implements OnInit, OnDestroy {
  formations: Formation[] = [];
  loading = true;
  error: string | null = null;
  isDark = false;
  filter = 'all';
  private pinnedIds: Set<number> = new Set();
  private readonly PINNED_KEY = 'vero_pinned_formations';
  private fabButton: HTMLElement | null = null;

  // Using UI Avatars API for professional-looking avatars with real names
  trainers: Trainer[] = [
    { 
      id: 1, 
      name: 'Sophie Martin', 
      role: 'Expert en Développement Durable', 
      imageUrl: 'https://i.pravatar.cc/150?img=5',
      specialty: 'Écologie' 
    },
    { 
      id: 2, 
      name: 'Jean Dupont', 
      role: 'Spécialiste Mode Éthique', 
      imageUrl: 'https://i.pravatar.cc/150?img=12',
      specialty: 'Mode' 
    },
    { 
      id: 3, 
      name: 'Marie Laurent', 
      role: 'Coach en Recyclage', 
      imageUrl: 'https://i.pravatar.cc/150?img=9',
      specialty: 'Recyclage' 
    },
    { 
      id: 4, 
      name: 'Pierre Dubois', 
      role: 'Formateur en Cosmétique Bio', 
      imageUrl: 'https://i.pravatar.cc/150?img=33',
      specialty: 'Cosmétique' 
    },
    { 
      id: 5, 
      name: 'Claire Bernard', 
      role: 'Experte en Zéro Déchet', 
      imageUrl: 'https://i.pravatar.cc/150?img=47',
      specialty: 'Zéro Déchet' 
    },
    { 
      id: 6, 
      name: 'Luc Moreau', 
      role: 'Consultant en Économie Circulaire', 
      imageUrl: 'https://i.pravatar.cc/150?img=15',
      specialty: 'Économie' 
    },
    { 
      id: 7, 
      name: 'Emma Petit', 
      role: 'Designer Éco-responsable', 
      imageUrl: 'https://i.pravatar.cc/150?img=32',
      specialty: 'Design' 
    },
    { 
      id: 8, 
      name: 'Thomas Roux', 
      role: 'Spécialiste en Agriculture Bio', 
      imageUrl: 'https://i.pravatar.cc/150?img=68',
      specialty: 'Agriculture' 
    }
  ];

  currentUserId: number | null = null;

  constructor(
    private formationService: FormationService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private renderer: Renderer2,
    private el: ElementRef
  ) {}

  ngOnInit(): void {
    this.loadPinnedFromStorage();
    this.loadFormations();
    this.createFabButton();
    
    // Load current user ID if logged in
    if (this.authService.isLoggedIn) {
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUserId = user.id;
          console.log('Current user ID:', this.currentUserId);
        },
        error: (err) => {
          console.error('Error loading current user:', err);
        }
      });
    }
  }

  ngOnDestroy(): void {
    // Remove FAB button when component is destroyed
    if (this.fabButton && this.fabButton.parentNode) {
      this.fabButton.parentNode.removeChild(this.fabButton);
    }
  }

  private createFabButton(): void {
    // Create FAB button and append directly to body
    this.fabButton = this.renderer.createElement('button');
    this.renderer.addClass(this.fabButton, 'fab-add-formation-global');
    this.renderer.setAttribute(this.fabButton, 'title', 'Ajouter une formation');
    this.renderer.setStyle(this.fabButton, 'position', 'fixed');
    this.renderer.setStyle(this.fabButton, 'bottom', '32px');
    this.renderer.setStyle(this.fabButton, 'right', '32px');
    this.renderer.setStyle(this.fabButton, 'width', '64px');
    this.renderer.setStyle(this.fabButton, 'height', '64px');
    this.renderer.setStyle(this.fabButton, 'border-radius', '50%');
    this.renderer.setStyle(this.fabButton, 'background', 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)');
    this.renderer.setStyle(this.fabButton, 'color', 'white');
    this.renderer.setStyle(this.fabButton, 'border', 'none');
    this.renderer.setStyle(this.fabButton, 'cursor', 'pointer');
    this.renderer.setStyle(this.fabButton, 'display', 'flex');
    this.renderer.setStyle(this.fabButton, 'align-items', 'center');
    this.renderer.setStyle(this.fabButton, 'justify-content', 'center');
    this.renderer.setStyle(this.fabButton, 'box-shadow', '0 8px 24px rgba(76,175,80,0.35)');
    this.renderer.setStyle(this.fabButton, 'z-index', '999999');
    this.renderer.setStyle(this.fabButton, 'transition', 'all 0.25s ease');

    // Create SVG icon
    const svg = this.renderer.createElement('svg', 'svg');
    this.renderer.setAttribute(svg, 'width', '24');
    this.renderer.setAttribute(svg, 'height', '24');
    this.renderer.setAttribute(svg, 'viewBox', '0 0 24 24');
    this.renderer.setAttribute(svg, 'fill', 'none');
    this.renderer.setAttribute(svg, 'stroke', 'currentColor');
    this.renderer.setAttribute(svg, 'stroke-width', '2.5');

    const line1 = this.renderer.createElement('line', 'svg');
    this.renderer.setAttribute(line1, 'x1', '12');
    this.renderer.setAttribute(line1, 'y1', '5');
    this.renderer.setAttribute(line1, 'x2', '12');
    this.renderer.setAttribute(line1, 'y2', '19');

    const line2 = this.renderer.createElement('line', 'svg');
    this.renderer.setAttribute(line2, 'x1', '5');
    this.renderer.setAttribute(line2, 'y1', '12');
    this.renderer.setAttribute(line2, 'x2', '19');
    this.renderer.setAttribute(line2, 'y2', '12');

    this.renderer.appendChild(svg, line1);
    this.renderer.appendChild(svg, line2);
    this.renderer.appendChild(this.fabButton, svg);

    // Add click event
    this.renderer.listen(this.fabButton, 'click', () => {
      this.openAddFormationModal();
    });

    // Add hover effect
    this.renderer.listen(this.fabButton, 'mouseenter', () => {
      this.renderer.setStyle(this.fabButton, 'transform', 'scale(1.1) rotate(90deg)');
      this.renderer.setStyle(this.fabButton, 'box-shadow', '0 12px 32px rgba(76,175,80,0.45)');
    });

    this.renderer.listen(this.fabButton, 'mouseleave', () => {
      this.renderer.setStyle(this.fabButton, 'transform', 'scale(1) rotate(0deg)');
      this.renderer.setStyle(this.fabButton, 'box-shadow', '0 8px 24px rgba(76,175,80,0.35)');
    });

    // Append to body
    this.renderer.appendChild(document.body, this.fabButton);
  }

  private loadPinnedFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.PINNED_KEY);
      this.pinnedIds = stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { this.pinnedIds = new Set(); }
  }

  private savePinnedToStorage(): void {
    localStorage.setItem(this.PINNED_KEY, JSON.stringify([...this.pinnedIds]));
  }

  isPinned(f: Formation): boolean {
    return this.pinnedIds.has(f.id!);
  }

  togglePin(f: Formation): void {
    if (this.pinnedIds.has(f.id!)) {
      this.pinnedIds.delete(f.id!);
    } else {
      this.pinnedIds.add(f.id!);
    }
    this.savePinnedToStorage();
  }

  loadFormations(): void {
    this.loading = true;
    this.formationService.getAll().subscribe({
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
    let list = this.filter === 'all'
      ? this.formations
      : this.formations.filter(f => f.status === this.filter);
    // pinned formations always first
    return list.slice().sort((a, b) => (this.isPinned(b) ? 1 : 0) - (this.isPinned(a) ? 1 : 0));
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

  isUserEnrolled(formation: Formation): boolean {
    if (!this.authService.isLoggedIn || !this.currentUserId) {
      return false;
    }
    const isEnrolled = formation.participantIds?.includes(this.currentUserId) || false;
    console.log(`User ${this.currentUserId} enrolled in formation ${formation.id}:`, isEnrolled, 'Participants:', formation.participantIds);
    return isEnrolled;
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

  getFormationImage(formation: Formation): string {
    // Using high-quality images from Picsum
    const imageId = 100 + ((formation.id || 0) % 50);
    return `https://picsum.photos/id/${imageId}/800/600`;
  }

  getFormationBackground(formation: Formation): string {
    // Cuberto-style colorful backgrounds
    const backgrounds = [
      'linear-gradient(135deg, #E8B4D9 0%, #D89BC7 100%)', // Pink
      'linear-gradient(135deg, #FFF4B8 0%, #FFE88C 100%)', // Yellow
      'linear-gradient(135deg, #B8E6FF 0%, #8CD4FF 100%)', // Blue
      'linear-gradient(135deg, #C8E6C9 0%, #A5D6A7 100%)', // Green
      'linear-gradient(135deg, #FFD4B8 0%, #FFBB8C 100%)', // Orange
      'linear-gradient(135deg, #E1BEE7 0%, #CE93D8 100%)', // Purple
      'linear-gradient(135deg, #FFCCBC 0%, #FFAB91 100%)', // Coral
      'linear-gradient(135deg, #B2DFDB 0%, #80CBC4 100%)'  // Teal
    ];
    return backgrounds[(formation.id || 0) % backgrounds.length];
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

  scrollTrainers(direction: 'left' | 'right'): void {
    const container = document.querySelector('.trainers-scroll') as HTMLElement;
    if (!container) return;
    const scrollAmount = 320;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }

  openAddFormationModal(): void {
    // Navigate to admin page or open modal
    this.router.navigate(['/admin']);
  }
}
