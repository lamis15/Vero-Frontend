import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PetitionService, Petition, PetitionStats } from '../../services/petition.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin } from 'rxjs';
import { PetitionDetail } from '../petition-detail/petition-detail';
@Component({
  selector: 'app-petition',
  standalone: true,
  imports: [CommonModule, FormsModule, PetitionDetail], // ← PetitionDetail
  templateUrl: './petition.html',
  styleUrl: './petition.css',
encapsulation: ViewEncapsulation.None,
})
export class PetitionComponent implements OnInit {

  petitions: Petition[] = [];
  filteredPetitions: Petition[] = [];
  myPetitions: Petition[] = [];
  stats: PetitionStats | null = null;

  browseLoading = false;
  myLoading = false;
  adminLoading = false;

  activeTab: 'browse' | 'create' | 'my' | 'admin' | 'edit' = 'browse';
  activeFilter = 'all';
  adminFilter = 'all';

  private myPetitionsLoaded = false;

  categories = [
    { key: 'TRANSPORT',       label: 'Transport',       emoji: '🚲' },
    { key: 'POLLUTION',       label: 'Pollution',       emoji: '🏭' },
    { key: 'DECHETS',         label: 'Déchets',         emoji: '♻️' },
    { key: 'ESPACES_VERTS',   label: 'Espaces verts',   emoji: '🌳' },
    { key: 'ENERGIE',         label: 'Énergie',         emoji: '⚡' },
    { key: 'EAU',             label: 'Eau',             emoji: '💧' },
    { key: 'SENSIBILISATION', label: 'Sensibilisation', emoji: '📢' },
    { key: 'AUTRE',           label: 'Autre',           emoji: '🌍' }
  ];

  newPetition: Petition = {
    title: '', description: '', category: '', city: '', region: '',
    targetSignatures: 1000
  };
  deadlineDate = '';
  editingPetition: Petition | null = null;
  createState: 'idle' | 'processing' | 'confirmed' = 'idle';
  errorMessage = '';
  successMessage = '';

  pendingPetitions: Petition[] = [];
  allPetitions: Petition[] = [];

  deletingId: number | null = null;

  get isAdmin(): boolean { return this.authService.isAdmin; }

  constructor(
    private petitionService: PetitionService,
    private authService: AuthService
  ) {}

 ngOnInit() {
  this.browseLoading = true;

  // ✅ Charge TOUT en parallèle dès le démarrage
  forkJoin([
    this.petitionService.getActive(),
    this.petitionService.getStats(),
    this.petitionService.getMy()
  ]).subscribe({
    next: ([petitions, stats, myPetitions]) => {
      this.petitions = petitions;
      this.applyFilter();
      this.stats = stats;
      this.myPetitions = [...myPetitions];
      this.myPetitionsLoaded = true;
      this.browseLoading = false;
    },
    error: () => { this.browseLoading = false; }
  });
}

loadMyPetitions(forceReload = false) {
  // ✅ Si déjà chargé et pas de force → ne rien faire du tout
  if (this.myPetitionsLoaded && !forceReload) return;

  this.myLoading = this.myPetitions.length === 0;
  this.petitionService.getMy().subscribe({
    next: (data: Petition[]) => {
      this.myPetitions = [...data];
      this.myLoading = false;
      this.myPetitionsLoaded = true;
    },
    error: () => { this.myPetitions = []; this.myLoading = false; }
  });
}

  loadStats() {
    this.petitionService.getStats().subscribe({
      next: (data: PetitionStats) => this.stats = data
    });
  }

