import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormationService } from '../../services/formation.service';
import { SessionService } from '../../services/session.service';
import { Formation, FormationResource, Session } from '../../services/formation.models';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-formation-detail',
  standalone: true,
  imports: [CommonModule],
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
  quizPassed = false;

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
        this.checkQuizStatus(); // always check quiz
        // Load user AFTER formation is ready
        if (this.authService.isLoggedIn) {
          this.authService.getCurrentUser().subscribe({
            next: (user) => {
              this.currentUser = user;
            }
          });
        }
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
      error: () => {
        this.sessions = [];
        this.loading = false;
      }
    });
  }

  loadResources(): void {
    this.formationService.getResources(this.formationId).subscribe({
      next: (resources) => { this.resources = resources; },
      error: () => { this.resources = []; }
    });
  }

  checkQuizStatus(): void {
    if (!this.formation) return;
    // Check quiz availability regardless of status
    this.formationService.getQuiz(this.formationId).subscribe({
      next: () => { this.hasQuiz = true; },
      error: () => { this.hasQuiz = false; }
    });
  }

  register(): void {
    if (!this.authService.isLoggedIn) {
      this.notificationService.show('Veuillez vous connecter pour vous inscrire', 'warning');
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/formations', this.formationId, 'checkout']);
  }

  isParticipant(): boolean {
    if (!this.formation || !this.currentUser) return false;
    return this.formation.participantIds?.includes(this.currentUser.id) || false;
  }

  isUserEnrolled(): boolean {
    if (!this.formation || !this.currentUser) return false;
    return this.formation.participantIds?.includes(this.currentUser.id) || false;
  }

  canTakeQuiz(): boolean {
    return this.isParticipant() &&
           this.hasQuiz &&
           !this.quizPassed;
  }

  hasCertificate(): boolean {
    return this.quizPassed;
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
      error: () => {
        this.notificationService.show('Erreur lors du téléchargement du certificat', 'error');
      }
    });
  }

  getAvailableSpots(): number {
    if (!this.formation) return 0;
    return this.formation.maxCapacity - (this.formation.participantIds?.length || 0);
  }

  downloadResource(resourceId: number, fileName: string): void {
    this.formationService.downloadResource(this.formationId, resourceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.notificationService.show('Erreur lors du téléchargement', 'error');
      }
    });
  }

  getDownloadUrl(resourceId: number): string {
    return `${environment.apiUrl}/api/formations/${this.formationId}/resources/${resourceId}/download`;
  }

  getFileIcon(fileType: string): string {
    if (fileType?.includes('pdf')) return '📄';
    if (fileType?.includes('word') || fileType?.includes('doc')) return '📝';
    if (fileType?.includes('powerpoint') || fileType?.includes('presentation')) return '📊';
    if (fileType?.includes('excel') || fileType?.includes('spreadsheet')) return '📈';
    if (fileType?.includes('image')) return '🖼️';
    return '📎';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
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
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  goBack(): void {
    this.router.navigate(['/formations']);
  }
}
