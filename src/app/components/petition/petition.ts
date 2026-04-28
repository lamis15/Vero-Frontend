import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PetitionService, Petition, PetitionStats } from '../../services/petition.service';
import { AuthService } from '../../services/auth.service';
import { EcoModerationService, ModerationResult } from '../../services/eco-moderation.service';
import { forkJoin } from 'rxjs';
import { PetitionDetail } from '../petition-detail/petition-detail';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

@Component({
  selector: 'app-petition',
  standalone: true,
  imports: [CommonModule, FormsModule, PetitionDetail],
  templateUrl: './petition.html',
  styleUrl: './petition.css',
  encapsulation: ViewEncapsulation.None,
})
export class PetitionComponent implements OnInit, OnDestroy {

  // ── 3D Tree ──────────────────────────────────────────────────────────────
  private renderer3D!: THREE.WebGLRenderer;
  private animFrameId!: number;

  // ── Data ─────────────────────────────────────────────────────────────────
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

  // ── AI Moderation ──────────────────────────────────────────────
  moderationResult: ModerationResult | null = null;
  moderationState: 'idle' | 'checking' | 'done' | 'error' = 'idle';
  private moderationTimer: any;

  pendingPetitions: Petition[] = [];
  allPetitions: Petition[] = [];

  deletingId: number | null = null;
  selectedPetition: Petition | null = null;

  readonly pageSize = 9;
  browsePage = 1;
  myPage     = 1;
  adminPage  = 1;

  get isAdmin(): boolean { return this.authService.isAdmin; }

