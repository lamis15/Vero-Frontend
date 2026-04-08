import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PetitionService, Petition, PetitionStats } from '../../services/petition.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-petition',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './petition.html',
  styleUrl: './petition.css'
})
export class PetitionComponent implements OnInit {

  petitions: Petition[] = [];
  filteredPetitions: Petition[] = [];
  myPetitions: Petition[] = [];
  stats: PetitionStats | null = null;

  browseLoading = true;
  myLoading = false;
  adminLoading = false;

  activeTab: 'browse' | 'create' | 'my' | 'admin' = 'browse';
  activeFilter = 'all';
  adminFilter = 'all';

  categories = [
    { key: 'TRANSPORT', label: 'Transport', emoji: '🚲' },
    { key: 'POLLUTION', label: 'Pollution', emoji: '🏭' },
    { key: 'DECHETS', label: 'Déchets', emoji: '♻️' },
    { key: 'ESPACES_VERTS', label: 'Espaces verts', emoji: '🌳' },
    { key: 'ENERGIE', label: 'Énergie', emoji: '⚡' },
    { key: 'EAU', label: 'Eau', emoji: '💧' },
    { key: 'SENSIBILISATION', label: 'Sensibilisation', emoji: '📢' },
    { key: 'AUTRE', label: 'Autre', emoji: '🌍' }
  ];

  newPetition: Petition = {
    title: '',
    description: '',
    category: '',
    city: '',
    region: '',
    targetSignatures: 1000
  };
  deadlineDate = '';
  editingPetition: Petition | null = null;
  createState: 'idle' | 'processing' | 'confirmed' = 'idle';
  errorMessage = '';
  successMessage = '';

  pendingPetitions: Petition[] = [];
  allPetitions: Petition[] = [];

  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  constructor(
    private petitionService: PetitionService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadPetitions();
    this.loadStats();
  }

  loadPetitions() {
    this.browseLoading = true;
    this.petitionService.getActive().subscribe({
      next: (data) => {
        this.petitions = data;
        this.applyFilter();
        this.browseLoading = false;
      },
      error: () => { this.browseLoading = false; }
    });
  }
loadMyPetitions() {
  this.myPetitions = [];
  this.myLoading = true;
  this.petitionService.getMy().subscribe({
    next: (data) => {
      this.myPetitions = [...data];
      this.myLoading = false;
    },
    error: () => {
      this.myPetitions = [];
      this.myLoading = false;
    }
  });
}

  loadStats() {
    this.petitionService.getStats().subscribe({
      next: (data) => this.stats = data
    });
  }

  loadAllPetitions() {
    this.adminLoading = true;
    this.petitionService.getAll().subscribe({
      next: (data) => {
        this.allPetitions = data;
        this.pendingPetitions = data.filter(p => p.status === 'PENDING');
        this.adminLoading = false;
      },
      error: () => { this.adminLoading = false; }
    });
  }

  filterBy(category: string) {
    this.activeFilter = category;
    this.applyFilter();
  }

  applyFilter() {
    this.filteredPetitions = this.activeFilter === 'all'
      ? [...this.petitions]
      : this.petitions.filter(p => p.category === this.activeFilter);
  }

  getFilteredAdmin(): Petition[] {
    if (this.adminFilter === 'all') return this.allPetitions;
    return this.allPetitions.filter(p => p.status === this.adminFilter);
  }

  countByStatus(status: string): number {
    return this.allPetitions.filter(p => p.status === status).length;
  }

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
      next: () => {
        this.createState = 'confirmed';
        this.successMessage = 'Petition created! Awaiting admin validation.';
        setTimeout(() => {
          this.createState = 'idle';
          this.successMessage = '';
          this.resetForm();
          this.loadPetitions();
          this.loadStats();
        }, 3000);
      },
      error: (err) => {
        this.createState = 'idle';
        const raw = err.error?.message || err.message || 'Creation failed';
        this.errorMessage = raw.includes('RuntimeException')
          ? raw.split('RuntimeException:').pop()?.trim() || raw
          : raw;
      }
    });
  }

  resetForm() {
    this.newPetition = { title: '', description: '', category: '', city: '', region: '', targetSignatures: 1000 };
    this.deadlineDate = '';
  }

  quickSign(petition: Petition, event: Event) {
    event.stopPropagation();
    if (!petition.id) return;
    this.petitionService.sign(petition.id).subscribe({
      next: () => { petition.currentSignatures = (petition.currentSignatures || 0) + 1; },
      error: (err) => {
        const msg = err.error?.message || err.message || 'Error';
        alert(msg.includes('RuntimeException') ? msg.split('RuntimeException:').pop()?.trim() : msg);
      }
    });
  }

  selectPetition(p: Petition) { console.log('View petition', p.id); }
editPetition(p: Petition) {
  this.editingPetition = { ...p };
  this.newPetition = {
    title: p.title,
    description: p.description,
    category: p.category,
    city: p.city || '',
    region: p.region || '',
    targetSignatures: p.targetSignatures
  };
  this.deadlineDate = p.deadline ? p.deadline.split('T')[0] : '';
  this.activeTab = 'create';
}
 deletingId: number | null = null;

deletePetition(p: Petition) {
  if (!p.id || this.deletingId === p.id) return;
  if (!confirm('Delete this petition?')) return;
  
  this.deletingId = p.id;
  this.petitionService.delete(p.id).subscribe({
    next: () => {
      this.deletingId = null;
      this.loadMyPetitions();
      this.loadStats();
    },
    error: () => {
      this.deletingId = null;
    }
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

  getProgress(p: Petition): number {
    return p.targetSignatures ? Math.min(100, ((p.currentSignatures || 0) / p.targetSignatures) * 100) : 0;
  }

  getCategoryEmoji(cat: string): string {
    return this.categories.find(c => c.key === cat)?.emoji || '🌿';
  }

  formatCategory(cat: string): string {
    return this.categories.find(c => c.key === cat)?.label || cat;
  }

  formatDeadline(deadline: string): string {
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'Expired';
    if (diff === 0) return 'Last day!';
    if (diff <= 7) return `${diff}d left`;
    return new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  
}