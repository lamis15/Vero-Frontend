import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormationService } from '../../services/formation.service';
import { SessionService } from '../../services/session.service';
import { Formation, FormationResource, Session } from '../../services/formation.models';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-formation-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './formation-detail.component.html',
  styleUrl: './formation-detail.component.css'
})
export class FormationDetailComponent implements OnInit {
  formation: Formation | null = null;
  sessions: Session[] = [];
  resources: FormationResource[] = [];
  loading = true;
  error: string | null = null;
  formationId: number = 0;

  currentUser: any = null;
  hasQuiz = false;
  quizSubmission: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private sessionService: SessionService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.formationId = +params['id'];
      this.loadFormationDetails();
    });
  }

  loadFormationDetails(): void {
    this.loading = true;
    this.formationService.getById(this.formationId).subscribe({
      next: (formation) => {
        this.formation = formation;
        this.loadSessions();
        this.loadResources();
        this.loadCurrentUser();
      },
      error: (err) => {
        console.error('Error loading formation:', err);
        this.error = 'Formation non trouvée';
        this.loading = false;
      }
    });
  }

  loadSessions(): void {
    this.sessionService.getByFormation(this.formationId).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading sessions:', err);
        this.sessions = [];
        this.loading = false;
      }
    });
  }

  loadResources(): void {
    this.formationService.getResources(this.formationId).subscribe({
      next: (resources) => { this.resources = resources; },
      error: (err) => { console.error('Error loading resources:', err); }
    });
  }

  loadCurrentUser(): void {
    if (!this.authService.isLoggedIn) return;
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        if (this.isParticipant() && this.formation?.status === 'COMPLETED') {
          this.checkQuiz();
        }
      },
      error: () => {}
    });
  }

  checkQuiz(): void {
    this.formationService.getQuiz(this.formationId).subscribe({
      next: () => { this.hasQuiz = true; },
      error: (err) => {
        if (err.status === 404) { this.hasQuiz = false; }
        // 403 or 409 — silently ignore
      }
    });
  }

  isParticipant(): boolean {
    return !!(this.currentUser && this.formation?.participantIds?.includes(this.currentUser.id));
  }

  canTakeQuiz(): boolean {
    return this.isParticipant() &&
           this.formation?.status === 'COMPLETED' &&
           this.hasQuiz &&
           !this.quizSubmission?.passed;
  }

  hasCertificate(): boolean {
    return this.quizSubmission?.passed === true;
  }

  goToQuiz(): void {
    this.router.navigate(['/formations', this.formationId, 'quiz']);
  }

  downloadCertificate(): void {
    this.formationService.downloadCertificate(this.formationId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'certificat.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading certificate:', err);
        this.notificationService.show('Erreur lors du téléchargement du certificat', 'error');
      }
    });
  }

  // Resources helpers
  getFileIcon(fileType: string): string {
    if (!fileType) return '📎';
    if (fileType === 'application/pdf') return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📑';
    if (fileType.startsWith('image/')) return '🖼️';
    return '📎';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  downloadResource(resourceId: number, fileName: string): void {
    const url = this.formationService.getResourceDownloadUrl(this.formationId, resourceId);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  }

  register(): void {
    if (!this.authService.isLoggedIn) {
      this.notificationService.show('Veuillez vous connecter pour vous inscrire', 'warning');
      this.router.navigate(['/login']);
      return;
    }

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.formationService.register(this.formationId, user.id).subscribe({
          next: () => {
            this.notificationService.show('Inscription réussie !', 'success');
            this.loadFormationDetails();
          },
          error: (err) => {
            console.error(err);
            const errorMsg = err.error?.message || "Erreur lors de l'inscription";
            this.notificationService.show(errorMsg, 'error');
          }
        });
      },
      error: (err) => {
        console.error(err);
        this.notificationService.show("Erreur lors de la récupération de l'utilisateur", 'error');
      }
    });
  }

  getAvailableSpots(): number {
    if (!this.formation) return 0;
    const registered = this.formation.participantIds?.length || 0;
    return this.formation.maxCapacity - registered;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'PLANNED': 'Planifiée',
      'IN_PROGRESS': 'En cours',
      'COMPLETED': 'Terminée',
      'SCHEDULED': 'Programmée',
      'CANCELLED': 'Annulée'
    };
    return labels[status] || status;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  goBack(): void {
    this.router.navigate(['/formations']);
  }
}