  constructor(
    private petitionService: PetitionService,
    private authService: AuthService,
    private ecoModeration: EcoModerationService
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {
    this.browseLoading = true;

    if (this.isAdmin) {
      // Admin : charge uniquement pétitions actives + stats (pas getMy)
      forkJoin([
        this.petitionService.getActive(),
        this.petitionService.getStats()
      ]).subscribe({
        next: ([petitions, stats]) => {
          this.petitions = petitions;
          this.applyFilter();
          this.stats = stats;
          this.browseLoading = false;
        },
        error: () => { this.browseLoading = false; }
      });
    } else {
      // User : charge pétitions actives + stats + ses propres pétitions
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

    // Init 3D tree after DOM is ready
    setTimeout(() => this.initTree3D(), 300);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animFrameId);
    this.renderer3D?.dispose();
  }

  // ── 3D Tree ───────────────────────────────────────────────────────────────

  // ── 3D Tree ───────────────────────────────────────────────────────────────

  private initTree3D() {
    const canvas = document.getElementById('treeCanvas') as HTMLCanvasElement;
    if (!canvas) return;

    const W = 700, H = 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 2, 7);
    camera.lookAt(0, 1, 0);

    this.renderer3D = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer3D.setSize(W, H);
    this.renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer3D.outputColorSpace = THREE.SRGBColorSpace;

    // Lumières
    scene.add(new THREE.AmbientLight(0x3b9ab2, 1.2));

    const key = new THREE.DirectionalLight(0xedda9d, 3.0);
    key.position.set(5, 10, 5);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x1e708a, 2.0);
    rim.position.set(-5, 3, -5);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x0d4a5e, 1.0);
    fill.position.set(0, -2, 3);
    scene.add(fill);

    const loader = new GLTFLoader();

    // Positions des 3 arbres : [x, z, scale, rotY]
    const treeConfigs = [
      { x: 0,    z: -0.5, scale: 1.35, rotY: 0 },          // Arbre central — plus grand et légèrement reculé
      { x: -3.2, z: -1.8, scale: 0.85, rotY: 0.8 },        // Gauche — plus grand, plus excentré
      { x:  3.1, z: -1.5, scale: 0.92, rotY: -0.5 },       // Droite — plus grand, plus excentré
    ];

    let loadedCount = 0;

    treeConfigs.forEach((cfg) => {
      loader.load(
        'assets/models/tree.glb',
        (gltf) => {
          const model = gltf.scene.clone();

          // Centrage
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size   = box.getSize(new THREE.Vector3());

          model.position.sub(center);
          model.position.y += size.y * 0.5; // pose au sol

          // Scale global pour remplir l'espace + scale individuel
          const maxDim = Math.max(size.x, size.y, size.z);
          const baseScale = 3.2 / maxDim;
          model.scale.setScalar(baseScale * cfg.scale);

          // Position & rotation dans la scène
          model.position.x += cfg.x;
          model.position.z += cfg.z;
          model.rotation.y  = cfg.rotY;

          // Ombres
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          scene.add(model);
          loadedCount++;

          // Lance l'animation une seule fois quand tout est chargé
          if (loadedCount === treeConfigs.length) {
            this.startForestAnimation(scene, camera);
          }
        },
        undefined,
        (err) => console.warn('tree.glb:', err)
      );
    });
  }

  private startForestAnimation(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    let time = 0;
    const models = scene.children.filter(c => c.type === 'Group');

    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      time += 0.008;

      // Rotation lente + oscillation flottante par arbre
      models.forEach((m, i) => {
        m.rotation.y += 0.003 + i * 0.001;
        m.position.y  = Math.sin(time + i * 1.2) * 0.06;
      });

      this.renderer3D.render(scene, camera);
    };
    animate();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadMyPetitions(forceReload = false) {
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

  // ── Navigation ────────────────────────────────────────────────────────────

  goToCreate() {
    this.activeTab = 'create';
    this.scrollToSection();
  }

  scrollToBrowse() {
    this.activeTab = 'browse';
    this.scrollToSection();
  }

  private scrollToSection() {
    setTimeout(() => {
      const section = document.querySelector('.petition-section');
      if (section) {
        const y = section.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

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

  loadAllPetitionsOnce() {
    if (this.allPetitions.length > 0) return;
    this.loadAllPetitions();
  }

  // ── Filtres ───────────────────────────────────────────────────────────────

  filterBy(category: string) { this.activeFilter = category; this.browsePage = 1; this.applyFilter(); }

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

  // ── Pagination helpers ────────────────────────────────────────────────────

  private paginate(list: Petition[], page: number) {
    const start = (page - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  private totalPages(list: Petition[]) {
    return Math.max(1, Math.ceil(list.length / this.pageSize));
  }

  private buildPageNumbers(current: number, total: number): number[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  get pagedBrowse()    { return this.paginate(this.filteredPetitions, this.browsePage); }
  get browseTotal()    { return this.totalPages(this.filteredPetitions); }
  get browsePages()    { return this.buildPageNumbers(this.browsePage, this.browseTotal); }

  get pagedMy()        { return this.paginate(this.myPetitions, this.myPage); }
  get myTotal()        { return this.totalPages(this.myPetitions); }
  get myPages()        { return this.buildPageNumbers(this.myPage, this.myTotal); }

  get pagedAdminAll()  { return this.paginate(this.getFilteredAdmin(), this.adminPage); }
  get adminTotal()     { return this.totalPages(this.getFilteredAdmin()); }
  get adminPages()     { return this.buildPageNumbers(this.adminPage, this.adminTotal); }

  goToBrowsePage(p: number)  { if (p >= 1 && p <= this.browseTotal) this.browsePage = p; }
  goToMyPage(p: number)      { if (p >= 1 && p <= this.myTotal)     this.myPage = p; }
  goToAdminPage(p: number)   { if (p >= 1 && p <= this.adminTotal)  this.adminPage = p; }

  countByStatus(status: string): number {
    return this.allPetitions.filter(p => p.status === status).length;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  // ── Live AI moderation (called on title/description change) ──
  triggerLiveModeration(): void {
    clearTimeout(this.moderationTimer);
    const title = this.newPetition.title?.trim();
    if (!title || title.length < 5) {
      this.moderationResult = null;
      this.moderationState  = 'idle';
      return;
    }
    this.moderationState = 'checking';
    this.moderationTimer = setTimeout(() => {
      this.ecoModeration.moderate(title, this.newPetition.description).subscribe(result => {
        this.moderationResult = result;
        this.moderationState  = result ? 'done' : 'error';
      });
    }, 600);  // debounce 600ms
  }

  getModerationScoreClass(): string {
    if (!this.moderationResult) return '';
    const s = this.moderationResult.score;
    if (s >= 70) return 'eco-score-green';
    if (s >= 50) return 'eco-score-orange';
    return 'eco-score-red';
  }

  getModerationIcon(): string {
    if (!this.moderationResult) return '';
    const d = this.moderationResult.decision;
    if (d === 'PENDING') return '✅';
    if (d === 'REVIEW')  return '⚠️';
    return '❌';
  }

  submitPetition() {
    if (this.isAdmin) return;
    if (this.createState !== 'idle' && this.createState !== 'confirmed') return;

    // -- Pre-validation --
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
    clearTimeout(this.moderationTimer);

    const petition: Petition = {
      ...this.newPetition,
      deadline: this.deadlineDate ? this.deadlineDate + 'T00:00:00' : undefined
    };

    // -- Optimization: Use cached result if already done (from live typing) --
    if (this.moderationState === 'done' && this.moderationResult) {
      this.finalizePetitionSubmission(this.moderationResult, petition);
      return;
    }

    // -- Fallback: Run it now if not already done --
    this.createState     = 'processing';
    this.moderationState = 'checking';

    this.ecoModeration.moderate(
      this.newPetition.title,
      this.newPetition.description
    ).subscribe(result => {
      this.finalizePetitionSubmission(result, petition);
    });
  }

  private finalizePetitionSubmission(result: ModerationResult | null, petition: Petition) {
    this.moderationResult = result;
    this.moderationState  = result ? 'done' : 'error';

    // -- REJECTED → block --
    if (result?.decision === 'REJECTED') {
      this.createState  = 'idle';
      this.errorMessage = `❌ Ecological filter rejected this petition (score: ${result.score}/100). Please write about an environmental topic.`;
      return;
    }

    // -- AI passed (PENDING / REVIEW / unavailable) --
    this.createState = 'processing';
    
    const optimisticPetition: Petition = {
      ...petition,
      id:                undefined,
      status:            'PENDING',
      currentSignatures: 0
    };

    const previousMy = [...this.myPetitions];

    // -- ✅ Instant success feedback --
    this.myPetitions       = [optimisticPetition, ...this.myPetitions];
    this.myPetitionsLoaded = true;
    this.successMessage    = result
      ? `🌱 Petition submitted! Ecological score: ${result.score}/100.`
      : '🌱 Petition submitted! Awaiting admin validation.';
    
    this.activeTab      = 'my';
    this.moderationResult = null;
    this.moderationState  = 'idle';
    this.resetForm();
    setTimeout(() => { this.successMessage = ''; }, 4000);

    // -- Step 3: Backend call in background --
    this.petitionService.create(petition).subscribe({
      next: (created: Petition) => {
        this.createState = 'idle';
        this.myPetitions = this.myPetitions.map(p =>
          p === optimisticPetition ? { ...created, status: 'PENDING' } : p
        );
        setTimeout(() => {
          this.refreshAll();
          this.petitionService.getMy().subscribe({
            next: (data: Petition[]) => { this.myPetitions = [...data]; }
          });
        }, 1500);
      },
      error: (err: any) => {
        this.myPetitions    = previousMy;
        this.activeTab      = 'create';
        this.createState    = 'idle';
        this.successMessage = '';
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
    if (this.isAdmin) return; // L'admin ne signe pas les pétitions
    if (!petition.id) return;
    if (petition.status !== 'ACTIVE') return; // Seulement si la pétition est active
    if ((petition as any)._hasSigned) return;

    this.petitionService.sign(petition.id).subscribe({
      next: () => {
        petition.currentSignatures = (petition.currentSignatures || 0) + 1;
        (petition as any)._hasSigned = true;
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.error || err?.message || 'Une erreur est survenue';
        if (typeof msg === 'string' && msg.toLowerCase().includes('déjà signé')) {
          (petition as any)._hasSigned = true;
        } else {
          alert(msg);
        }
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

    const petitionId = this.editingPetition.id;
    this.errorMessage = '';
    this.createState = 'processing';

    const petition: Petition = {
      ...this.newPetition,
      deadline: this.deadlineDate ? this.deadlineDate + 'T00:00:00' : undefined
    };

    // -- ✅ Optimistic UI update --
    const previousMy = [...this.myPetitions];
    const idx = this.myPetitions.findIndex(p => p.id === petitionId);
    if (idx !== -1) {
      this.myPetitions[idx] = {
        ...this.myPetitions[idx],
        ...this.newPetition,
        deadline: petition.deadline
      };
    }

    // Immediate feedback
    this.successMessage = '🌱 Updating petition...';
    this.activeTab = 'my';
    const oldEditing = this.editingPetition;
    this.editingPetition = null;
    this.resetForm();

    this.petitionService.update(petitionId, petition).subscribe({
      next: () => {
        this.createState = 'idle';
        this.successMessage = '✅ Petition updated!';
        setTimeout(() => { 
          this.successMessage = ''; 
          this.refreshAll();
        }, 3000);
      },
      error: (err: any) => {
        // Rollback on failure
        this.myPetitions = previousMy;
        this.editingPetition = oldEditing;
        this.activeTab = 'edit';
        this.createState = 'idle';
        this.successMessage = '';
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

  // ── Detail ────────────────────────────────────────────────────────────────

  selectPetition(p: Petition) { this.selectedPetition = p; }
  closeDetail() { this.selectedPetition = null; }
  onSigned(p: Petition) {
    p.currentSignatures = (p.currentSignatures || 0) + 1;
    this.applyFilter();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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
}