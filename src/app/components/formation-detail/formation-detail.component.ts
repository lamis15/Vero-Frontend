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
  isInWaitlist = false;
  waitlistPosition = -1;
  
  // Countdown properties
  countdown = {
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isStarted: false,
    isExpired: false
  };
  private countdownInterval: any;

  // Unsubscription confirmation modal
  showUnsubscribeModal = false;
  isUnsubscribing = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private sessionService: SessionService,
    public authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.formationId = +params['id'];
      this.loadFormationDetails();
    });
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
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
              this.checkWaitlistStatus();
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

  checkWaitlistStatus(): void {
    if (!this.currentUser) return;
    this.formationService.getWaitlistStatus(this.formationId, this.currentUser.id).subscribe({
      next: (status) => {
        this.isInWaitlist = status.inWaitlist;
        this.waitlistPosition = status.position;
      },
      error: () => {
        this.isInWaitlist = false;
        this.waitlistPosition = -1;
      }
    });
  }

  loadSessions(): void {
    this.sessionService.getByFormation(this.formationId).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
        this.startCountdown();
      },
      error: () => {
        this.sessions = [];
        this.loading = false;
      }
    });
  }

  startCountdown(): void {
    if (this.sessions.length === 0) return;
    
    // Sort sessions by start date to get the first one
    const sortedSessions = [...this.sessions].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    
    const firstSession = sortedSessions[0];
    if (!firstSession) return;

    // Clear existing interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      this.updateCountdown(firstSession.startDate);
    }, 1000);

    // Initial update
    this.updateCountdown(firstSession.startDate);
  }

  updateCountdown(targetDate: string): void {
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const distance = target - now;

    if (distance < 0) {
      this.countdown.isExpired = true;
      this.countdown.isStarted = true;
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      return;
    }

    this.countdown.isStarted = false;
    this.countdown.isExpired = false;

    // Calculate time units
    const second = 1000;
    const minute = second * 60;
    const hour = minute * 60;
    const day = hour * 24;
    const month = day * 30; // Approximate

    this.countdown.months = Math.floor(distance / month);
    this.countdown.days = Math.floor((distance % month) / day);
    this.countdown.hours = Math.floor((distance % day) / hour);
    this.countdown.minutes = Math.floor((distance % hour) / minute);
    this.countdown.seconds = Math.floor((distance % minute) / second);
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
    
    // Check if formation has started
    if (!this.canModifyRegistration()) {
      this.notificationService.show(
        'Impossible de s\'inscrire : la formation a déjà commencé. Les inscriptions ne sont autorisées qu\'avant le début de la première session.',
        'error'
      );
      return;
    }
    
    // Check if formation is full
    if (this.getAvailableSpots() === 0) {
      // Join waitlist instead
      this.joinWaitlist();
      return;
    }
    
    this.router.navigate(['/formations', this.formationId, 'checkout']);
  }

  joinWaitlist(): void {
    if (!this.currentUser) return;
    
    // Check if formation has started
    if (!this.canModifyRegistration()) {
      this.notificationService.show(
        'Impossible de rejoindre la liste d\'attente : la formation a déjà commencé. Les inscriptions ne sont autorisées qu\'avant le début de la première session.',
        'error'
      );
      return;
    }
    
    this.formationService.joinWaitlist(this.formationId, this.currentUser.id).subscribe({
      next: (response) => {
        this.isInWaitlist = true;
        this.waitlistPosition = response.position;
        this.notificationService.show(
          `Vous êtes sur la liste d'attente (position #${response.position})`,
          'success'
        );
        this.loadFormationDetails(); // Refresh data
      },
      error: (err) => {
        this.notificationService.show(
          err.error?.message || 'Erreur lors de l\'ajout à la liste d\'attente',
          'error'
        );
      }
    });
  }

  leaveWaitlist(): void {
    if (!this.currentUser) return;
    
    this.formationService.leaveWaitlist(this.formationId, this.currentUser.id).subscribe({
      next: () => {
        this.isInWaitlist = false;
        this.waitlistPosition = -1;
        this.notificationService.show('Vous avez quitté la liste d\'attente', 'success');
        this.loadFormationDetails(); // Refresh data
      },
      error: (err) => {
        this.notificationService.show(
          err.error?.message || 'Erreur lors de la sortie de la liste d\'attente',
          'error'
        );
      }
    });
  }

  unregister(): void {
    if (!this.currentUser) return;
    
    // Check if formation has started
    if (!this.canModifyRegistration()) {
      this.notificationService.show(
        'Impossible de se désinscrire : la formation a déjà commencé. Les désinscriptions ne sont autorisées qu\'avant le début de la première session.',
        'error'
      );
      return;
    }
    
    // Show custom confirmation modal
    this.showUnsubscribeModal = true;
  }

  confirmUnsubscribe(): void {
    if (!this.currentUser) return;
    
    this.isUnsubscribing = true;
    
    this.formationService.unregister(this.formationId, this.currentUser.id).subscribe({
      next: () => {
        this.showUnsubscribeModal = false;
        this.isUnsubscribing = false;
        this.notificationService.show(
          'Vous avez été désinscrit de la formation. Une place a été libérée pour la liste d\'attente.',
          'success'
        );
        this.loadFormationDetails(); // Refresh data
      },
      error: (err) => {
        this.isUnsubscribing = false;
        this.notificationService.show(
          err.error?.message || 'Erreur lors de la désinscription',
          'error'
        );
      }
    });
  }

  cancelUnsubscribe(): void {
    this.showUnsubscribeModal = false;
    this.isUnsubscribing = false;
  }

  isParticipant(): boolean {
    if (!this.formation || !this.currentUser) return false;
    return this.formation.participantIds?.includes(this.currentUser.id) || false;
  }

  /**
   * Check if the formation has started (first session has begun)
   */
  hasFormationStarted(): boolean {
    if (!this.sessions || this.sessions.length === 0) {
      return false; // No sessions scheduled yet
    }
    
    // Find the earliest session start date and check if it has passed
    const now = new Date();
    return this.sessions.some(session => {
      if (!session.startDate) return false;
      const sessionStart = new Date(session.startDate);
      return sessionStart <= now;
    });
  }

  /**
   * Check if registration/unregistration is allowed (before first session starts)
   */
  canModifyRegistration(): boolean {
    return !this.hasFormationStarted();
  }

  isUserEnrolled(): boolean {
    if (!this.formation || !this.currentUser) return false;
    return this.formation.participantIds?.includes(this.currentUser.id) || false;
  }

  canTakeQuiz(): boolean {
    // L'utilisateur doit être inscrit à la formation
    if (!this.isParticipant()) return false;
    
    // Il doit y avoir un quiz disponible
    if (!this.hasQuiz) return false;
    
    // L'utilisateur ne doit pas avoir déjà passé le quiz
    if (this.quizPassed) return false;
    
    // La formation doit être complète (session finale terminée)
    if (!this.isFormationCompleted()) return false;
    
    return true;
  }

  /**
   * Vérifie si la formation est complète (session finale terminée)
   */
  isFormationCompleted(): boolean {
    if (!this.formation || !this.sessions || this.sessions.length === 0) {
      return false;
    }
    
    // Vérifier si la formation a le statut COMPLETED
    if (this.formation.status === 'COMPLETED') {
      return true;
    }
    
    // Sinon, vérifier manuellement si la session finale est terminée
    const finalSession = this.sessions.find(session => session.isFinalSession);
    
    if (!finalSession) {
      // S'il n'y a pas de session finale définie, la formation n'est pas complète
      return false;
    }
    
    // Vérifier si la session finale est terminée
    return finalSession.status === 'COMPLETED';
  }

  /**
   * Obtient un message informatif sur l'état du quiz
   */
  getQuizStatusMessage(): string {
    if (!this.isParticipant()) {
      return "Vous devez être inscrit à la formation pour accéder au quiz";
    }
    
    if (!this.hasQuiz) {
      return "Aucun quiz disponible pour cette formation";
    }
    
    if (this.quizPassed) {
      return "Quiz déjà réussi";
    }
    
    if (!this.isFormationCompleted()) {
      const finalSession = this.sessions.find(session => session.isFinalSession);
      if (!finalSession) {
        return "En attente de la définition de la session finale";
      }
      return "Quiz disponible après la fin de la session finale";
    }
    
    return "Quiz disponible";
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
