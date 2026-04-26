import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  styleUrls: ['./admin-formations.css']
})
export class AdminFormationsComponent implements OnInit {

  formations: Formation[] = [];
  formationsLoading = false;
  showFormationModal = false;
  editingFormation: Formation | null = null;
  formationToDeleteId: number | null = null;

  // ── Multi-step modal ──────────────────────────────────────────────────────
  formationStep = 1; // 1 | 2 | 3
  readonly FORMATION_STEPS = 3;

  formationForm = {
    title: '',
    description: '',
    duration: 0,
    maxCapacity: 0,
    price: 0,
    status: 'PLANNED' as FormationStatus,
    pinned: false,
    tags: [] as string[],
    isPaid: false,
  };

  readonly availableTags = ['Design', 'Tech', 'Sustainability', 'Leadership', 'HR', 'Safety'];

  generatingDescription = false;

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
    formationId: 0
  };

  allUsers: any[] = [];
  expandedFormationId: number | null = null;

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
    if (!paid) this.formationForm.price = 0;
  }

  setFormationStatus(status: FormationStatus): void {
    this.formationForm.status = status;
  }

  // ── Modal open/close ──────────────────────────────────────────────────────

  openFormationModal(formation?: Formation): void {
    this.formationStep = 1;
    if (formation) {
      this.editingFormation = formation;
      this.formationForm = {
        title: formation.title,
        description: formation.description,
        duration: formation.duration,
        maxCapacity: formation.maxCapacity,
        price: formation.price || 0,
        status: formation.status,
        pinned: formation.pinned ?? false,
        tags: [],
        isPaid: (formation.price ?? 0) > 0,
      };
    } else {
      this.editingFormation = null;
      this.formationForm = {
        title: '',
        description: '',
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
    const data: any = {
      ...this.formationForm,
      price: this.formationForm.isPaid ? this.formationForm.price : 0,
    };
    if (this.editingFormation) {
      data.id = this.editingFormation.id;
      data.participantIds = this.editingFormation.participantIds || [];
      this.formationService.update(data).subscribe({
        next: () => {
          this.notificationService.success('Formation updated.');
          this.loadFormations();
          this.closeFormationModal();
        },
        error: () => this.notificationService.error('Failed to update formation.')
      });
    } else {
      this.formationService.create(data).subscribe({
        next: () => {
          this.notificationService.success('Formation created.');
          this.loadFormations();
          this.closeFormationModal();
        },
        error: () => this.notificationService.error('Failed to create formation.')
      });
    }
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
      next: (users) => { this.allUsers = users; },
      error: () => { }
    });
  }

  get trainers(): any[] {
    return this.allUsers.filter(u => u.role === 'TRAINER' || u.role === 'ADMIN' || u.role === 'USER');
  }

  getTrainerName(trainerId: number): string {
    const trainer = this.allUsers.find(u => u.id === trainerId);
    return trainer ? trainer.fullName : '—';
  }

  toggleParticipantsPanel(formationId: number): void {
    this.expandedFormationId = this.expandedFormationId === formationId ? null : formationId;
  }

  getParticipantDetails(participantIds: number[]): any[] {
    if (!participantIds || participantIds.length === 0) return [];
    return participantIds
      .map(id => this.allUsers.find(user => user.id === id))
      .filter(user => user !== undefined);
  }

  getFormationStatusClass(status: FormationStatus): string {
    const map: Record<string, string> = {
      'PLANNED': 'status-planned',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed'
    };
    return map[status] || 'status-planned';
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
        this.formations = data;
        this.formationsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notificationService.error('Failed to load formations.');
        this.formationsLoading = false;
        this.cdr.detectChanges();
      }
    });
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

  togglePin(formation: Formation): void {
    this.formationService.togglePin(formation.id!).subscribe({
      next: (updated) => {
        formation.pinned = updated.pinned;
        this.formations.sort((a, b) => {
          if (a.pinned === b.pinned) return 0;
          return a.pinned ? -1 : 1;
        });
      },
      error: () => this.notificationService.error('Error toggling pin.')
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
        formationId: this.selectedFormationForSessions.id!
      };
    } else {
      this.editingSession = null;
      this.sessionForm = {
        title: '', startDate: '', endDate: '', status: 'SCHEDULED' as SessionStatus,
        type: 'ONLINE', meetLink: '', trainerId: 0, formationId: this.selectedFormationForSessions.id!
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
        next: () => { this.notificationService.success('Session updated.'); this.viewFormationSessions(this.selectedFormationForSessions!); this.closeSessionModal(); },
        error: () => this.notificationService.error('Failed to update session.')
      });
    } else {
      this.sessionService.create(data, this.selectedFormationForSessions!.id!).subscribe({
        next: () => { this.notificationService.success('Session created.'); this.viewFormationSessions(this.selectedFormationForSessions!); this.closeSessionModal(); },
        error: () => this.notificationService.error('Failed to create session.')
      });
    }
  }

  deleteSession(id: number): void {
    this.sessionService.delete(id).subscribe({
      next: () => { this.sessions = this.sessions.filter(s => s.id !== id); this.notificationService.success('Session deleted.'); },
      error: () => this.notificationService.error('Failed to delete session.')
    });
  }

  updateSessionStatus(id: number, status: SessionStatus): void {
    this.sessionService.updateStatus(id, status).subscribe({
      next: () => { this.notificationService.success('Session status updated!'); this.viewFormationSessions(this.selectedFormationForSessions!); },
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
    if (!this.selectedFormationForSessions) return;
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

  openQuizPreview(formationId: number): void {
    this.quizPreviewLoading = true;
    this.quizPreviewAnswers = new Map();
    this.quizPreviewResult = null;
    this.showQuizPreviewModal = true;
    this.formationService.getQuizPreview(formationId).subscribe({
      next: (quiz) => { this.quizPreview = quiz; this.quizPreviewLoading = false; },
      error: () => { this.notificationService.error('Error loading quiz.'); this.showQuizPreviewModal = false; this.quizPreviewLoading = false; }
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
}