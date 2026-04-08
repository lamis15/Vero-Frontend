import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Vérifie bien le chemin et le nom du fichier ci-dessous
import { Event, EventApiService } from '../../services/Event api.service'; 

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css']
})
export class EventsComponent implements OnInit {
  events: Event[] = [];
  showModal = false;
  editMode = false;
  form: Event = this.initForm();
  selectedId?: number;
  successMsg = '';

  constructor(private api: EventApiService) {}

  ngOnInit(): void { 
    this.load(); 
  }

  load(): void {
    this.api.getAll().subscribe({
      next: (res) => {
        this.events = res || []; // Sécurité si res est null
        
        // Mock data pour le debug si l'API est vide
        if (this.events.length === 0) {
          this.events = [
            { id: 1, title: 'Earth Day Global Walk', description: 'Join 40,000+ people marching for justice.', startDate: '2026-04-18T10:00', endDate: '2026-04-18T18:00', location: 'Tunis', capacity: 500, status: 'UPCOMING' },
            { id: 2, title: 'Beach Cleanup', description: 'Cleaning the coast of La Marsa.', startDate: '2026-05-22T08:00', endDate: '2026-05-22T12:00', location: 'La Marsa', capacity: 50, status: 'UPCOMING' }
          ];
        }
      },
      error: (err) => {
        console.error("API Error:", err);
        this.events = [
          { id: 0, title: 'Backend Offline', description: 'Please check your connection.', startDate: new Date().toISOString(), endDate: '', location: 'Local', capacity: 0 }
        ];
      }
    });
  }

  initForm(): Event {
    // On s'assure que tous les champs requis par l'interface Event sont présents
    return { 
      title: '', 
      description: '', 
      startDate: '', 
      endDate: '', 
      location: '', 
      capacity: 0 
    };
  }

  openCreate(): void {
    this.editMode = false;
    this.selectedId = undefined; // On reset l'ID
    this.form = this.initForm();
    this.showModal = true;
  }

  openEdit(ev: Event): void {
    this.editMode = true;
    this.selectedId = ev.id;
    // .slice(0, 16) est parfait pour l'input type="datetime-local"
    this.form = { ...ev, startDate: ev.startDate?.slice(0, 16) || '' };
    this.showModal = true;
  }

  submitForm(): void {
    // Logique de validation simple
    if (!this.form.title || !this.form.startDate) {
      alert("Please fill required fields");
      return;
    }

    const request = (this.editMode && this.selectedId)
      ? this.api.update(this.selectedId, this.form)
      : this.api.create(this.form);

    request.subscribe({
      next: () => {
        this.showSuccess(this.editMode ? 'Event Updated!' : 'Event Created!');
        this.showModal = false;
        this.load();
      },
      error: (err) => console.error("Submit error", err)
    });
  }

  deleteEvent(ev: Event): void {
    if (ev.id && confirm(`Delete "${ev.title}"?`)) {
      this.api.delete(ev.id).subscribe({
        next: () => {
          this.showSuccess('Deleted successfully');
          this.load();
        },
        error: (err) => console.error("Delete error", err)
      });
    }
  }

  reserve(id: number | undefined): void {
    if (!id) return;
    this.api.reserve(id).subscribe({
      next: () => this.showSuccess('Joined successfully!'),
      error: (err) => console.error("Reservation error", err)
    });
  }

  showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 3000);
  }

  // Méthodes de rôles (Utilise les rôles stockés en cache)
  isPartner(): boolean { return localStorage.getItem('role') === 'PARTNER'; }
  isAdmin(): boolean { return localStorage.getItem('role') === 'ADMIN'; }
  isUser(): boolean { return localStorage.getItem('role') === 'USER'; }
  
  canManage(ev: Event): boolean { 
    return this.isAdmin() || this.isPartner(); 
  }
}