  private refreshAll() {
    forkJoin([
      this.petitionService.getActive(),
      this.petitionService.getStats()
    ]).subscribe({
      next: ([petitions, stats]) => {
        this.petitions = petitions;
        this.applyFilter();
        this.stats = stats;
      }
    });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  goToCreate() {
    this.activeTab = 'create';
    setTimeout(() => {
      const section = document.querySelector('.petition-section');
      if (section) {
        const y = section.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  }

  loadAllPetitions() {
    this.adminLoading = this.allPetitions.length === 0;
    this.petitionService.getAll().subscribe({
      next: (data: Petition[]) => {
        this.allPetitions = data;
        this.pendingPetitions = data.filter((p: Petition) => p.status === 'PENDING');
        this.adminLoading = false;
      },
      error: () => { this.adminLoading = false; }
    });
  }

  // ── Filtres ────────────────────────────────────────────────────────────────

  filterBy(category: string) { this.activeFilter = category; this.applyFilter(); }

  applyFilter() {
    this.filteredPetitions = this.activeFilter === 'all'
      ? [...this.petitions]
      : this.petitions.filter(p => p.category === this.activeFilter);
  }

  getFilteredAdmin(): Petition[] {
    return this.adminFilter === 'all'
      ? this.allPetitions
      : this.allPetitions.filter(p => p.status === this.adminFilter);
  }

  countByStatus(status: string): number {
    return this.allPetitions.filter(p => p.status === status).length;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  submitPetition() {
    if (this.createState !== 'idle') return;
    if (!this.newPetition.title.trim() || this.newPetition.title.trim().length < 10) {
      this.errorMessage = 'Title must be at least 10 characters'; return;
    }
    if (!this.newPetition.description.trim() || this.newPetition.description.trim().length < 30) {
      this.errorMessage = 'Description must be at least 30 characters'; return;
    }
    if (!this.newPetition.category) {
      this.errorMessage = 'Please select a category'; return;
    }

    this.errorMessage = '';
    this.createState = 'processing';

    const petition: Petition = {
      ...this.newPetition,
      deadline: this.deadlineDate ? this.deadlineDate + 'T00:00:00' : undefined
    };

    this.petitionService.create(petition).subscribe({
      next: (created: Petition) => {
        // ✅ Navigation instantanée
        this.createState = 'idle';
        this.resetForm();

        // Ajout optimiste immédiat
        this.myPetitions = [{ ...created, status: 'PENDING' }, ...this.myPetitions];
        this.myPetitionsLoaded = true;

        this.successMessage = '🌱 Petition submitted! Awaiting admin validation.';
        this.activeTab = 'my';

        // Rafraîchissement silencieux
        setTimeout(() => {
          this.successMessage = '';
          this.refreshAll();
          this.petitionService.getMy().subscribe({
            next: (data: Petition[]) => { this.myPetitions = [...data]; }
          });
        }, 2000);
      },
      error: (err: any) => {
        this.createState = 'idle';
        const raw = err.message || 'Creation failed';
        this.errorMessage = raw.includes('RuntimeException')
          ? raw.split('RuntimeException:').pop()?.trim() || raw : raw;
      }
    });
  }

  resetForm() {
    this.newPetition = {
      title: '', description: '', category: '', city: '', region: '',
      targetSignatures: 1000
    };
    this.deadlineDate = '';
  }

quickSign(petition: Petition, event: Event) {
  event.stopPropagation();
  if (!petition.id) return;
  this.petitionService.sign(petition.id).subscribe({
    next: () => {
      petition.currentSignatures = (petition.currentSignatures || 0) + 1;
    },
   error: (err: any) => {
  const msg = err?.error?.message 
            || err?.error 
            || err?.message 
            || 'Une erreur est survenue';
  alert(msg);
}
  });
}


  editPetition(p: Petition) {
    this.editingPetition = { ...p };
    this.newPetition = {
      title: p.title, description: p.description, category: p.category,
      city: p.city || '', region: p.region || '',
      targetSignatures: p.targetSignatures
    };
    this.deadlineDate = p.deadline ? p.deadline.split('T')[0] : '';
    this.errorMessage = '';
    this.successMessage = '';
    this.activeTab = 'edit';
  }

  deletePetition(p: Petition) {
    if (!p.id || this.deletingId === p.id) return;
    if (!confirm('Delete this petition?')) return;
    this.deletingId = p.id;
    this.myPetitions = this.myPetitions.filter(pet => pet.id !== p.id);
    this.petitionService.delete(p.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadMyPetitions(true);
        this.loadStats();
      },
      error: () => { this.deletingId = null; this.loadMyPetitions(true); }
    });
  }

  validatePetition(p: Petition) {
    if (!p.id) return;
    this.petitionService.validate(p.id).subscribe({
      next: () => { this.loadAllPetitions(); this.loadStats(); }
    });
  }

  rejectPetition(p: Petition) {
    const reason = prompt('Reason for rejection:');
    if (!reason || !p.id) return;
    this.petitionService.reject(p.id, reason).subscribe({
      next: () => { this.loadAllPetitions(); this.loadStats(); }
    });
  }

  closePetition(p: Petition) {
    if (!p.id || !confirm('Close this petition?')) return;
    this.petitionService.close(p.id).subscribe({
      next: () => { this.loadAllPetitions(); this.loadStats(); }
    });
  }

  adminDeletePetition(p: Petition) {
    if (!p.id || !confirm('Permanently delete this petition?')) return;
    this.petitionService.delete(p.id).subscribe({
      next: () => { this.loadAllPetitions(); this.loadStats(); }
    });
  }

  updateExistingPetition() {
    if (this.createState !== 'idle' || !this.editingPetition?.id) return;

    if (!this.newPetition.title.trim() || this.newPetition.title.trim().length < 10) {
      this.errorMessage = 'Title must be at least 10 characters'; return;
    }
    if (!this.newPetition.description.trim() || this.newPetition.description.trim().length < 30) {
      this.errorMessage = 'Description must be at least 30 characters'; return;
    }
    if (!this.newPetition.category) {
      this.errorMessage = 'Please select a category'; return;
    }

    this.errorMessage = '';
    this.createState = 'processing';

    const petition: Petition = {
      ...this.newPetition,
      deadline: this.deadlineDate ? this.deadlineDate + 'T00:00:00' : undefined
    };

    this.petitionService.update(this.editingPetition.id, petition).subscribe({
      next: () => {
        // ✅ Mise à jour optimiste
        const idx = this.myPetitions.findIndex(p => p.id === this.editingPetition!.id);
        if (idx !== -1) {
          this.myPetitions[idx] = {
            ...this.myPetitions[idx],
            ...this.newPetition,
            deadline: this.deadlineDate
              ? this.deadlineDate + 'T00:00:00'
              : this.myPetitions[idx].deadline
          };
        }

        // ✅ Navigation instantanée
        this.createState = 'idle';
        this.editingPetition = null;
        this.resetForm();
        this.activeTab = 'my';

        setTimeout(() => this.refreshAll(), 1000);
      },
      error: (err: any) => {
        this.createState = 'idle';
        const raw = err.message || 'Update failed';
        this.errorMessage = raw.includes('RuntimeException')
          ? raw.split('RuntimeException:').pop()?.trim() || raw : raw;
      }
    });
  }

  cancelEdit() {
    this.editingPetition = null;
    this.resetForm();
    this.activeTab = 'my';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getProgress(p: Petition): number {
    return p.targetSignatures
      ? Math.min(100, ((p.currentSignatures || 0) / p.targetSignatures) * 100)
      : 0;
  }

  getCategoryEmoji(cat: string): string {
    return this.categories.find(c => c.key === cat)?.emoji || '🌿';
  }

  formatCategory(cat: string): string {
    return this.categories.find(c => c.key === cat)?.label || cat;
  }

  formatDeadline(deadline: string): string {
    const diff = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / 86400000
    );
    if (diff < 0) return 'Expired';
    if (diff === 0) return 'Last day!';
    if (diff <= 7) return `${diff}d left`;
    return new Date(deadline).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short'
    });
  }
  loadAllPetitionsOnce() {
  // ✅ Ne charge qu'une seule fois
  if (this.allPetitions.length > 0) return;
  this.loadAllPetitions();
}
selectedPetition: Petition | null = null;

selectPetition(p: Petition) {
  this.selectedPetition = p;
}

closeDetail() {
  this.selectedPetition = null;
}

onSigned(p: Petition) {
  p.currentSignatures = (p.currentSignatures || 0) + 1;
  this.applyFilter();
}
}