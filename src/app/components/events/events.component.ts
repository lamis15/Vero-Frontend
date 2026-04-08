import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Event, Reservation, EventApiService } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css']
})
export class EventsComponent implements OnInit, OnDestroy {

  events: Event[] = [];
  showModal  = false;
  editMode   = false;
  selectedId?: number;
  successMsg = '';
  errorMsg   = '';
  form: Event = this.resetForm();
  loading    = true;
  loadError  = false;

  showConfirmModal = false;
  confirmMessage   = '';
  confirmAction: (() => void) | null = null;

  // ── Join Event Modal ─────────────────────────────────────────────────────
  showJoinModal    = false;
  joinTargetEvent: Event | null = null;
  joinLoading      = false;
  joinError        = '';
  joinedEventIds   = new Set<number>();

  currentRole: string | null = null;
  private roleSub!: Subscription;

  constructor(
    private api:  EventApiService,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
    // Sync joined badge from real API for regular users
    if (this.auth.isLoggedIn && !this.auth.isAdmin && !this.auth.isPartner) {
      this.loadMyReservations();
    }
    this.roleSub = this.auth.roleStream$.subscribe(role => {
      this.currentRole = role;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { this.roleSub?.unsubscribe(); }

  load(): void {
    this.loading   = true;
    this.loadError = false;
    this.api.getAll().subscribe({
      next:  res => { this.events = res; this.loading = false; },
      error: err => {
        this.loading   = false;
        this.loadError = true;
        console.error('Events API error:', err);
      }
    });
  }

  loadMyReservations(): void {
    this.api.getMyReservations().subscribe({
      next: (reservations: Reservation[]) => {
        reservations
          .filter(r => r.status === 'PENDING' || r.status === 'CONFIRMED')
          .forEach(r => {
            if (r.event?.id) this.joinedEventIds.add(r.event.id);
          });
      },
      error: () => {} // silent — badge just won't pre-fill
    });
  }

  resetForm(): Event {
    return { title: '', description: '', location: '', capacity: 0, startDate: '', endDate: '' };
  }

  // ── Rôles ─────────────────────────────────────────────────────────────────
  isAdmin():   boolean { return this.auth.isAdmin; }
  isPartner(): boolean { return this.auth.isPartner; }
  isUser():    boolean { return !this.auth.isAdmin && !this.auth.isPartner; }
  canManage(): boolean { return this.auth.canManageEvents; }

  // ── Modals CRUD ───────────────────────────────────────────────────────────
  openCreate(): void {
    this.editMode = false; this.selectedId = undefined;
    this.form = this.resetForm(); this.errorMsg = ''; this.showModal = true;
  }

  openEdit(ev: Event): void {
    this.editMode = true; this.selectedId = ev.id;
    this.form = { ...ev };
    this.form.startDate = this.toDatetimeLocal(ev.startDate);
    this.form.endDate   = this.toDatetimeLocal(ev.endDate);
    this.errorMsg = ''; this.showModal = true;
  }

  private toDatetimeLocal(d: string): string {
    if (!d) return '';
    return d.length > 16 ? d.substring(0, 16) : d;
  }

  submitForm(): void {
    if (!this.form.title?.trim()) { this.showError('Le titre est obligatoire.'); return; }

    if (this.editMode && this.selectedId) {
      // ── OPTIMISTIC UPDATE : applique immédiatement, rollback si erreur ──
      const idToUpdate = this.selectedId;
      const optimistic = { ...this.form, id: idToUpdate };
      const backup = [...this.events];

      const idx = this.events.findIndex(e => e.id === idToUpdate);
      if (idx !== -1) {
        this.events[idx] = optimistic;
        this.events = [...this.events];
      }
      this.showModal = false;

      this.api.update(idToUpdate, this.form).subscribe({
        next: (serverResp) => {
          // Sync avec la réponse serveur si valide
          if (serverResp && serverResp.id) {
            const i = this.events.findIndex(e => e.id === idToUpdate);
            if (i !== -1) { this.events[i] = serverResp; this.events = [...this.events]; }
          }
          this.showSuccess('Événement mis à jour !');
        },
        error: err => {
          this.events = backup; // rollback
          this.showModal = true; // rouvre le modal
          this.showError(err.error?.message || 'Vérifiez vos permissions');
        }
      });

    } else {
      // ── OPTIMISTIC CREATE : affiche un placeholder immédiatement ──
      const tempId = -Date.now(); // id temporaire négatif unique
      const optimistic: Event = { ...this.form, id: tempId, status: 'UPCOMING' };
      this.events = [optimistic, ...this.events];
      this.showModal = false;

      this.api.create(this.form).subscribe({
        next: (created) => {
          // Remplace le placeholder par le vrai objet serveur
          const i = this.events.findIndex(e => e.id === tempId);
          if (i !== -1) { this.events[i] = created; this.events = [...this.events]; }
          this.showSuccess('Événement créé !');
        },
        error: err => {
          this.events = this.events.filter(e => e.id !== tempId); // retire le placeholder
          this.showModal = true; // rouvre le modal
          this.showError(err.error?.message || 'Vérifiez vos permissions');
        }
      });
    }
  }

  // ── FIX 2 : Suppression optimiste — retire immédiatement du tableau ──────
  deleteEvent(id: number): void {
    this.openConfirm('Supprimer définitivement cet événement ?', () => {
      // Suppression visuelle instantanée
      const backup = [...this.events];
      this.events = this.events.filter(e => e.id !== id);

      this.api.delete(id).subscribe({
        next:  () => this.showSuccess('Événement supprimé !'),
        error: err => {
          // Rollback si le serveur refuse
          this.events = backup;
          this.showError(err.error?.message || 'Erreur serveur');
        }
      });
    });
  }

  // ── Réservation ───────────────────────────────────────────────────────────
  openJoinModal(ev: Event): void {
    this.joinTargetEvent = ev;
    this.joinError       = '';
    this.showJoinModal   = true;
  }

  closeJoinModal(): void {
    this.showJoinModal   = false;
    this.joinTargetEvent = null;
    this.joinLoading     = false;
    this.joinError       = '';
  }

  confirmJoin(): void {
    if (!this.joinTargetEvent?.id || this.joinLoading) return;
    this.joinLoading = true;
    this.joinError   = '';
    const id = this.joinTargetEvent.id;

    this.api.reserve(id).subscribe({
      next: () => {
        this.joinedEventIds.add(id);
        this.closeJoinModal();
        this.showSuccess('🎉 Demande envoyée — en attente de confirmation !');
      },
      error: err => {
        this.joinLoading = false;
        console.error('Join event error:', err);
        const msg = err.error?.message || '';
        
        // Check if already registered
        if (err.status === 409 || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('déjà')) {
          this.joinedEventIds.add(id);
          this.closeJoinModal();
          this.showSuccess('Vous participez déjà à cet événement !');
        } else {
          // Show error inline in the modal
          const status = err.status;
          if (status === 404) {
             this.joinError = `Endpoint introuvable (404). L'API de réservation n'existe peut-être pas à POST /api/reservations/request/event/${id}`;
          } else if (status === 403) {
             this.joinError = 'Permission refusée (403). Réservé aux utilisateurs standards.';
          } else if (status === 405) {
             this.joinError = 'Méthode POST non autorisée (405).';
          } else {
             this.joinError = msg || `Erreur serveur ${status || ''}.`;
          }
        }
      }
    });
  }

  hasJoined(id: number): boolean {
    return this.joinedEventIds.has(id);
  }

  // ── Modal Confirm interne ─────────────────────────────────────────────────
  openConfirm(message: string, action: () => void): void {
    this.confirmMessage = message;
    this.confirmAction  = action;
    this.showConfirmModal = true;
  }
  confirmYes(): void {
    this.confirmAction?.();
    this.showConfirmModal = false;
    this.confirmAction = null;
  }
  confirmNo(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  showSuccess(msg: string): void {
    this.successMsg = msg; this.errorMsg = '';
    setTimeout(() => this.successMsg = '', 3500);
  }
  showError(msg: string): void {
    this.errorMsg = msg; this.successMsg = '';
    setTimeout(() => this.errorMsg = '', 4500);
  }
}