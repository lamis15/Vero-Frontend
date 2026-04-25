import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Event, Reservation, EventApiService } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';
import { EventRatingService, RatingResponse } from '../../services/Event rating.service';

interface Leaf   { style: string; color: string; }
interface Turtle { x: number; y: number; speed: number; size: number; delay: number; flipped: boolean; }

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventsComponent implements OnInit, OnDestroy {

  // ── Data ──────────────────────────────────────────────────────────────────
  events: Event[]  = [];
  loading          = true;
  loadError        = false;
  joinedEventIds   = new Set<number>();

  // ── Toast ─────────────────────────────────────────────────────────────────
  toastMsg     = '';
  toastTitle   = '';
  toastIsError = false;

  // ── Search / Filter ───────────────────────────────────────────────────────
  searchQuery  = '';
  activeFilter = 'ALL';

  // ── Detail Modal ──────────────────────────────────────────────────────────
  showDetail  = false;
  detailEvent: Event | null = null;
  joinLoading = false;

  // ── Form Modal ────────────────────────────────────────────────────────────
  showFormModal   = false;
  editMode        = false;
  selectedId?:    number;
  formStep        = 1;
  expandedSection = 'identity';
  saveLoading     = false;
  form: any       = this.resetForm();
  formDate        = '';
  formTime        = '';
  formEndDate     = '';
  formEndTime     = '';

  // ── Image Upload ──────────────────────────────────────────────────────────
  uploadedImageUrl   = '';
  uploadedImageFile: File | null = null;
  uploadPreview      = '';
  uploadLoading      = false;

  // ── Delete Confirm ────────────────────────────────────────────────────────
  showConfirm      = false;
  confirmEventName = '';
  confirmDeleteId?: number;

  // ── Animations ────────────────────────────────────────────────────────────
  leaves:  Leaf[]   = [];
  turtles: Turtle[] = [];

  // ── Flip Card ─────────────────────────────────────────────────────────────
  flippedId: number | null = null;

  // ── Pagination ────────────────────────────────────────────────────────────
  pageSize    = 3;
  currentPage = 0;

  // ── Ratings par event ─────────────────────────────────────────────────────
  eventRatings:    { [eventId: number]: RatingResponse[] } = {};
  latestRatingIds: { [eventId: number]: number | null }    = {};
  private ratingSubs: { [eventId: number]: Subscription }  = {};

  // ── Categories ────────────────────────────────────────────────────────────
  categories = [
    { key: 'Cleanup',      label: 'Cleanup',      emoji: '🧹', desc: 'Clean beaches, parks & streets' },
    { key: 'Planting',     label: 'Planting',     emoji: '🌱', desc: 'Plant trees & restore habitats' },
    { key: 'Workshop',     label: 'Workshop',     emoji: '🎨', desc: 'Learn & share eco-skills'        },
    { key: 'Conservation', label: 'Conservation', emoji: '🦋', desc: 'Protect biodiversity'            },
  ];

  private roleSub!: Subscription;

  // ── ML API ────────────────────────────────────────────────────────────────
  private readonly ML_API = 'http://localhost:5000';

  // ── Popularity Predictor (step 3) ─────────────────────────────────────────
  popAvailable     = false;
  popPredicting    = false;
  popResult: any   = null;
  popAnimFill      = 0;
  capacityApplied  = false;
  reservationApplied = false;
  private popFillTimer: any;

  // ── AI Success Predictor (step 6) ─────────────────────────────────────────
  mlAvailable       = false;
  predicting        = false;
  predStep          = 0;
  predResult: any   = null;
  predAnimScore     = 0;
  predActiveTab: 'signals' | 'shap' | 'recs' = 'signals';

  predSteps = [
    { icon: '🌤️', label: 'Fetching weather signals...' },
    { icon: '📈', label: 'Querying Google Trends...' },
    { icon: '📅', label: 'Checking calendar conflicts...' },
    { icon: '🏙️', label: 'Scanning competing events...' },
    { icon: '🧠', label: 'Running Gradient Boosting model...' },
    { icon: '🔬', label: 'Computing SHAP explanations...' },
  ];

  constructor(
    private http:          HttpClient,
    private api:           EventApiService,
    private auth:          AuthService,
    private cdr:           ChangeDetectorRef,
    private ratingService: EventRatingService
  ) {}

  ngOnInit(): void {
    this.generateLeaves();
    this.generateTurtles();
    this.load();

    // Health-check ML — détecte les 3 modèles
    this.http.get<any>(`${this.ML_API}/health`).subscribe({
      next: (res) => {
        this.mlAvailable  = res.event_predictor  ?? true;
        this.popAvailable = res.popularity        ?? true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.mlAvailable  = false;
        this.popAvailable = false;
        this.cdr.markForCheck();
      }
    });

    if (this.auth.isLoggedIn && !this.auth.isAdmin && !this.auth.isPartner) {
      this.loadMyReservations();
    }
    this.roleSub = this.auth.roleStream$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.roleSub?.unsubscribe();
    Object.values(this.ratingSubs).forEach(s => s.unsubscribe());
    clearInterval(this.popFillTimer);
  }

  // ── Leaves ────────────────────────────────────────────────────────────────
  generateLeaves(): void {
    const colors = ['#74c69d','#52b788','#40916c','#95d5b2','#b7e4c7','#d8f3dc'];
    this.leaves = Array.from({ length: 14 }, () => {
      const left     = Math.random() * 100;
      const duration = 8  + Math.random() * 12;
      const delay    = Math.random() * 15;
      const size     = 12 + Math.random() * 12;
      const color    = colors[Math.floor(Math.random() * colors.length)];
      return { color, style: `left:${left}%;width:${size}px;height:${size*1.3}px;animation-duration:${duration}s;animation-delay:${delay}s` };
    });
  }

  // ── Turtles ───────────────────────────────────────────────────────────────
  generateTurtles(): void {
    this.turtles = Array.from({ length: 4 }, (_, i) => ({
      x: -120 - i * 220,
      y: 18 + Math.random() * 24,
      speed: 0.3 + Math.random() * 0.3,
      size: 52  + Math.random() * 28,
      delay: i * 4,
      flipped: false
    }));
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  load(): void {
    this.loading = true; this.loadError = false;
    this.api.getAll().subscribe({
      next:  res => { this.events = res; this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.loadError = true; this.cdr.markForCheck(); }
    });
  }

  loadMyReservations(): void {
    this.api.getMyReservations().subscribe({
      next: (res: Reservation[]) => {
        res.filter(r => r.status === 'PENDING' || r.status === 'CONFIRMED')
           .forEach(r => { if (r.event?.id) this.joinedEventIds.add(r.event.id); });
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  get filteredEvents(): Event[] {
    return this.events.filter(ev => {
      const matchFilter = this.activeFilter === 'ALL' || this.getCategoryLabel(ev) === this.activeFilter;
      const matchSearch = !this.searchQuery ||
        ev.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        ev.location.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }

  resetPage(): void { this.currentPage = 0; this.cdr.markForCheck(); }

  get pagedEvents(): Event[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredEvents.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredEvents.length / this.pageSize);
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  prevPage(): void {
    if (this.currentPage > 0) { this.currentPage--; this.flippedId = null; this.cdr.markForCheck(); }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) { this.currentPage++; this.flippedId = null; this.cdr.markForCheck(); }
  }

  goToPage(page: number): void {
    this.currentPage = page; this.flippedId = null; this.cdr.markForCheck();
  }

  // ── Roles ─────────────────────────────────────────────────────────────────
  isAdmin():   boolean { return this.auth.isAdmin; }
  isPartner(): boolean { return this.auth.isPartner; }
  isUser():    boolean { return !this.auth.isAdmin && !this.auth.isPartner; }
  canManage(): boolean { return this.auth.canManageEvents; }

  // ── Detail ────────────────────────────────────────────────────────────────
  openDetail(ev: Event): void {
    this.detailEvent = ev;
    this.joinLoading = false;
    this.showDetail  = true;
  }

  confirmJoin(): void {
    if (!this.detailEvent?.id || this.joinLoading) return;
    this.joinLoading = true;
    const id = this.detailEvent.id;

    this.api.reserve(id).subscribe({
      next: () => {
        this.joinedEventIds.add(id);
        this.joinLoading = false;
        this.showDetail  = false;
        this.showToast('Reservation confirmed! 🎉', 'A confirmation email with your QR ticket has been sent.');
        this.cdr.markForCheck();
      },
      error: err => {
        this.joinLoading = false;
        const msg = err.error?.message || '';
        if (err.status === 409 || msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('already')) {
          this.joinedEventIds.add(id);
          this.showDetail = false;
          this.showToast('Already registered!', "You're already signed up for this event.");
        } else {
          this.showToast('', msg || 'Reservation failed.', true);
        }
        this.cdr.markForCheck();
      }
    });
  }

  hasJoined(id: number): boolean { return this.joinedEventIds.has(id); }

  // ── Flip Card ─────────────────────────────────────────────────────────────
  flipCard(eventId: number): void {
    if (this.flippedId === eventId) {
      this.flippedId = null;
    } else {
      this.flippedId = eventId;
      if (!this.eventRatings[eventId]) this.loadRatingsForEvent(eventId);
    }
    this.cdr.markForCheck();
  }

  private loadRatingsForEvent(eventId: number): void {
    this.ratingService.getRatings(eventId).subscribe({
      next: (ratings: RatingResponse[]) => {
        this.eventRatings[eventId] = ratings;
        this.cdr.markForCheck();
      }
    });

    if (!this.ratingSubs[eventId]) {
      this.ratingSubs[eventId] = this.ratingService
        .subscribeToRatings(eventId)
        .subscribe((newRating: RatingResponse) => {
          if (!this.eventRatings[eventId]) this.eventRatings[eventId] = [];
          const idx = this.eventRatings[eventId].findIndex(r => r.id === newRating.id);
          if (idx >= 0) { this.eventRatings[eventId][idx] = newRating; }
          else          { this.eventRatings[eventId] = [newRating, ...this.eventRatings[eventId]]; }
          this.latestRatingIds[eventId] = newRating.id;
          setTimeout(() => { this.latestRatingIds[eventId] = null; this.cdr.markForCheck(); }, 1000);
          this.cdr.markForCheck();
        });
    }
  }

  getEventRatings(eventId: number): RatingResponse[] { return this.eventRatings[eventId] || []; }

  getEventAvg(eventId: number): number {
    const ratings = this.getEventRatings(eventId);
    return ratings.length === 0 ? 0 : ratings[0].averageStars;
  }

  getEventAvgRounded(eventId: number): number { return Math.round(this.getEventAvg(eventId)); }

  // ── Image Upload ──────────────────────────────────────────────────────────
  onImageSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.uploadedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => { this.uploadPreview = e.target.result; this.cdr.markForCheck(); };
    reader.readAsDataURL(file);
  }

  uploadImage(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.uploadedImageFile) { resolve(''); return; }
      const formData = new FormData();
      formData.append('file', this.uploadedImageFile);
      fetch('/api/uploads', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => resolve(data.url || ''))
        .catch(() => resolve(''));
    });
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  resetForm(): any {
    return { title: '', description: '', location: '', capacity: 50, startDate: '', endDate: '', status: 'UPCOMING', category: 'Cleanup', imageUrl: '' };
  }

  openCreate(): void {
    this.editMode = false; this.selectedId = undefined;
    this.form = this.resetForm();
    this.formDate = this.formTime = this.formEndDate = this.formEndTime = '';
    this.uploadPreview = ''; this.uploadedImageFile = null;
    this.formStep = 1; this.showFormModal = true;
    this._resetAllML();
  }

  openEdit(ev: Event): void {
    this.editMode = true; this.selectedId = ev.id;
    this.form = { ...ev, category: this.getCategoryLabel(ev) };
    this.uploadPreview = (ev as any).imageUrl || '';
    this.uploadedImageFile = null;
    if (ev.startDate) { this.formDate = ev.startDate.substring(0,10); this.formTime = ev.startDate.substring(11,16); }
    if (ev.endDate)   { this.formEndDate = ev.endDate.substring(0,10); this.formEndTime = ev.endDate.substring(11,16); }
    this.formStep = 1; this.showFormModal = true;
    this._resetAllML();
  }

  private _resetAllML(): void {
    // Popularity predictor
    this.popResult         = null;
    this.popPredicting     = false;
    this.popAnimFill       = 0;
    this.capacityApplied   = false;
    this.reservationApplied = false;
    this._computedSeason   = '';
    clearInterval(this.popFillTimer);
    // AI success predictor
    this.predResult   = null;
    this.predicting   = false;
    this.predStep     = 0;
    this.predAnimScore = 0;
  }

  // Steps : 1=info, 2=date/lieu, 3=popularity, 4=photo, 5=review, 6=AI success
  nextStep(): void {
    if (this.formStep === 1 && !this.form.title?.trim()) {
      this.showToast('', 'Le titre est obligatoire.', true); return;
    }
    if (this.formStep === 2) {
      this.form.startDate = `${this.formDate}T${this.formTime || '00:00'}:00`;
      this.form.endDate   = `${this.formEndDate || this.formDate}T${this.formEndTime || '23:59'}:00`;
    }
    this.formStep++;
    if (this.formStep === 3) {
      this.popResult     = null;
      this.popPredicting = false;
      this.popAnimFill   = 0;
    }
    if (this.formStep === 6) {
      this.predResult  = null;
      this.predicting  = false;
      this.predStep    = 0;
    }
  }

  async submitForm(): Promise<void> {
    this.saveLoading = true;
    if (this.uploadedImageFile) {
      const url = await this.uploadImage();
      if (url) this.form.imageUrl = url;
    }
    const payload = { ...this.form };
    delete payload.category;

    const obs = this.editMode && this.selectedId
      ? this.api.update(this.selectedId, payload)
      : this.api.create(payload);

    obs.subscribe({
      next: result => {
        this.saveLoading = false;
        this.showFormModal = false;
        if (this.editMode && this.selectedId) {
          const i = this.events.findIndex(e => e.id === this.selectedId);
          if (i !== -1) { this.events[i] = result; this.events = [...this.events]; }
        } else {
          this.events = [result, ...this.events];
        }
        this.showToast(
          this.editMode ? 'Event updated! ✏️' : 'Event created! 🌿',
          this.editMode ? 'Changes saved successfully.' : 'Your event is now live.'
        );
        this.cdr.markForCheck();
      },
      error: err => {
        this.saveLoading = false;
        this.showToast('', err.error?.message || 'Vérifiez vos permissions.', true);
        this.cdr.markForCheck();
      }
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  askDelete(ev: Event): void {
    this.confirmEventName = ev.title;
    this.confirmDeleteId  = ev.id;
    this.showConfirm      = true;
  }

  doDelete(): void {
    if (!this.confirmDeleteId) return;
    const id     = this.confirmDeleteId;
    const backup = [...this.events];
    this.events  = this.events.filter(e => e.id !== id);
    this.showConfirm = false;
    this.cdr.markForCheck();

    this.api.delete(id).subscribe({
      next:  () => this.showToast('Event deleted 🗑️', 'The event has been removed.'),
      error: err => {
        this.events = backup;
        this.showToast('', err.error?.message || 'Erreur serveur.', true);
        this.cdr.markForCheck();
      }
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  showToast(title: string, msg: string, isError = false): void {
    this.toastTitle = title; this.toastMsg = msg; this.toastIsError = isError;
    setTimeout(() => { this.toastMsg = ''; this.toastTitle = ''; this.cdr.markForCheck(); }, 4500);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getCategoryLabel(ev: Event): string {
    const t = (ev.title + ' ' + (ev.description || '')).toLowerCase();
    if (t.includes('plant') || t.includes('tree') || t.includes('forest')) return 'Planting';
    if (t.includes('workshop') || t.includes('solar') || t.includes('energy') || t.includes('summit')) return 'Workshop';
    if (t.includes('coral') || t.includes('reef') || t.includes('marine') || t.includes('conservation')) return 'Conservation';
    return 'Cleanup';
  }

  getEventImage(ev: Event): string {
    if ((ev as any).imageUrl) return (ev as any).imageUrl;
    const cat = this.getCategoryLabel(ev);
    const images: any = {
      Planting:     'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800',
      Cleanup:      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      Workshop:     'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800',
      Conservation: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800',
    };
    return images[cat] || images['Cleanup'];
  }

  getCo2(ev: Event):         number { return Math.floor(ev.capacity * 3.2); }
  getFilledSpots(ev: Event): number { return Math.floor(ev.capacity * 0.6); }
  getSpotsLeft(ev: Event):   number { return ev.capacity - this.getFilledSpots(ev); }
  getFillPercent(ev: Event): number { return Math.round((this.getFilledSpots(ev) / ev.capacity) * 100); }

  trackById(_: number, ev: Event): number { return ev.id!; }

  // ══════════════════════════════════════════════════════════════════════════
  // POPULARITY PREDICTOR (step 3)
  // ══════════════════════════════════════════════════════════════════════════

  // Saison calculée une fois et stockée — évite les incohérences d'affichage
  _computedSeason = '';

  get popSeason(): string {
    if (this._computedSeason) return this._computedSeason;
    return this._seasonFromDate(this.formDate);
  }

  private _seasonFromDate(dateStr: string): string {
    const month = dateStr ? new Date(dateStr).getMonth() + 1 : new Date().getMonth() + 1;
    if ([3,4,5].includes(month))   return 'Spring';
    if ([6,7,8].includes(month))   return 'Summer';
    if ([9,10,11].includes(month)) return 'Autumn';
    return 'Winter';
  }

  runPopularityPrediction(): void {
    this.popPredicting      = true;
    this.popResult          = null;
    this.capacityApplied    = false;
    this.reservationApplied = false;

    const today    = new Date();
    const eventDay = this.formDate ? new Date(this.formDate) : today;
    const daysBeforePublish = Math.max(1, Math.ceil((eventDay.getTime() - today.getTime()) / 86400000));
    const startHour = this.formTime ? parseInt(this.formTime.split(':')[0], 10) : 18;
    const isWeekend = (eventDay.getDay() === 0 || eventDay.getDay() === 6) ? 1 : 0;

    // Calculer et STOCKER la saison — elle sera cohérente dans l'affichage ET dans le payload
    this._computedSeason = this._seasonFromDate(this.formDate);

    // Mapper la catégorie Vero → type événement ML
    // Les 4 catégories de la plateforme éco
    const categoryMap: Record<string, string> = {
      'Cleanup':      'Eco Workshop',    // nettoyage plages/parcs
      'Planting':     'Eco Workshop',    // plantation arbres
      'Workshop':     'Conference',      // atelier = format conférence
      'Conservation': 'Eco Workshop',    // conservation biodiversité
      // Fallbacks minuscules (cas openEdit)
      'cleanup':      'Eco Workshop',
      'planting':     'Eco Workshop',
      'workshop':     'Conference',
      'conservation': 'Eco Workshop',
    };
    const rawCat  = (this.form.category || '').toString().trim();
    const eventType = categoryMap[rawCat]
                   || categoryMap[rawCat.toLowerCase()]
                   || 'Eco Workshop';

    // Envoyer la location brute — Flask fait la correspondance intelligente
    const locationRaw = (this.form.location || 'Tunis').trim();

    const payload = {
      event_type:              eventType,
      location:                locationRaw,
      season:                  this._computedSeason,
      capacity:                this.form.capacity,
      theme_popularity:        65,
      location_accessibility:  0.75,
      community_engagement:    0.50,
      social_media_score:      0.45,
      has_sponsor:             0,
      organizer_reputation:    3.8,
      similar_events_count:    5,
      historical_fill_rate:    0.70,
      days_before_publish:     daysBeforePublish,
      is_weekend:              isWeekend,
      start_hour:              startHour,
    };

    console.log('[PopularityPredictor] payload →', payload);

    this.cdr.markForCheck();

    this.http.post<any>(`${this.ML_API}/popularity/predict`, payload).subscribe({
      next: res => {
        this.popResult     = res;
        this.popPredicting = false;
        this.animPopFill(res.fill_rate_pct);
        this.cdr.markForCheck();
      },
      error: () => {
        this.popPredicting = false;
        this.popResult     = { error: true };
        this.cdr.markForCheck();
      }
    });
  }

  private animPopFill(target: number): void {
    clearInterval(this.popFillTimer);
    this.popAnimFill = 0;
    const step = target / 60;
    this.popFillTimer = setInterval(() => {
      this.popAnimFill = Math.min(this.popAnimFill + step, target);
      this.cdr.markForCheck();
      if (this.popAnimFill >= target) { this.popAnimFill = target; clearInterval(this.popFillTimer); }
    }, 16);
  }

  applyPopCapacity(suggested: number | string): void {
    if (this.capacityApplied) return;
    const val = Math.round(Number(suggested));
    this.form.capacity   = val;
    this.capacityApplied = true;
    this.showToast('Capacité ajustée ✅', `Capacité mise à jour à ${val} places selon la prédiction ML.`);
    this.cdr.markForCheck();
  }

  get popGaugeColor(): string {
    if (!this.popResult) return '#8aaa96';
    const a = this.popResult.capacity_advice;
    if (a === 'increase') return '#1e6b45';
    if (a === 'optimal')  return '#2d8f5c';
    if (a === 'reduce')   return '#c47d0e';
    return '#c0392b';
  }

  get popGaugeDash(): string {
    const c = 2 * Math.PI * 54;
    return `${(this.popAnimFill / 100) * c} ${c - (this.popAnimFill / 100) * c}`;
  }

  get popAdviceIcon(): string {
    switch (this.popResult?.capacity_advice) {
      case 'increase': return '🚀';
      case 'optimal':  return '✅';
      case 'reduce':   return '⚠️';
      case 'review':   return '🔄';
      default:         return '📊';
    }
  }

  popShapBarWidth(impact: number): number {
    if (!this.popResult?.shap_top_features?.length) return 0;
    const max = Math.max(...this.popResult.shap_top_features.map((f: any) => Math.abs(f.impact)));
    return Math.round((Math.abs(impact) / max) * 100);
  }

  get popArcDash(): string {
    const total = 157; // demi-cercle path ≈ π*50
    return `${(this.popAnimFill / 100) * total} ${total}`;
  }

  get popFillLevel(): string {
    const f = this.popResult?.fill_rate_pct ?? 0;
    if (f >= 90) return 'very-high';
    if (f >= 70) return 'high';
    if (f >= 50) return 'medium';
    if (f >= 30) return 'low';
    return 'very-low';
  }

  formatPopFeature(name: string): string {
    return this.formatPopFeatureEn(name);
  }

  formatPopFeatureEn(name: string): string {
    const num: Record<string, string> = {
      capacity:                'Capacity',
      theme_popularity:        'Theme popularity',
      location_accessibility:  'Location & accessibility',
      community_engagement:    'Community engagement',
      social_media_score:      'Social media presence',
      has_sponsor:             'Sponsor',
      organizer_reputation:    'Organizer reputation',
      similar_events_count:    'Similar events history',
      historical_fill_rate:    'Historical fill rate',
      days_before_publish:     'Publication lead time',
      is_weekend:              'Date & timing (weekend)',
      start_hour:              'Event start time',
    };
    if (num[name]) return num[name];

    // OHE groupées — afficher la valeur réelle choisie par l'user
    if (name.startsWith('event_type_')) {
      // Remplacer le type ML par la catégorie Vero lisible
      const categoryLabels: Record<string, string> = {
        'Cleanup':      'Event type: Cleanup',
        'Planting':     'Event type: Planting',
        'Workshop':     'Event type: Workshop',
        'Conservation': 'Event type: Conservation',
      };
      return categoryLabels[this.form.category] || `Event type: ${name.replace('event_type_', '')}`;
    }
    if (name.startsWith('location_'))  return `Location: ${name.replace('location_', '')}`;
    if (name.startsWith('season_'))    return `Season: ${name.replace('season_', '')}`;
    return name;
  }

  applyPredictedReservations(): void {
    if (this.reservationApplied || !this.popResult) return;
    this.form.capacity      = this.popResult.gb_prediction;
    this.reservationApplied = true;
    this.showToast('Capacity updated ✅', `Capacity set to ${this.popResult.gb_prediction} seats based on ML prediction.`);
    this.cdr.markForCheck();
  }

  get popFillLabel(): string {
    const f = this.popResult?.fill_rate_pct ?? 0;
    if (f >= 90) return 'Very High';
    if (f >= 70) return 'High';
    if (f >= 50) return 'Moderate';
    if (f >= 30) return 'Low';
    return 'Very Low';
  }

  get popAdviceTextEn(): string {
    if (!this.popResult) return '';
    const a = this.popResult.capacity_advice;
    const f = this.popResult.fill_rate_pct;
    const s = this.popResult.suggested_capacity;
    if (a === 'increase') return `Strong demand! Consider increasing capacity to ${s} seats (+20%).`;
    if (a === 'optimal')  return `Well-calibrated capacity. Expected fill rate: ${f}%.`;
    if (a === 'reduce')   return `Reduce capacity to ~${s} seats to optimize costs.`;
    return `Low expected attendance (${f}%). Review date, location or pricing.`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AI SUCCESS PREDICTOR (step 6)
  // ══════════════════════════════════════════════════════════════════════════

  async runPrediction(): Promise<void> {
    this.predicting = true;
    this.predStep   = 0;
    this.predResult = null;
    this.cdr.markForCheck();

    const today     = new Date();
    const eventDay  = new Date(this.formDate);
    const daysUntil = Math.max(1, Math.ceil((eventDay.getTime() - today.getTime()) / 86400000));

    for (let i = 0; i < this.predSteps.length; i++) {
      await new Promise(r => setTimeout(r, 550 + Math.random() * 300));
      this.predStep = i + 1;
      this.cdr.markForCheck();
    }

    const payload = {
      date:      this.formDate,
      time:      this.formTime || '09:00',
      category:  this.form.category || 'Cleanup',
      city:      (this.form.location || 'Tunis').split(',')[0].trim(),
      audience:  'General public',
      capacity:  this.form.capacity,
      duration:  2,
      isOutdoor: 1,
      daysUntil,
    };

    this.http.post<any>(`${this.ML_API}/predict`, payload).subscribe({
      next: res => {
        this.predResult  = res;
        this.predicting  = false;
        this.animPredScore(res.score);
        this.cdr.markForCheck();
      },
      error: () => {
        this.predicting = false;
        this.predResult = { error: true };
        this.cdr.markForCheck();
      }
    });
  }

  private animPredScore(target: number): void {
    this.predAnimScore = 0;
    const inc = target / 60;
    const iv  = setInterval(() => {
      this.predAnimScore = Math.min(this.predAnimScore + inc, target);
      this.cdr.markForCheck();
      if (this.predAnimScore >= target) { this.predAnimScore = target; clearInterval(iv); }
    }, 16);
  }

  predScoreColor(s: number): string { return s >= 75 ? '#1e6b45' : s >= 55 ? '#c47d0e' : '#c0392b'; }

  predScoreDash(s: number): string {
    const c = 2 * Math.PI * 54;
    return `${(s / 100) * c} ${c - (s / 100) * c}`;
  }

  predSigBg(st: string):    string { return st==='good'?'rgba(30,107,69,.08)':st==='warning'?'rgba(196,125,14,.08)':'rgba(192,57,43,.08)'; }
  predSigColor(st: string): string { return st==='good'?'#1e6b45':st==='warning'?'#c47d0e':'#c0392b'; }
  predShapColor(v: number): string { return v > 0 ? '#1e6b45' : '#c0392b'; }
  predShapWidth(v: number): number { return Math.min(100, Math.abs(v) * 80); }
  predPrioColor(p: string): string { return p==='high'?'#c0392b':p==='medium'?'#c47d0e':'#1e6b45'; }

  skipPrediction(): void {
    this.predResult    = null;
    this.predicting    = false;
    this.predStep      = 0;
    this.predAnimScore = 0;
    this.formStep      = 5;   // revient au step 5 (review)
    this.cdr.markForCheck();
  }
}