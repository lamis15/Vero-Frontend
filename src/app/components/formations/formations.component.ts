import { Component, OnInit, Renderer2, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './formations.component.html',
  styleUrl: './formations.component.css'
})
export class FormationsComponent implements OnInit, OnDestroy {
  formations: Formation[] = [];
  loading = true;
  error: string | null = null;
  isDark = false;
  filter = 'all';
  showOnlyMyFormations = false;
  searchQuery = '';
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
  quizAvailableIds: Set<number> = new Set(); // formation IDs that have a quiz
  
  // Currency conversion
  currency: 'EUR' | 'DT' = 'EUR';
  private readonly EUR_TO_DT_RATE = 3.3; // Taux de conversion approximatif

  constructor(
    private formationService: FormationService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private renderer: Renderer2,
    private el: ElementRef
  ) {}

  ngOnInit(): void {
    this.loadFormations();
    
    // Load current user ID if logged in
    if (this.authService.isLoggedIn) {
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUserId = user.id;
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

  loadFormations(): void {
    this.loading = true;
    this.formationService.getAll().subscribe({
      next: (data) => {
        // Sort formations: pinned first, then by ID descending
        this.formations = data.sort((a, b) => {
          // First, sort by pinned status (pinned formations first)
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          // Then sort by ID descending within each group
          return (b.id || 0) - (a.id || 0);
        });
        this.loading = false;
        // Check quiz availability for COMPLETED formations
        data.filter(f => f.status === 'COMPLETED').forEach(f => {
          this.formationService.getQuiz(f.id!).subscribe({
            next: () => this.quizAvailableIds.add(f.id!),
            error: () => {}
          });
        });
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
    
    // Filter by search query
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      list = list.filter(f => 
        f.title.toLowerCase().includes(query) ||
        (f.description && f.description.toLowerCase().includes(query))
      );
    }
    
    // Filter by user enrollment if "Mes formations" is active
    if (this.showOnlyMyFormations && this.currentUserId) {
      list = list.filter(f => f.participantIds?.includes(this.currentUserId!) || false);
    }
    
    return list;
  }

  toggleMyFormations(): void {
    this.showOnlyMyFormations = !this.showOnlyMyFormations;
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  onSearchChange(): void {
    // La recherche se fait automatiquement via filteredFormations()
    // Cette méthode peut être utilisée pour des actions supplémentaires si nécessaire
  }

  getMyFormationsCount(): number {
    if (!this.currentUserId) return 0;
    return this.formations.filter(f => f.participantIds?.includes(this.currentUserId!) || false).length;
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

  canTakeQuiz(formation: Formation): boolean {
    return formation.status === 'COMPLETED'
      && this.isUserEnrolled(formation)
      && this.quizAvailableIds.has(formation.id!);
  }

  goToQuiz(formationId: number): void {
    this.router.navigate(['/formations', formationId, 'quiz']);
  }

  getAvailableSpots(formation: Formation): number {
    return formation.maxCapacity - (formation.participantIds?.length || 0);
  }

  isUserEnrolled(formation: Formation): boolean {
    if (!this.authService.isLoggedIn || !this.currentUserId) {
      return false;
    }
    return formation.participantIds?.includes(this.currentUserId) || false;
  }

  hasPrice(formation: Formation): boolean {
    const p = formation.price;
    return p !== null && p !== undefined && Number(p) > 0;
  }
  
  toggleCurrency(): void {
    this.currency = this.currency === 'EUR' ? 'DT' : 'EUR';
  }
  
  getDisplayPrice(formation: Formation): string {
    if (!this.hasPrice(formation)) return 'Gratuit';
    
    const price = formation.price!;
    if (this.currency === 'EUR') {
      return `€${price.toFixed(2)}`;
    } else {
      const dtPrice = price * this.EUR_TO_DT_RATE;
      return `${dtPrice.toFixed(2)} DT`;
    }
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
    // Use the imageUrl from backend if available, otherwise fallback to Picsum
    if (formation.imageUrl) {
      return formation.imageUrl;
    }
    // Fallback: Using high-quality images from Picsum
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

  togglePin(event: Event, formation: Formation): void {
    event.stopPropagation(); // Prevent card click
    
    if (!this.authService.isLoggedIn) {
      this.notificationService.show('Veuillez vous connecter pour épingler une formation', 'warning');
      return;
    }

    // Toggle pin
    this.formationService.togglePin(formation.id!).subscribe({
      next: (updatedFormation) => {
        // Update local formation
        const index = this.formations.findIndex(f => f.id === formation.id);
        if (index !== -1) {
          this.formations[index] = updatedFormation;
          // Re-sort formations to reflect pinned status
          this.formations.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (b.id || 0) - (a.id || 0);
          });
        }
        this.notificationService.show(
          updatedFormation.pinned ? 'Formation épinglée' : 'Formation désépinglée', 
          'success'
        );
      },
      error: (err) => {
        console.error('Error toggling pin:', err);
        this.notificationService.show('Erreur lors de l\'épinglage', 'error');
      }
    });
  }
}
