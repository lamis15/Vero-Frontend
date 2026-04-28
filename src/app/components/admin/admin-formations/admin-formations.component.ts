import { Component, OnInit, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { timeout, catchError, of } from 'rxjs';
import { FormationService } from '../../../services/formation.service';
import { SessionService } from '../../../services/session.service';
import { UserService } from '../../../services/user.service';
import { NotificationService } from '../../../services/notification.service';
import { Formation, FormationResource, FormationStatus, Session, SessionStatus } from '../../../services/formation.models';

@Component({
  selector: 'app-admin-formations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-formations.html',
  styleUrls: ['./admin-formations.css', './admin-list-modal.css']
})
export class AdminFormationsComponent implements OnInit {
  formations: Formation[] = [];
  formationsLoading = false;
  showFormationModal = false;
  editingFormation: Formation | null = null;
  formationToDeleteId: number | null = null;

  // Search functionality
  searchQuery = '';
  filteredFormations: Formation[] = [];

  // ── Multi-step modal ──────────────────────────────────────────────────────
  formationStep = 1; // 1 | 2 | 3
  readonly FORMATION_STEPS = 3;

  formationForm = {
    title: '',
    description: '',
    imageUrl: '', // ← Nouveau champ ajouté
    duration: 0,
    maxCapacity: 0,
    price: 0,
    status: 'PLANNED' as FormationStatus,
    pinned: false,
    tags: [] as string[],
    isPaid: false,
  };

  readonly availableTags = ['Design', 'Tech', 'Sustainability', 'Leadership', 'HR', 'Safety'];

  // ── Formation Status Synchronization ──────────────────────────────────────
  autoSyncFormationStatus = true; // Option pour activer/désactiver la synchronisation automatique

  generatingDescription = false;

  // Currency conversion
  showInTND = false;
  eurToTndRate = 3.3;

  // ── Sessions ──────────────────────────────────────────────────────────────
  selectedFormationForSessions: Formation | null = null;
  sessions: Session[] = [];
  sessionsLoading = false;
  showSessionModal = false;
  editingSession: Session | null = null;
  sessionForm = {
    title: '',
    startDate: '',
    endDate: '',
    status: 'SCHEDULED' as SessionStatus,
    type: 'ONLINE' as 'ONLINE' | 'IN_PERSON',
    meetLink: '',
    trainerId: 0,
    formationId: 0,
    isFinalSession: false
  };

  allUsers: any[] = [];
  expandedFormationId: number | null = null;

  // ── Admin Management ──────────────────────────────────────────────────────
  showAdminListModal = false;
  adminUsers: any[] = [];
  adminListLoading = false;

  // ── Session Resources ─────────────────────────────────────────────────────
  selectedSessionResourceFile: File | null = null;
  sessionResourceUploading = false;
  sessionResources: any[] = [];
  selectedSessionForResources: Session | null = null;

  // ── Resources ─────────────────────────────────────────────────────────────
  selectedResourceFile: File | null = null;
  resourceUploading = false;
  formationResources: FormationResource[] = [];

  // ── Quiz ──────────────────────────────────────────────────────────────────
  showQuizModal = false;
  generatingQuiz = false;
  showQuizPreviewModal = false;
  quizPreview: any = null;
  quizPreviewAnswers: Map<number, number> = new Map();
  quizPreviewSubmitting = false;
  quizPreviewResult: any = null;
  quizPreviewLoading = false;
  quizForm: {
    title: string;
    passingScore: number;
    questions: Array<{ text: string; options: Array<{ text: string; isCorrect: boolean }> }>;
  } = { title: '', passingScore: 80, questions: [] };

  readonly formationStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
  readonly FormationStatus = FormationStatus; // expose enum to template
  readonly sessionStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  constructor(
    private formationService: FormationService,
    private sessionService: SessionService,
    private userService: UserService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadAllUsers();
    this.loadFormations();
  }

  // ── Step helpers ──────────────────────────────────────────────────────────

  get stepTitle(): string {
    const titles: Record<number, string> = {
      1: 'About this formation',
      2: 'Capacity & pricing',
      3: 'Review & publish',
    };
    return titles[this.formationStep];
  }

  get stepSubtitle(): string {
    const subs: Record<number, string> = {
      1: 'Give it a name and describe what learners will achieve.',
      2: 'Set the logistics — duration, spots, and cost.',
      3: 'Choose the initial status and visibility options.',
    };
    return subs[this.formationStep];
  }

  nextStep(): void {
    if (this.formationStep === 1 && !this.formationForm.title.trim()) {
      this.notificationService.error('Title is required.');
      return;
    }
    if (this.formationStep < this.FORMATION_STEPS) {
      this.formationStep++;
    } else {
      this.saveFormation();
    }
  }

  prevStep(): void {
    if (this.formationStep > 1) this.formationStep--;
  }

  toggleTag(tag: string): void {
    const idx = this.formationForm.tags.indexOf(tag);
    if (idx === -1) this.formationForm.tags.push(tag);
    else this.formationForm.tags.splice(idx, 1);
  }

  hasTag(tag: string): boolean {
    return this.formationForm.tags.includes(tag);
  }

  setIsPaid(paid: boolean): void {
    this.formationForm.isPaid = paid;
    // Don't automatically set price to 0 - let user control the price independently
    // if (!paid) this.formationForm.price = 0;
  }

  setFormationStatus(status: FormationStatus): void {
    this.formationForm.status = status;
  }

  togglePin(formation: Formation): void {
    const updatedFormation = { ...formation, pinned: !formation.pinned };
    this.formationService.update(updatedFormation).subscribe({
      next: () => {
        formation.pinned = !formation.pinned;
        this.notificationService.success(`Formation ${formation.pinned ? 'pinned' : 'unpinned'}.`);
        this.cdr.detectChanges();
      },
      error: () => this.notificationService.error('Failed to update formation.')
    });
  }

  // ── Currency conversion ───────────────────────────────────────────────────

  toggleCurrency(): void {
    this.showInTND = !this.showInTND;
  }

  onPriceChange(value: number): void {
    console.log('Price change - Input value:', value, 'showInTND:', this.showInTND); // Debug log
    if (this.showInTND) {
      // Convert from TND to EUR
      this.formationForm.price = value / this.eurToTndRate;
    } else {
      // Direct EUR value
      this.formationForm.price = value;
    }
    console.log('Price change - Final price:', this.formationForm.price); // Debug log
  }

  // ── Modal open/close ──────────────────────────────────────────────────────

  openFormationModal(formation?: Formation): void {
    this.formationStep = 1;
    if (formation) {
      this.editingFormation = formation;
      console.log('Editing formation:', formation); // Debug log
      this.formationForm = {
        title: formation.title,
        description: formation.description,
        imageUrl: formation.imageUrl || '',
        duration: formation.duration,
        maxCapacity: formation.maxCapacity,
        price: formation.price || 0,
        status: formation.status,
        pinned: formation.pinned || false,
        tags: formation.tags || [],
        isPaid: (formation.price ?? 0) > 0,
      };
      console.log('Form data loaded:', this.formationForm); // Debug log
    } else {
      this.editingFormation = null;
      this.formationForm = {
        title: '',
        description: '',
        imageUrl: '',
        duration: 0,
        maxCapacity: 0,
        price: 0,
        status: 'PLANNED' as FormationStatus,
        pinned: false,
        tags: [],
        isPaid: false,
      };
    }
    this.showFormationModal = true;
  }

  closeFormationModal(): void {
    this.showFormationModal = false;
    this.editingFormation = null;
    this.formationStep = 1;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  saveFormation(): void {
    if (!this.formationForm.title.trim()) {
      this.notificationService.error('Title is required.');
      return;
    }

    // Prepare data without forcing price logic
    const data: any = {
      ...this.formationForm,
      // Keep the actual price value, don't force it to 0
      price: this.formationForm.price || 0,
    };

    // Remove isPaid from the data sent to backend (it's a UI helper only)
    delete data.isPaid;

    if (this.editingFormation) {
      // Preserve all existing properties for update
      data.id = this.editingFormation.id;
      data.participantIds = this.editingFormation.participantIds || [];
      data.waitlistIds = this.editingFormation.waitlistIds || [];
      // Ensure pinned is properly set
      if (data.pinned === undefined || data.pinned === null) {
        data.pinned = this.editingFormation.pinned || false;
      }

      console.log('Updating formation with data:', data); // Debug log
      console.log('Original form data:', this.formationForm); // Debug log

      this.formationService.update(data).subscribe({
        next: (updatedFormation) => {
          console.log('Formation updated successfully:', updatedFormation); // Debug log

          // Update the formation in the local array to reflect changes immediately
          const index = this.formations.findIndex(f => f.id === updatedFormation.id);
          if (index !== -1) {
            this.formations[index] = updatedFormation;
            console.log('Updated formation in local array:', this.formations[index]); // Debug log
          }

          this.notificationService.success('Formation updated.');
          this.loadFormations(); // Reload to ensure consistency
          this.closeFormationModal();
        },
        error: (error) => {
          console.error('Failed to update formation:', error); // Debug log
          this.notificationService.error('Failed to update formation: ' + (error.error?.message || error.message || 'Unknown error'));
        }
      });
    } else {
      // For new formations, ensure pinned is set
      if (data.pinned === undefined || data.pinned === null) {
        data.pinned = false;
      }

      console.log('Creating formation with data:', data); // Debug log

      this.formationService.create(data).subscribe({
        next: (createdFormation) => {
          console.log('Formation created successfully:', createdFormation); // Debug log
          this.notificationService.success('Formation created.');
          this.loadFormations();
          this.closeFormationModal();
        },
        error: (error) => {
          console.error('Failed to create formation:', error); // Debug log
          this.notificationService.error('Failed to create formation: ' + (error.error?.message || error.message || 'Unknown error'));
        }
      });
    }
  }

  // ── Test method for debugging (remove after fixing) ──────────────────────

  testFormationUpdate(formation: Formation): void {
    console.log('=== TESTING FORMATION UPDATE ===');
    console.log('Original formation:', formation);

    const testData = {
      ...formation,
      price: 99.99 // Test price only, keep original title
    };

    console.log('Test data to send:', testData);

    this.formationService.update(testData).subscribe({
      next: (result) => {
        console.log('Update result:', result);
        this.notificationService.success('Test update successful!');
        this.loadFormations();
      },
      error: (error) => {
        console.error('Test update failed:', error);
        this.notificationService.error('Test update failed: ' + error.message);
      }
    });
  }

  // ── AI description ────────────────────────────────────────────────────────

  generateDescription(): void {
    if (!this.formationForm.title.trim()) {
      this.notificationService.error('Please enter a title first.');
      return;
    }
    this.generatingDescription = true;
    this.formationService.generateDescription(this.formationForm.title, this.formationForm.duration).subscribe({
      next: (res) => { this.formationForm.description = res.description; this.generatingDescription = false; },
      error: () => { this.notificationService.error('Error generating description.'); this.generatingDescription = false; }
    });
  }

  // ── Everything below is unchanged from original ───────────────────────────

  loadAllUsers(): void {
    this.userService.getAll().subscribe({
      next: (response: any) => {
        // Handle both array and paginated response
        this.allUsers = Array.isArray(response) ? response : (response?.content ?? []);
      },
      error: () => {
        this.allUsers = [];
      }
    });
  }

  get trainers(): any[] {
    if (!Array.isArray(this.allUsers)) return [];
    return this.allUsers.filter(u => u.role === 'TRAINER' || u.role === 'ADMIN' || u.role === 'USER');
  }

  // ── Admin Management Methods ──────────────────────────────────────────────

  /**
   * Filtre et retourne uniquement les utilisateurs avec le rôle ADMIN
   */
  get administrators(): any[] {
    if (!Array.isArray(this.allUsers)) return [];
    return this.allUsers.filter(u => u.role === 'ADMIN');
  }

  /**
   * Ouvre le modal de la liste des administrateurs
   */
  openAdminListModal(): void {
    this.showAdminListModal = true;
    this.loadAdminUsers();
  }

  /**
   * Ferme le modal de la liste des administrateurs
   */
  closeAdminListModal(): void {
    this.showAdminListModal = false;
    this.adminUsers = [];
  }

  /**
   * Charge spécifiquement les utilisateurs administrateurs
   */
  loadAdminUsers(): void {
    this.adminListLoading = true;
    this.userService.getAll().subscribe({
      next: (response: any) => {
        const users = Array.isArray(response) ? response : (response?.content ?? []);
        this.adminUsers = users.filter((user: any) => user.role === 'ADMIN');
        this.adminListLoading = false;
        console.log('Administrateurs chargés:', this.adminUsers);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des administrateurs:', error);
        this.notificationService.error('Erreur lors du chargement des administrateurs');
        this.adminUsers = [];
        this.adminListLoading = false;
      }
    });
  }

  /**
   * Formate la date de création d'un utilisateur
   */
  formatUserCreationDate(dateString: string): string {
    if (!dateString) return 'Date inconnue';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Retourne les initiales d'un nom complet
   */
  getUserInitials(fullName: string): string {
    if (!fullName) return '?';
    return fullName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  // ── Session Resources Management ──────────────────────────────────────────

  /**
   * Sélectionne un fichier de ressource pour une session
   */
  onSessionResourceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedSessionResourceFile = input.files[0];
    }
  }

  /**
   * Upload une ressource pour une session
   */
  uploadSessionResource(sessionId: number): void {
    if (!this.selectedSessionResourceFile) {
      this.notificationService.error('Veuillez sélectionner un fichier.');
      return;
    }

    this.sessionResourceUploading = true;
    this.sessionService.uploadResource(sessionId, this.selectedSessionResourceFile).subscribe({
      next: () => {
        this.notificationService.success('Ressource de session uploadée avec succès.');
        this.selectedSessionResourceFile = null;
        this.sessionResourceUploading = false;
        this.loadSessionResources(sessionId);
        // Reset file input
        const fileInput = document.getElementById('sessionResFile') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      },
      error: (error) => {
        console.error('Erreur lors de l\'upload de la ressource de session:', error);
        this.notificationService.error('Erreur lors de l\'upload de la ressource de session.');
        this.sessionResourceUploading = false;
      }
    });
  }

  /**
   * Charge les ressources d'une session
   */
  loadSessionResources(sessionId: number): void {
    this.sessionService.getResources(sessionId).subscribe({
      next: (resources) => {
        this.sessionResources = resources;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des ressources de session:', error);
        this.sessionResources = [];
      }
    });
  }

  /**
   * Supprime une ressource de session
   */
  deleteSessionResource(sessionId: number, resourceId: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette ressource de session ?')) return;

    this.sessionService.deleteResource(sessionId, resourceId).subscribe({
      next: () => {
        this.notificationService.success('Ressource de session supprimée.');
        this.loadSessionResources(sessionId);
      },
      error: (error) => {
        console.error('Erreur lors de la suppression de la ressource de session:', error);
        this.notificationService.error('Erreur lors de la suppression de la ressource de session.');
      }
    });
  }

  /**
   * Télécharge une ressource de session
   */
  downloadSessionResource(sessionId: number, resourceId: number, fileName: string): void {
    this.sessionService.downloadResource(sessionId, resourceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Erreur lors du téléchargement de la ressource de session:', error);
        this.notificationService.error('Erreur lors du téléchargement de la ressource de session.');
      }
    });
  }

  /**
   * Ouvre le gestionnaire de ressources pour une session
   */
  openSessionResourceManager(session: Session): void {
    this.selectedSessionForResources = session;
    this.loadSessionResources(session.id!);
  }

  /**
   * Ferme le gestionnaire de ressources de session
   */
  closeSessionResourceManager(): void {
    this.selectedSessionForResources = null;
    this.sessionResources = [];
    this.selectedSessionResourceFile = null;
  }

  getTrainerName(trainerId: number): string {
    if (!Array.isArray(this.allUsers)) return '—';
    const trainer = this.allUsers.find(u => u.id === trainerId);
    return trainer ? trainer.fullName : '—';
  }

  toggleParticipantsPanel(formationId: number): void {
    this.expandedFormationId = this.expandedFormationId === formationId ? null : formationId;
  }

  getParticipantDetails(participantIds: number[]): any[] {
    if (!participantIds || participantIds.length === 0) return [];
    if (!Array.isArray(this.allUsers)) return [];
    return participantIds
      .map(id => this.allUsers.find(user => user.id === id))
      .filter(user => user !== undefined);
  }

  getComputedSessionStatus(session: Session): string {
    const now = new Date();
    const start = new Date(session.startDate);
    const end = new Date(session.endDate);
    if ((session as any).status === 'CANCELLED') return 'CANCELLED';
    if (now < start) return 'SCHEDULED';
    if (now >= start && now <= end) return 'IN_PROGRESS';
    return 'COMPLETED';
  }

  getComputedSessionStatusLabel(session: Session): string {
    const now = new Date();
    const start = session.startDate ? new Date(session.startDate) : null;
    const end = session.endDate ? new Date(session.endDate) : null;
    if ((session as any).status === 'CANCELLED') return 'Cancelled';
    if (!start) return 'Upcoming';
    if (now < start) return 'Upcoming';
    if (end && now >= start && now <= end) return 'In Progress';
    return 'Done';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  loadFormations(): void {
    this.formationsLoading = true;
    this.cdr.detectChanges();
    this.formationService.getAll().pipe(
      timeout(15000),
      catchError(() => {
        this.notificationService.error('Formations request timed out.');
        this.formationsLoading = false;
        this.cdr.detectChanges();
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        // Sort formations: pinned first, then by ID descending
        this.formations = data.sort((a, b) => {
          // First, sort by pinned status (pinned formations first)
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          // Then sort by ID descending within each group
          return (b.id || 0) - (a.id || 0);
        });
        this.filterFormations();
        this.formationsLoading = false;
        this.cdr.detectChanges();

        // Synchroniser automatiquement tous les statuts de formation au chargement initial
        if (this.autoSyncFormationStatus && this.formations.length > 0) {
          setTimeout(() => {
            this.formations.forEach(formation => {
              if (formation.id) {
                this.syncFormationStatusWithFirstSession(formation.id);
              }
            });
          }, 1000); // Délai pour éviter trop de requêtes simultanées
        }
      },
      error: () => {
        this.notificationService.error('Failed to load formations.');
        this.formationsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Search functionality ──────────────────────────────────────────────────

  filterFormations(): void {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.filteredFormations = [...this.formations];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredFormations = this.formations.filter(formation =>
        formation.title.toLowerCase().includes(query) ||
        (formation.description && formation.description.toLowerCase().includes(query))
      );
    }
  }

  onSearchChange(): void {
    this.filterFormations();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterFormations();
  }

  openDeleteConfirm(id: number): void {
    this.formationToDeleteId = id;
  }

  cancelDeleteFormation(): void {
    this.formationToDeleteId = null;
  }

  confirmDeleteFormation(): void {
    if (this.formationToDeleteId === null) return;
    const id = this.formationToDeleteId;
    this.formationToDeleteId = null;

    this.formationService.delete(Number(id)).subscribe({
      next: () => {
        const numericId = Number(id);
        this.formations = this.formations.filter(f => Number(f.id) !== numericId);
        this.notificationService.success('Formation deleted.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        // Handle 204 No Content which might be treated as an error if empty response is expected to be JSON
        if (err.status === 204 || err.status === 200) {
          const numericId = Number(id);
          this.formations = this.formations.filter(f => Number(f.id) !== numericId);
          this.notificationService.success('Formation deleted.');
          this.cdr.detectChanges();
        } else {
          this.notificationService.error('Failed to delete formation.');
          console.error('Delete error:', err);
        }
      }
    });
  }

  deleteFormation(id: number): void {
    this.openDeleteConfirm(id);
  }

  updateFormationStatus(id: number, status: FormationStatus): void {
    this.formationService.updateStatus(id, status).subscribe({
      next: () => { this.notificationService.success('Status updated.'); this.loadFormations(); },
      error: () => this.notificationService.error('Failed to update status.')
    });
  }

  viewFormationSessions(formation: Formation): void {
    this.selectedFormationForSessions = formation;
    this.sessionsLoading = true;
    this.sessionService.getByFormation(formation.id!).subscribe({
      next: (s) => { this.sessions = s; this.sessionsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.notificationService.error('Failed to load sessions.'); this.sessionsLoading = false; }
    });
    this.loadResources(formation.id!);
  }

  closeSessionsView(): void {
    this.selectedFormationForSessions = null;
    this.sessions = [];
  }

  openSessionModal(session?: Session): void {
    if (!this.selectedFormationForSessions) return;
    if (this.allUsers.length === 0) this.loadAllUsers();
    if (session) {
      this.editingSession = session;
      this.sessionForm = {
        title: session.title,
        startDate: session.startDate?.slice(0, 16) || '',
        endDate: session.endDate?.slice(0, 16) || '',
        status: session.status as SessionStatus,
        type: (session as any).type || 'ONLINE',
        meetLink: (session as any).meetLink || '',
        trainerId: session.trainerId || 0,
        formationId: this.selectedFormationForSessions.id!,
        isFinalSession: session.isFinalSession || false
      };
    } else {
      this.editingSession = null;
      this.sessionForm = {
        title: '', startDate: '', endDate: '', status: 'SCHEDULED' as SessionStatus,
        type: 'ONLINE', meetLink: '', trainerId: 0, formationId: this.selectedFormationForSessions.id!,
        isFinalSession: false
      };
    }
    this.showSessionModal = true;
  }

  closeSessionModal(): void {
    this.showSessionModal = false;
    this.editingSession = null;
  }

  saveSession(): void {
    if (!this.sessionForm.title.trim()) { this.notificationService.error('Session title is required.'); return; }
    if (!this.sessionForm.startDate) { this.notificationService.error('Start date is required.'); return; }
    if (!this.sessionForm.endDate) { this.notificationService.error('End date is required.'); return; }

    // Validation: Only one final session per formation
    if (this.sessionForm.isFinalSession) {
      const existingFinalSession = this.sessions.find(s =>
        s.isFinalSession === true && s.id !== this.editingSession?.id
      );
      if (existingFinalSession) {
        this.notificationService.error('Only one session can be marked as final per formation. Please unmark the existing final session first.');
        return;
      }
    }

    const now = new Date();
    const start = new Date(this.sessionForm.startDate);
    const end = new Date(this.sessionForm.endDate);
    let computedStatus: SessionStatus = 'SCHEDULED' as SessionStatus;
    if (now >= start && now <= end) computedStatus = 'IN_PROGRESS' as SessionStatus;
    else if (now > end) computedStatus = 'COMPLETED' as SessionStatus;

    const data: any = { ...this.sessionForm, status: computedStatus, type: 'ONLINE' };
    if (this.editingSession) {
      data.id = this.editingSession.id;
      this.sessionService.update(data).subscribe({
        next: () => {
          this.notificationService.success('Session updated.');
          this.viewFormationSessions(this.selectedFormationForSessions!);
          this.closeSessionModal();

          // Synchroniser automatiquement le statut de la formation
          if (this.selectedFormationForSessions?.id) {
            this.syncFormationStatusWithFirstSession(this.selectedFormationForSessions.id);
          }
        },
        error: () => this.notificationService.error('Failed to update session.')
      });
    } else {
      this.sessionService.create(data, this.selectedFormationForSessions!.id!).subscribe({
        next: () => {
          this.notificationService.success('Session created.');
          this.viewFormationSessions(this.selectedFormationForSessions!);
          this.closeSessionModal();

          // Synchroniser automatiquement le statut de la formation
          if (this.selectedFormationForSessions?.id) {
            this.syncFormationStatusWithFirstSession(this.selectedFormationForSessions.id);
          }
        },
        error: () => this.notificationService.error('Failed to create session.')
      });
    }
  }

  deleteSession(id: number): void {
    this.sessionService.delete(id).subscribe({
      next: () => {
        this.sessions = this.sessions.filter(s => s.id !== id);
        this.notificationService.success('Session deleted.');

        // Synchroniser automatiquement le statut de la formation après suppression
        if (this.selectedFormationForSessions?.id) {
          this.syncFormationStatusWithFirstSession(this.selectedFormationForSessions.id);
        }
      },
      error: () => this.notificationService.error('Failed to delete session.')
    });
  }

  updateSessionStatus(id: number, status: SessionStatus): void {
    this.sessionService.updateStatus(id, status).subscribe({
      next: () => {
        this.notificationService.success('Session status updated!');
        this.viewFormationSessions(this.selectedFormationForSessions!);

        // Synchroniser automatiquement le statut de la formation
        if (this.selectedFormationForSessions?.id) {
          this.syncFormationStatusWithFirstSession(this.selectedFormationForSessions.id);
        }
      },
      error: () => this.notificationService.error('Error updating session status.')
    });
  }

  onResourceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedResourceFile = input.files[0];
    }
  }

  uploadResource(formationId: number): void {
    if (!this.selectedResourceFile) { this.notificationService.error('Please select a file.'); return; }
    this.resourceUploading = true;
    this.formationService.uploadResource(formationId, this.selectedResourceFile).subscribe({
      next: () => {
        this.notificationService.success('Resource uploaded successfully.');
        this.selectedResourceFile = null;
        this.resourceUploading = false;
        this.loadResources(formationId);
      },
      error: () => { this.notificationService.error('Error uploading resource.'); this.resourceUploading = false; }
    });
  }

  deleteResource(formationId: number, resourceId: number): void {
    if (!confirm('Delete this resource?')) return;
    this.formationService.deleteResource(formationId, resourceId).subscribe({
      next: () => { this.notificationService.success('Resource deleted.'); this.loadResources(formationId); },
      error: () => this.notificationService.error('Error deleting resource.')
    });
  }

  loadResources(formationId: number): void {
    this.formationService.getResources(formationId).subscribe({
      next: (resources) => { this.formationResources = resources; },
      error: () => { }
    });
  }

  downloadResource(formationId: number, resourceId: number, fileName: string): void {
    this.formationService.downloadResource(formationId, resourceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.notificationService.error('Error downloading resource.')
    });
  }

  generateQuizFromResources(): void {
    if (!this.selectedFormationForSessions) {
      this.notificationService.error('Please select a formation first.');
      return;
    }
    if (this.formationResources.length === 0) {
      this.notificationService.error('Upload resources for this formation first.');
      return;
    }
    this.generatingQuiz = true;
    this.formationService.generateQuizFromResources(this.selectedFormationForSessions.id!, 10).subscribe({
      next: () => {
        this.notificationService.success('Quiz generated!');
        this.generatingQuiz = false;
        this.router.navigate(['/formations', this.selectedFormationForSessions!.id, 'quiz'], {
          queryParams: { preview: 'true', from: 'admin' }
        });
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || err?.message || 'Error generating quiz.');
        this.generatingQuiz = false;
      }
    });
  }

  async openQuizPreview(formationId: number): Promise<void> {
    // Vérifier l'accès au quiz avant de l'ouvrir
    const canAccess = await this.canAccessQuiz(formationId);
    if (!canAccess) {
      this.notificationService.error('Le quiz ne sera accessible qu\'après la completion de la session finale.');
      return;
    }

    this.quizPreviewLoading = true;
    this.quizPreviewAnswers = new Map();
    this.quizPreviewResult = null;
    this.showQuizPreviewModal = true;
    this.formationService.getQuizPreview(formationId).subscribe({
      next: (quiz) => { this.quizPreview = quiz; this.quizPreviewLoading = false; },
      error: () => {
        this.notificationService.error('Error loading quiz.');
        this.showQuizPreviewModal = false;
        this.quizPreviewLoading = false;
      }
    });
  }

  closeQuizPreviewModal(): void {
    this.showQuizPreviewModal = false;
    this.quizPreview = null;
    this.quizPreviewAnswers = new Map();
    this.quizPreviewResult = null;
  }

  selectQuizPreviewOption(questionId: number, optionId: number): void {
    this.quizPreviewAnswers.set(questionId, optionId);
  }

  isQuizPreviewSelected(questionId: number, optionId: number): boolean {
    return this.quizPreviewAnswers.get(questionId) === optionId;
  }

  allQuizPreviewAnswered(): boolean {
    if (!this.quizPreview) return false;
    return this.quizPreviewAnswers.size === this.quizPreview.questions.length;
  }

  submitQuizPreview(): void {
    if (!this.allQuizPreviewAnswered() || !this.selectedFormationForSessions) return;
    this.quizPreviewSubmitting = true;
    const answers = Array.from(this.quizPreviewAnswers.entries()).map(([questionId, selectedOptionId]) => ({
      questionId, selectedOptionId
    }));
    this.formationService.submitQuiz(this.selectedFormationForSessions.id!, answers).subscribe({
      next: (result) => { this.quizPreviewResult = result; this.quizPreviewSubmitting = false; },
      error: () => { this.notificationService.error('Error submitting quiz.'); this.quizPreviewSubmitting = false; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════════
  // FORMATION STATUS SYNCHRONIZATION WITH FIRST SESSION
  // ═══════════════════════════════════════════════════════════════════════════════════

  /**
   * Synchronise automatiquement le statut de la formation avec le statut de la première session
   * et prend en compte les sessions finales pour déterminer la completion
   * @param formationId ID de la formation à synchroniser
   */
  private syncFormationStatusWithFirstSession(formationId: number): void {
    if (!this.autoSyncFormationStatus) return;

    this.sessionService.getByFormation(formationId).subscribe({
      next: (sessions) => {
        if (sessions.length === 0) {
          // Aucune session : formation reste en PLANNED
          this.updateFormationStatusIfNeeded(formationId, FormationStatus.PLANNED);
          return;
        }

        // Vérifier s'il y a une session finale
        const finalSession = sessions.find(session => session.isFinalSession === true);

        if (finalSession) {
          // S'il y a une session finale, le statut de la formation dépend UNIQUEMENT de cette session finale
          if (finalSession.status === SessionStatus.COMPLETED) {
            // Session finale terminée → Formation terminée
            console.log(`🏁 Session finale terminée: Formation ${formationId} → COMPLETED`);
            this.updateFormationStatusIfNeeded(formationId, FormationStatus.COMPLETED);
          } else if (finalSession.status === SessionStatus.IN_PROGRESS) {
            // Session finale en cours → Formation en cours
            console.log(`🚀 Session finale en cours: Formation ${formationId} → IN_PROGRESS`);
            this.updateFormationStatusIfNeeded(formationId, FormationStatus.IN_PROGRESS);
          } else {
            // Session finale pas encore commencée → Vérifier les autres sessions
            const otherSessions = sessions.filter(s => !s.isFinalSession);
            if (otherSessions.length > 0) {
              // S'il y a d'autres sessions, utiliser leur statut pour déterminer le statut de la formation
              const hasInProgressSession = otherSessions.some(s => s.status === SessionStatus.IN_PROGRESS);
              const hasCompletedSession = otherSessions.some(s => s.status === SessionStatus.COMPLETED);

              if (hasInProgressSession) {
                console.log(`📚 Sessions intermédiaires en cours: Formation ${formationId} → IN_PROGRESS`);
                this.updateFormationStatusIfNeeded(formationId, FormationStatus.IN_PROGRESS);
              } else if (hasCompletedSession) {
                console.log(`📚 Sessions intermédiaires terminées, finale pas encore commencée: Formation ${formationId} → IN_PROGRESS`);
                this.updateFormationStatusIfNeeded(formationId, FormationStatus.IN_PROGRESS);
              } else {
                console.log(`📅 Aucune session commencée: Formation ${formationId} → PLANNED`);
                this.updateFormationStatusIfNeeded(formationId, FormationStatus.PLANNED);
              }
            } else {
              // Seule la session finale existe et elle n'est pas commencée
              console.log(`📅 Session finale pas encore commencée: Formation ${formationId} → PLANNED`);
              this.updateFormationStatusIfNeeded(formationId, FormationStatus.PLANNED);
            }
          }
          return;
        }

        // Pas de session finale : utiliser la logique basée sur la première session (chronologiquement)
        const sortedSessions = sessions.sort((a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );

        const firstSession = sortedSessions[0];
        const newFormationStatus = this.mapSessionStatusToFormationStatus(firstSession.status);

        console.log(`📊 Pas de session finale, utilisation première session: Formation ${formationId} → ${newFormationStatus}`);
        this.updateFormationStatusIfNeeded(formationId, newFormationStatus);
      },
      error: (err) => {
        console.error('Erreur lors de la synchronisation du statut de formation:', err);
      }
    });
  }

  /**
   * Mappe le statut d'une session vers le statut correspondant de formation
   * @param sessionStatus Statut de la session
   * @returns Statut de formation correspondant
   */
  private mapSessionStatusToFormationStatus(sessionStatus: SessionStatus): FormationStatus {
    switch (sessionStatus) {
      case SessionStatus.SCHEDULED:
        return FormationStatus.PLANNED;
      case SessionStatus.IN_PROGRESS:
        return FormationStatus.IN_PROGRESS;
      case SessionStatus.COMPLETED:
        return FormationStatus.COMPLETED;
      case SessionStatus.CANCELLED:
        return FormationStatus.PLANNED; // Si la première session est annulée, formation reste planifiée
      default:
        return FormationStatus.PLANNED;
    }
  }

  /**
   * Met à jour le statut de la formation seulement si nécessaire
   * @param formationId ID de la formation
   * @param newStatus Nouveau statut
   */
  private updateFormationStatusIfNeeded(formationId: number, newStatus: FormationStatus): void {
    const formation = this.formations.find(f => f.id === formationId);
    if (!formation || formation.status === newStatus) return;

    console.log(`🔄 Synchronisation automatique: Formation ${formationId} ${formation.status} → ${newStatus}`);

    this.formationService.updateStatus(formationId, newStatus).subscribe({
      next: () => {
        // Mettre à jour localement
        formation.status = newStatus;
        this.notificationService.success(`Statut de formation synchronisé: ${newStatus}`);

        // Rafraîchir la liste si nécessaire
        if (this.selectedFormationForSessions && this.selectedFormationForSessions.id === formationId) {
          this.selectedFormationForSessions.status = newStatus;
        }
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour du statut de formation:', err);
        this.notificationService.error('Erreur lors de la synchronisation du statut');
      }
    });
  }

  /**
   * Active ou désactive la synchronisation automatique des statuts
   * @param enabled True pour activer, false pour désactiver
   */
  toggleAutoSync(enabled: boolean): void {
    this.autoSyncFormationStatus = enabled;
    this.notificationService.success(
      enabled ? 'Synchronisation automatique activée' : 'Synchronisation automatique désactivée'
    );
  }

  /**
   * Synchronise manuellement toutes les formations avec leurs premières sessions
   */
  syncAllFormationsStatus(): void {
    this.notificationService.success('Synchronisation de toutes les formations...');
    let syncCount = 0;

    this.formations.forEach(formation => {
      if (formation.id) {
        this.syncFormationStatusWithFirstSession(formation.id);
        syncCount++;
      }
    });

    setTimeout(() => {
      this.notificationService.success(`${syncCount} formations synchronisées`);
    }, 1000);
  }

  // ═══════════════════════════════════════════════════════════════════════════════════
  // FORMATION STATUS DISPLAY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════════

  /**
   * Retourne la classe CSS pour le statut de formation
   * @param status Statut de la formation
   * @returns Classe CSS correspondante
   */
  getFormationStatusClass(status: FormationStatus): string {
    const statusClasses = {
      [FormationStatus.PLANNED]: 'formation-status-planned',
      [FormationStatus.IN_PROGRESS]: 'formation-status-in-progress',
      [FormationStatus.COMPLETED]: 'formation-status-completed'
    };
    return statusClasses[status] || 'formation-status-planned';
  }

  /**
   * Retourne l'icône pour le statut de formation
   * @param status Statut de la formation
   * @returns Icône correspondante
   */
  getFormationStatusIcon(status: FormationStatus): string {
    const statusIcons = {
      [FormationStatus.PLANNED]: '📅',
      [FormationStatus.IN_PROGRESS]: '🚀',
      [FormationStatus.COMPLETED]: '✅'
    };
    return statusIcons[status] || '📅';
  }

  /**
   * Retourne le label pour le statut de formation
   * @param status Statut de la formation
   * @returns Label correspondant
   */
  getFormationStatusLabel(status: FormationStatus): string {
    const statusLabels = {
      [FormationStatus.PLANNED]: 'Planifiée',
      [FormationStatus.IN_PROGRESS]: 'En cours',
      [FormationStatus.COMPLETED]: 'Terminée'
    };
    return statusLabels[status] || 'Planifiée';
  }

  // ═══════════════════════════════════════════════════════════════════════════════════
  // FINAL SESSION AND QUIZ ACCESS LOGIC
  // ═══════════════════════════════════════════════════════════════════════════════════

  /**
   * Vérifie si une formation peut accéder au quiz (session finale terminée)
   * @param formationId ID de la formation
   * @returns Promise<boolean> True si le quiz est accessible
   */
  canAccessQuiz(formationId: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.sessionService.getByFormation(formationId).subscribe({
        next: (sessions) => {
          const finalSession = sessions.find(session => session.isFinalSession === true);
          const canAccess = finalSession && finalSession.status === SessionStatus.COMPLETED;
          resolve(!!canAccess);
        },
        error: () => resolve(false)
      });
    });
  }

  /**
   * Vérifie et affiche un message si le quiz n'est pas encore accessible
   * @param formationId ID de la formation
   */
  async checkQuizAccess(formationId: number): Promise<void> {
    const canAccess = await this.canAccessQuiz(formationId);
    if (!canAccess) {
      this.notificationService.error('Le quiz ne sera accessible qu\'après la completion de la session finale.');
      return;
    }
    // Si accessible, ouvrir le quiz
    this.openQuizPreview(formationId);
  }
}