import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Event, EventApiService } from '../../services/Event api.service';
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
  form: Event = this.resetForm();

  // Track current role reactively so the view updates when role is fetched async
  currentRole: string | null = null;
  private roleSub!: Subscription;

  constructor(
    private api:  EventApiService,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();

    // Subscribe to the reactive role stream so that when the role arrives
    // (async from /api/users), Angular re-checks the view bindings.
    this.roleSub = this.auth.roleStream$.subscribe(role => {
      this.currentRole = role;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.roleSub?.unsubscribe();
  }

  load(): void {
    this.api.getAll().subscribe({
      next:  res => this.events = res,
      error: err => console.error('Erreur chargement événements', err)
    });
  }

  resetForm(): Event {
    return { title: '', description: '', location: '', capacity: 0, startDate: '', endDate: '' };
  }

  // --- RÔLES ---
  isAdmin():   boolean { return this.auth.isAdmin; }
  isPartner(): boolean { return this.auth.isPartner; }
  isUser():    boolean { return !this.auth.isAdmin && !this.auth.isPartner; }
  canManage(): boolean { return this.auth.canManageEvents; }

  // --- MODAL CRÉATION ---
  openCreate(): void {
    this.editMode  = false;
    this.selectedId = undefined;
    this.form = this.resetForm();
    this.showModal = true;
  }

  // --- MODAL ÉDITION ---
  openEdit(ev: Event): void {
    this.editMode  = true;
    this.selectedId = ev.id;
    this.form = { ...ev };
    this.form.startDate = this.toDatetimeLocal(ev.startDate);
    this.form.endDate   = this.toDatetimeLocal(ev.endDate);
    this.showModal = true;
  }

  private toDatetimeLocal(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.length > 16 ? dateStr.substring(0, 16) : dateStr;
  }

  // --- SUBMIT (CREATE ou UPDATE) ---
  submitForm(): void {
    if (!this.form.title?.trim()) {
      alert('Le titre est obligatoire.');
      return;
    }

    const action = (this.editMode && this.selectedId)
      ? this.api.update(this.selectedId, this.form)
      : this.api.create(this.form);

    action.subscribe({
      next: () => {
        this.showModal = false;
        this.load();
        this.showSuccess(this.editMode ? 'Événement mis à jour !' : 'Événement créé !');
      },
      error: err => alert('Erreur : ' + (err.error?.message || 'Vérifiez vos permissions'))
    });
  }

  // --- SUPPRESSION ---
  deleteEvent(id: number): void {
    if (!confirm('Supprimer définitivement cet événement ?')) return;
    this.api.delete(id).subscribe({
      next:  () => { this.load(); this.showSuccess('Événement supprimé !'); },
      error: err => alert('Impossible : ' + (err.error?.message || 'Erreur serveur'))
    });
  }

  // --- RÉSERVATION ---
  joinEvent(id: number): void {
    this.api.reserve(id).subscribe({
      next:  () => this.showSuccess('Demande de réservation envoyée !'),
      error: err => alert(err.error?.message || 'Erreur lors de la réservation')
    });
  }

  showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 3000);
  }
}