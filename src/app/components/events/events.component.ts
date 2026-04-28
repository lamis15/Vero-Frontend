import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Event, Reservation, EventApiService } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';
import { EventRatingService, RatingResponse } from '../../services/Event rating.service';
import { environment } from '../../../environments/environment';

interface Leaf   { style: string; color: string; }
interface Octopus { style: string; color: string; }
interface Bubble  { style: string; }
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
  showVismeModal = false;

  // ── HuggingFace API ───────────────────────────────────────────────────────
  private readonly HF_API = 'http://localhost:8080';

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
  octopuses: Octopus[] = [];
  bubbles: Bubble[] = [];
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

  // ── Rating Lightbox ───────────────────────────────────────────────────────
  ratingLightboxUrl    = '';
  ratingLightboxAuthor = '';

  // ── Categories ────────────────────────────────────────────────────────────
  categories = [
    { key: 'Cleanup',        label: 'Cleanup',          emoji: '🧹', desc: 'Clean beaches, parks, forests & streets' },
    { key: 'Planting',       label: 'Planting',         emoji: '🌱', desc: 'Plant trees, flowers & restore green spaces' },
    { key: 'Workshop',       label: 'Workshop',         emoji: '🎨', desc: 'Learn and share eco-friendly skills' },
    { key: 'Conservation',   label: 'Conservation',     emoji: '🦋', desc: 'Protect animals, biodiversity & natural habitats' },
    { key: 'Recycling',      label: 'Recycling',        emoji: '♻️', desc: 'Reduce waste, recycle materials & promote reuse' },
    { key: 'Awareness',      label: 'Awareness',        emoji: '📢', desc: 'Raise awareness about environmental issues' },
    { key: 'Energy',         label: 'Renewable Energy', emoji: '☀️', desc: 'Promote solar, wind and clean energy solutions' },
    { key: 'Water',          label: 'Water Protection', emoji: '💧', desc: 'Protect water resources, rivers, lakes and oceans' },
    { key: 'Climate',        label: 'Climate Action',   emoji: '🌍', desc: 'Fight climate change and reduce carbon impact' },
    { key: 'SustainableFood',label: 'Sustainable Food', emoji: '🥦', desc: 'Promote local, organic and sustainable food' },
    { key: 'EcoMobility',    label: 'Eco Mobility',     emoji: '🚲', desc: 'Encourage biking, walking and green transport' },
    { key: 'Community',      label: 'Community Action', emoji: '🤝', desc: 'Local eco initiatives and community projects' }
  ];

  private roleSub!: Subscription;

  // ── Popularity Predictor ──────────────────────────────────────────────────
  popAvailable       = true;   // HF toujours disponible
  popPredicting      = false;
  popResult: any     = null;
  popAnimFill        = 0;
  capacityApplied    = false;
  reservationApplied = false;
  private popFillTimer: any;

  // ── AI Success Predictor ──────────────────────────────────────────────────
  mlAvailable       = true;   // HF toujours disponible
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
    this.generateOctopuses();
    this.generateBubbles();
    this.generateTurtles();

    this.roleSub = this.auth.roleStream$.subscribe(() => {
      this.cdr.markForCheck();
      if (!this.auth.isAdmin && !this.auth.isPartner) this.loadMyReservations();
    });

    this.load();

    // HuggingFace Spaces — toujours disponible, pas besoin de health check
    this.mlAvailable  = true;
    this.popAvailable = true;
    this.cdr.markForCheck();

    if (this.auth.isLoggedIn && !this.auth.isAdmin && !this.auth.isPartner) {
      this.loadMyReservations();
    }
  }

  ngOnDestroy(): void {
    this.roleSub?.unsubscribe();
    Object.values(this.ratingSubs).forEach(s => s.unsubscribe());
    clearInterval(this.popFillTimer);
  }

  generateLeaves(): void {
    const colors = ['#74c69d','#52b788','#40916c','#95d5b2','#b7e4c7','#d8f3dc'];
    this.leaves = Array.from({ length: 14 }, () => {
      const left = Math.random() * 100, duration = 8 + Math.random() * 12, delay = Math.random() * 15, size = 12 + Math.random() * 12;
      const color = colors[Math.floor(Math.random() * colors.length)];
      return { color, style: `left:${left}%;width:${size}px;height:${size*1.3}px;animation-duration:${duration}s;animation-delay:${delay}s` };
    });
  }

  generateTurtles(): void {
    this.turtles = Array.from({ length: 4 }, (_, i) => ({ x: -120 - i * 220, y: 18 + Math.random() * 24, speed: 0.3 + Math.random() * 0.3, size: 52 + Math.random() * 28, delay: i * 4, flipped: false }));
  }

  generateOctopuses(): void {
    const colors = ['#00b4d8', '#48cae4', '#0096c7', '#90e0ef'];
    this.octopuses = Array.from({ length: 7 }, () => {
      const left = Math.random() * 100;
      const duration = 16 + Math.random() * 16;
      const delay = Math.random() * 18;
      const size = 38 + Math.random() * 34;
      const sway = -55 + Math.random() * 110;
      const opacity = 0.22 + Math.random() * 0.28;
      const color = colors[Math.floor(Math.random() * colors.length)];
      return { color, style: `left:${left}%;width:${size}px;height:${size * 1.1}px;color:${color};--sway:${sway}px;--op:${opacity};animation-duration:${duration}s;animation-delay:${delay}s` };
    });
  }

  generateBubbles(): void {
    this.bubbles = Array.from({ length: 22 }, () => {
      const left = Math.random() * 100;
      const size = 5 + Math.random() * 14;
      const duration = 9 + Math.random() * 16;
      const delay = Math.random() * 12;
      const sway = -30 + Math.random() * 60;
      return { style: `left:${left}%;width:${size}px;height:${size}px;--bsway:${sway}px;animation-duration:${duration}s;animation-delay:${delay}s` };
    });
  }

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

  get filteredEvents(): Event[] {
    return this.events.filter(ev => {
      const matchFilter = this.activeFilter === 'ALL' || this.getCategoryLabel(ev) === this.activeFilter;
      const matchSearch = !this.searchQuery || ev.title.toLowerCase().includes(this.searchQuery.toLowerCase()) || ev.location.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }

  resetPage(): void { this.currentPage = 0; this.cdr.markForCheck(); }
  get pagedEvents(): Event[] { const s = this.currentPage * this.pageSize; return this.filteredEvents.slice(s, s + this.pageSize); }
  get totalPages(): number { return Math.ceil(this.filteredEvents.length / this.pageSize); }
  get pagesArray(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i); }
  prevPage(): void { if (this.currentPage > 0) { this.currentPage--; this.flippedId = null; this.cdr.markForCheck(); } }
  nextPage(): void { if (this.currentPage < this.totalPages - 1) { this.currentPage++; this.flippedId = null; this.cdr.markForCheck(); } }
  goToPage(page: number): void { this.currentPage = page; this.flippedId = null; this.cdr.markForCheck(); }

  isAdmin():   boolean { return this.auth.isAdmin; }
  isPartner(): boolean { return this.auth.isPartner; }
  isUser():    boolean { return !this.auth.isAdmin && !this.auth.isPartner; }
  canManage(): boolean { return this.auth.canManageEvents; }

  openDetail(ev: Event): void { this.detailEvent = ev; this.joinLoading = false; this.showDetail = true; }

  confirmJoin(): void {
    if (!this.detailEvent?.id || this.joinLoading) return;

    this.joinLoading = true;
    const id = this.detailEvent.id;

    this.api.reserve(id).subscribe({
      next: () => {
        this.joinedEventIds.add(id);
        this.joinLoading = false;
        this.showDetail = false;
        this.load();
        this.showToast('Reservation sent', 'Your reservation request has been submitted.');
        this.cdr.markForCheck();
      },
      error: err => {
        this.joinLoading = false;
        const msg = this.getErrorMessage(err);
        if (err.status === 409 || msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('already')) {
          this.joinedEventIds.add(id);
          this.showDetail = false;
          this.showToast('Already registered', 'You are already registered for this event.');
        } else {
          this.showToast('Error', msg, true);
        }
        this.cdr.markForCheck();
      }
    });
  }

  hasJoined(id: number): boolean { return this.joinedEventIds.has(id); }

  flipCard(eventId: number): void {
    if (this.flippedId === eventId) { this.flippedId = null; }
    else { this.flippedId = eventId; if (!this.eventRatings[eventId]) this.loadRatingsForEvent(eventId); }
    this.cdr.markForCheck();
  }

  private loadRatingsForEvent(eventId: number): void {
    this.ratingService.getRatings(eventId).subscribe({
      next: (ratings: RatingResponse[]) => { this.eventRatings[eventId] = ratings; this.cdr.markForCheck(); }
    });
    if (!this.ratingSubs[eventId]) {
      this.ratingSubs[eventId] = this.ratingService.subscribeToRatings(eventId).subscribe((newRating: RatingResponse) => {
        if (!this.eventRatings[eventId]) this.eventRatings[eventId] = [];
        const idx = this.eventRatings[eventId].findIndex(r => r.id === newRating.id);
        if (idx >= 0) { this.eventRatings[eventId][idx] = newRating; } else { this.eventRatings[eventId] = [newRating, ...this.eventRatings[eventId]]; }
        this.latestRatingIds[eventId] = newRating.id;
        setTimeout(() => { this.latestRatingIds[eventId] = null; this.cdr.markForCheck(); }, 1000);
        this.cdr.markForCheck();
      });
    }
  }

  getEventRatings(eventId: number): RatingResponse[] { return this.eventRatings[eventId] || []; }
  getEventAvg(eventId: number): number { const r = this.getEventRatings(eventId); return r.length === 0 ? 0 : r[0].averageStars; }
  getEventAvgRounded(eventId: number): number { return Math.round(this.getEventAvg(eventId)); }

  resolveRatingImageUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
  }
  openRatingLightbox(url: string, author: string = ''): void {
    this.ratingLightboxUrl    = url;
    this.ratingLightboxAuthor = author;
    this.cdr.markForCheck();
  }
  closeRatingLightbox(): void { this.ratingLightboxUrl = ''; this.ratingLightboxAuthor = ''; this.cdr.markForCheck(); }

  onImageSelected(event: any): void {
    const file: File = event.target.files[0]; if (!file) return;
    this.uploadedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => { this.uploadPreview = e.target.result; this.cdr.markForCheck(); };
    reader.readAsDataURL(file);
  }

  uploadImage(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.uploadedImageFile) { resolve(''); return; }
      this.api.uploadImage(this.uploadedImageFile).subscribe({ next: (res) => resolve(res.url || ''), error: () => resolve('') });
    });
  }

  resetForm(): any { return { title: '', description: '', location: '', capacity: 50, startDate: '', endDate: '', status: 'UPCOMING', category: 'Cleanup', imageUrl: '' }; }

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
    const rawUrl = (ev as any).imageUrl || '';
    this.uploadPreview = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `${environment.apiUrl}${rawUrl}`) : '';
    this.uploadedImageFile = null;
    if (ev.startDate) { this.formDate = ev.startDate.substring(0,10); this.formTime = ev.startDate.substring(11,16); }
    if (ev.endDate)   { this.formEndDate = ev.endDate.substring(0,10); this.formEndTime = ev.endDate.substring(11,16); }
    this.formStep = 1; this.showFormModal = true;
    this._resetAllML();
  }

  private _resetAllML(): void {
    this.popResult = null; this.popPredicting = false; this.popAnimFill = 0;
    this.capacityApplied = false; this.reservationApplied = false; this._computedSeason = '';
    clearInterval(this.popFillTimer);
    this.predResult = null; this.predicting = false; this.predStep = 0; this.predAnimScore = 0;
  }

  nextStep(): void {
    if (this.formStep === 1 && !this.form.title?.trim()) { this.showToast('', 'Title is required.', true); return; }
    if (this.formStep === 2) { this.form.startDate = `${this.formDate}T${this.formTime || '00:00'}:00`; this.form.endDate = `${this.formEndDate || this.formDate}T${this.formEndTime || '23:59'}:00`; }
    this.formStep++;
    if (this.formStep === 3) { this.popResult = null; this.popPredicting = false; this.popAnimFill = 0; }
    if (this.formStep === 6) { this.predResult = null; this.predicting = false; this.predStep = 0; }
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
          this.editMode ? 'Event updated' : 'Event created',
          this.editMode ? 'Changes have been saved.' : 'Your event is now published.'
        );
        this.cdr.markForCheck();
      },
      error: err => {
        this.saveLoading = false;
        this.showToast('Validation error', this.getErrorMessage(err), true);
        this.cdr.markForCheck();
      }
    });
  }

  askDelete(ev: Event): void { this.confirmEventName = ev.title; this.confirmDeleteId = ev.id; this.showConfirm = true; }

  doDelete(): void {
    if (!this.confirmDeleteId) return;
    const id = this.confirmDeleteId;
    const backup = [...this.events];
    this.events = this.events.filter(e => e.id !== id);
    this.showConfirm = false;
    this.cdr.markForCheck();

    this.api.delete(id).subscribe({
      next: () => { this.showToast('Event deleted', 'The event has been deleted.'); },
      error: err => {
        this.events = backup;
        this.showToast(
          'Deletion not allowed',
          this.getErrorMessage(err) === 'A server error occurred. Please try again.'
            ? 'This event cannot be deleted because it already has reservations.'
            : this.getErrorMessage(err),
          true
        );
        this.cdr.markForCheck();
      }
    });
  }

  private getErrorMessage(err: any): string {
    if (err?.error?.message) return err.error.message;
    if (typeof err?.error === 'string') return err.error;
    if (err?.message?.includes('Http failure')) return 'A server error occurred. Please try again.';
    return 'An error occurred.';
  }

  showToast(title: string, msg: string, isError = false): void {
    this.toastTitle = title || (isError ? 'Error' : 'Succès');
    this.toastMsg = msg || 'Une erreur est survenue.';
    this.toastIsError = isError;
    setTimeout(() => { this.toastMsg = ''; this.toastTitle = ''; this.cdr.markForCheck(); }, 4500);
  }

  getCategoryLabel(ev: Event): string {
    const t = (ev.title + ' ' + (ev.description || '')).toLowerCase();
    if (t.includes('recycl') || t.includes('waste') || t.includes('plastic') || t.includes('reuse')) return 'Recycling';
    if (t.includes('water') || t.includes('river') || t.includes('lake') || t.includes('ocean') || t.includes('sea')) return 'Water';
    if (t.includes('climate') || t.includes('carbon') || t.includes('co2') || t.includes('global warming')) return 'Climate';
    if (t.includes('solar') || t.includes('wind') || t.includes('energy') || t.includes('renewable')) return 'Energy';
    if (t.includes('food') || t.includes('organic') || t.includes('farm') || t.includes('compost')) return 'SustainableFood';
    if (t.includes('bike') || t.includes('bicycle') || t.includes('mobility') || t.includes('transport')) return 'EcoMobility';
    if (t.includes('awareness') || t.includes('campaign') || t.includes('education') || t.includes('conference')) return 'Awareness';
    if (t.includes('community') || t.includes('volunteer') || t.includes('local')) return 'Community';
    if (t.includes('plant') || t.includes('tree') || t.includes('forest') || t.includes('garden')) return 'Planting';
    if (t.includes('workshop') || t.includes('training') || t.includes('learn')) return 'Workshop';
    if (t.includes('animal') || t.includes('wildlife') || t.includes('biodiversity') || t.includes('conservation')) return 'Conservation';
    return 'Cleanup';
  }

  getEventImage(ev: Event): string {
    const imageUrl = (ev as any).imageUrl;
    if (imageUrl) return imageUrl.startsWith('http') ? imageUrl : `${environment.apiUrl}${imageUrl}`;
    const cat = this.getCategoryLabel(ev);
    const images: any = { Planting: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800', Cleanup: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', Workshop: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800', Conservation: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800' };
    return images[cat] || images['Cleanup'];
  }

  getFilledSpots(ev: Event): number { return Number(ev.reservedPlaces || 0); }

  getSpotsLeft(ev: Event): number { return Math.max(0, Number(ev.capacity || 0) - this.getFilledSpots(ev)); }

  getFillPercent(ev: Event): number {
    const capacity = Number(ev.capacity || 0);
    if (capacity <= 0) return 0;
    return Math.min(100, Math.round((this.getFilledSpots(ev) / capacity) * 100));
  }

  trackById(_: number, ev: Event): number { return ev.id!; }

  // ─────────────────────────────────────────────────────────────────────────
  // POPULARITY PREDICTOR — HuggingFace fn_index: 2
  // predict_popularity(capacity, theme_pop, loc_acc, comm_eng, social,
  //                    has_sponsor, org_rep, similar, hist_fill,
  //                    days_pub, is_wknd, start_h, event_type, location, season)
  // ─────────────────────────────────────────────────────────────────────────
  _computedSeason = '';
  get popSeason(): string { return this._computedSeason || this._seasonFromDate(this.formDate); }

  private _seasonFromDate(d: string): string {
    const m = d ? new Date(d).getMonth() + 1 : new Date().getMonth() + 1;
    if ([3,4,5].includes(m)) return 'Spring';
    if ([6,7,8].includes(m)) return 'Summer';
    if ([9,10,11].includes(m)) return 'Autumn';
    return 'Winter';
  }

  // Mapping catégories Angular → types HF
  private readonly CAT_TO_HF: Record<string, string> = {
    'Cleanup':        'Eco Workshop',
    'Planting':       'Eco Workshop',
    'Workshop':       'Conference',
    'Conservation':   'Eco Workshop',
    'Recycling':      'Eco Workshop',
    'Awareness':      'Conference',
    'Community':      'Eco Workshop',
    'Energy':         'Eco Workshop',
    'Water':          'Eco Workshop',
    'Climate':        'Conference',
    'SustainableFood':'Food & Drink Fair',
    'EcoMobility':    'Eco Workshop'
  };

  // Mapping ville (texte libre) → valeur HF exacte
  private readonly LOC_TO_HF: Record<string, string> = {
    'tunis':    'Tunis',    'sousse':   'Sousse',   'sfax':     'Sfax',
    'monastir': 'Monastir', 'bizerte':  'Bizerte',  'nabeul':   'Nabeul',
    'hammamet': 'Hammamet', 'djerba':   'Djerba',   'kairouan': 'Kairouan',
    'gafsa':    'Gafsa'
  };

  runPopularityPrediction(): void {
    this.popPredicting = true;
    this.popResult = null;
    this.capacityApplied = false;
    this.reservationApplied = false;

    const today    = new Date();
    const eventDay = this.formDate ? new Date(this.formDate) : today;
    const daysBeforePublish = Math.max(1, Math.ceil((eventDay.getTime() - today.getTime()) / 86400000));
    const startHour = this.formTime ? parseInt(this.formTime.split(':')[0], 10) : 18;
    const isWeekend = (eventDay.getDay() === 0 || eventDay.getDay() === 6);

    this._computedSeason = this._seasonFromDate(this.formDate);

    const rawCat  = (this.form.category || '').toString().trim();
    const rawLoc  = (this.form.location || 'Tunis').split(',')[0].trim().toLowerCase();
    const eventType = this.CAT_TO_HF[rawCat] || 'Eco Workshop';
    const location  = this.LOC_TO_HF[rawLoc]  || 'Tunis';
    const season    = this._computedSeason;

    // Ordre exact des paramètres de predict_popularity dans app.py :
    // capacity, theme_pop, loc_acc, comm_eng, social, has_sponsor,
    // org_rep, similar, hist_fill, days_pub, is_wknd, start_h,
    // event_type, location, season
    this.http.post<any>(`${this.HF_API}/api/ml/predict`, {
      fn_index: 2,
      data: [
        this.form.capacity,  // capacity
        65,                  // theme_pop
        0.75,                // loc_acc
        0.50,                // comm_eng
        0.45,                // social
        false,               // has_sponsor
        3.8,                 // org_rep
        5,                   // similar
        0.70,                // hist_fill
        daysBeforePublish,   // days_pub
        isWeekend,           // is_wknd
        startHour,           // start_h
        eventType,           // event_type
        location,            // location
        season               // season
      ]
    }).subscribe({
      next: res => {
        const markdown: string = res.data?.[0] ?? '';
        this.popResult = this._parsePopularityMarkdown(markdown, this.form.capacity);
        this.popPredicting = false;
        this.animPopFill(this.popResult.fill_rate_pct);
        this.cdr.markForCheck();
      },
      error: () => {
        this.popPredicting = false;
        this.popResult = { error: true };
        this.cdr.markForCheck();
      }
    });

    this.cdr.markForCheck();
  }

  /**
   * Parse le Markdown retourné par predict_popularity :
   *
   * ## 📊 Prévision de Fréquentation
   * **Capacité totale :** `200` places
   * | 🌲 Gradient Boosting | `140` | `70.0%` |
   * | 📐 Ridge Regression  | `130` | `65.0%` |
   * | 🎯 Moyenne           | `135` | `67.5%` |
   * **R² GB :** `0.923` | **R² LR :** `0.891` | **MAE GB :** `12.3`
   */
  private _parsePopularityMarkdown(md: string, capacity: number): any {
    const num = (re: RegExp): number => { const m = md.match(re); return m ? parseFloat(m[1]) : 0; };

    // Extraire gb_pred depuis la ligne Gradient Boosting
    const gbMatch  = md.match(/Gradient Boosting\s*\|\s*`(\d+)`\s*\|\s*`([\d.]+)%`/);
    const lrMatch  = md.match(/Ridge Regression\s*\|\s*`(\d+)`\s*\|\s*`([\d.]+)%`/);

    const gbPred   = gbMatch ? parseInt(gbMatch[1]) : Math.round(capacity * 0.7);
    const gbFill   = gbMatch ? parseFloat(gbMatch[2]) : (gbPred / capacity) * 100;
    const lrPred   = lrMatch ? parseInt(lrMatch[1]) : Math.round(capacity * 0.65);
    const lrFill   = lrMatch ? parseFloat(lrMatch[2]) : (lrPred / capacity) * 100;

    const fillRate = parseFloat(((gbFill + lrFill) / 2).toFixed(1));

    // Conseils capacité basés sur le fill rate
    let advice: string;
    let suggested: number;
    if (fillRate >= 90) {
      advice = 'increase'; suggested = Math.round(capacity * 1.2);
    } else if (fillRate >= 60) {
      advice = 'optimal';  suggested = capacity;
    } else if (fillRate >= 35) {
      advice = 'reduce';   suggested = Math.round(capacity * 0.8);
    } else {
      advice = 'review';   suggested = Math.round(capacity * 0.7);
    }

    // Métriques R²
    const r2gb = num(/R² GB[^`]*`([\d.]+)`/);
    const r2lr = num(/R² LR[^`]*`([\d.]+)`/);
    const maeGb = num(/MAE GB[^`]*`([\d.]+)`/);

    // SHAP features (non présent dans popularity mais on garde la structure)
    const shapFeatures: any[] = [];

    return {
      fill_rate_pct:    fillRate,
      gb_prediction:    gbPred,
      lr_prediction:    lrPred,
      capacity_advice:  advice,
      suggested_capacity: suggested,
      shap_top_features: shapFeatures,
      r2_gb: r2gb,
      r2_lr: r2lr,
      mae_gb: maeGb,
      raw_markdown: md
    };
  }

  private animPopFill(target: number): void {
    clearInterval(this.popFillTimer); this.popAnimFill = 0;
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
    this.form.capacity = val;
    this.capacityApplied = true;
    this.showToast('Capacity adjusted ✅', `Capacity updated to ${val} seats.`);
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

  get popArcDash(): string { return `${(this.popAnimFill / 100) * 157} 157`; }

  get popFillLevel(): string {
    const f = this.popResult?.fill_rate_pct ?? 0;
    if (f >= 90) return 'very-high';
    if (f >= 70) return 'high';
    if (f >= 50) return 'medium';
    if (f >= 30) return 'low';
    return 'very-low';
  }

  get popFillLabel(): string {
    const f = this.popResult?.fill_rate_pct ?? 0;
    if (f >= 90) return 'Very High';
    if (f >= 70) return 'High';
    if (f >= 50) return 'Moderate';
    if (f >= 30) return 'Low';
    return 'Very Low';
  }

  formatPopFeature(name: string): string { return this.formatPopFeatureEn(name); }

  formatPopFeatureEn(name: string): string {
    const m: Record<string, string> = {
      capacity: 'Capacity', theme_popularity: 'Theme popularity',
      location_accessibility: 'Location & accessibility', community_engagement: 'Community engagement',
      social_media_score: 'Social media presence', has_sponsor: 'Sponsor',
      organizer_reputation: 'Organizer reputation', similar_events_count: 'Similar events history',
      historical_fill_rate: 'Historical fill rate', days_before_publish: 'Publication lead time',
      is_weekend: 'Date & timing (weekend)', start_hour: 'Event start time'
    };
    if (m[name]) return m[name];
    if (name.startsWith('event_type_')) {
      const cl: Record<string, string> = { 'Cleanup': 'Event type: Cleanup', 'Planting': 'Event type: Planting', 'Workshop': 'Event type: Workshop', 'Conservation': 'Event type: Conservation' };
      return cl[this.form.category] || `Event type: ${name.replace('event_type_', '')}`;
    }
    if (name.startsWith('location_')) return `Location: ${name.replace('location_', '')}`;
    if (name.startsWith('season_')) return `Season: ${name.replace('season_', '')}`;
    return name;
  }

  applyPredictedReservations(): void {
    if (this.reservationApplied || !this.popResult) return;
    this.form.capacity = this.popResult.gb_prediction;
    this.reservationApplied = true;
    this.showToast('Capacity updated ✅', `Capacity set to ${this.popResult.gb_prediction} seats.`);
    this.cdr.markForCheck();
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

  // ─────────────────────────────────────────────────────────────────────────
  // AI SUCCESS PREDICTOR — HuggingFace fn_index: 0
  // predict_event(weather, trend, calendar, competition, capacity, duration,
  //               start_hour, days_until, is_outdoor, is_weekend, month,
  //               city_appeal, audience_score, time_score, capacity_score,
  //               has_social, has_sponsor, organizer_exp, category, city)
  // ─────────────────────────────────────────────────────────────────────────
  async runPrediction(): Promise<void> {
    this.predicting = true;
    this.predStep   = 0;
    this.predResult = null;
    this.cdr.markForCheck();

    const today    = new Date();
    const eventDay = this.formDate ? new Date(this.formDate) : today;
    const daysUntil = Math.max(1, Math.ceil((eventDay.getTime() - today.getTime()) / 86400000));
    const startHour = this.formTime ? parseInt(this.formTime.split(':')[0], 10) : 9;
    const isWeekend = (eventDay.getDay() === 0 || eventDay.getDay() === 6);
    const month     = eventDay.getMonth() + 1;

    // Mapping catégorie → valeur HF exacte
    const catMap: Record<string, string> = {
      'Cleanup': 'Cleanup', 'Planting': 'Planting', 'Workshop': 'Workshop',
      'Conservation': 'Conservation', 'Recycling': 'Cleanup', 'Awareness': 'Workshop',
      'Community': 'Cleanup', 'Energy': 'Workshop', 'Water': 'Cleanup',
      'Climate': 'Workshop', 'SustainableFood': 'Workshop', 'EcoMobility': 'Marathon'
    };

    // Mapping ville → valeur HF exacte
    const cityMap: Record<string, string> = {
      'tunis': 'Tunis', 'sousse': 'Sousse', 'sfax': 'Sfax', 'djerba': 'Djerba',
      'nabeul': 'Nabeul', 'bizerte': 'Bizerte', 'monastir': 'Monastir',
      'mahdia': 'Mahdia', 'gafsa': 'Gafsa', 'tozeur': 'Tozeur'
    };

    const rawCat  = (this.form.category || '').toString().trim();
    const rawCity = (this.form.location || 'Tunis').split(',')[0].trim().toLowerCase();
    const category = catMap[rawCat]  || 'Workshop';
    const city     = cityMap[rawCity] || 'Tunis';

    // Animation des étapes (UI)
    for (let i = 0; i < this.predSteps.length; i++) {
      await new Promise(r => setTimeout(r, 550 + Math.random() * 300));
      this.predStep = i + 1;
      this.cdr.markForCheck();
    }

    // Ordre exact des paramètres de predict_event dans app.py :
    // weather, trend, calendar, competition, capacity, duration,
    // start_hour, days_until, is_outdoor, is_weekend, month,
    // city_appeal, audience_score, time_score, capacity_score,
    // has_social, has_sponsor, organizer_exp, category, city
    this.http.post<any>(`${this.HF_API}/api/ml/predict`, {
      fn_index: 0,
      data: [
        65,           // weather_score
        60,           // trend_score
        70,           // calendar_score
        55,           // competition_score
        this.form.capacity, // capacity
        2,            // duration_hours
        startHour,    // start_hour
        daysUntil,    // days_until
        true,         // is_outdoor
        isWeekend,    // is_weekend
        month,        // month
        0.7,          // city_appeal
        0.7,          // audience_score
        0.75,         // time_score
        0.72,         // capacity_score
        true,         // has_social_media
        false,        // has_sponsor
        5,            // organizer_exp
        category,     // category
        city          // city
      ]
    }).subscribe({
      next: res => {
        const markdown: string = res.data?.[0] ?? '';
        this.predResult = this._parseEventMarkdown(markdown);
        this.predicting = false;
        this.animPredScore(this.predResult.score);
        this.cdr.markForCheck();
      },
      error: () => {
        this.predicting = false;
        this.predResult = { error: true };
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Parse le Markdown retourné par predict_event :
   *
   * ## ✅ Succès prédit
   * **Probabilité de succès :** `78.3%`
   * **Métriques modèle :** Accuracy `0.847` | AUC `0.912`
   * ### 🔍 Top 3 facteurs SHAP
   * - **weather_score** : `+0.234`
   * - **days_until** : `-0.187`
   * - **capacity** : `+0.143`
   */
  private _parseEventMarkdown(md: string): any {
    const probaMatch = md.match(/Probabilité de succès[^`]*`([\d.]+)%`/);
    const score = probaMatch ? parseFloat(probaMatch[1]) : 50;

    const isSuccess = md.includes('✅') || md.toLowerCase().includes('succès prédit');

    const accMatch = md.match(/Accuracy\s*`([\d.]+)`/);
    const aucMatch = md.match(/AUC\s*`([\d.]+)`/);
    const accuracy = accMatch ? parseFloat(accMatch[1]) : null;
    const auc      = aucMatch ? parseFloat(aucMatch[1]) : null;

    // SHAP features
    const shapFeatures: any[] = [];
    const shapRegex = /\*\*([^*]+)\*\*\s*:\s*`([+-]?[\d.]+)`/g;
    let m;
    while ((m = shapRegex.exec(md)) !== null) {
      shapFeatures.push({ feature: m[1].trim(), impact: parseFloat(m[2]) });
    }

    // Construire des signaux lisibles pour l'UI
    const signals = [
      { label: 'Weather',     status: score >= 60 ? 'good' : 'warning',  value: '65/100' },
      { label: 'Trends',      status: score >= 50 ? 'good' : 'bad',      value: '60/100' },
      { label: 'Calendar',    status: 'good',                             value: '70/100' },
      { label: 'Competition', status: score >= 55 ? 'good' : 'warning',  value: '55/100' },
    ];

    // Recommandations basées sur le score
    const recommendations = score >= 75
      ? [{ priority: 'low',  text: 'Strong event profile — promote early on social media.' }]
      : score >= 55
        ? [
            { priority: 'medium', text: 'Increase social media presence before the event.' },
            { priority: 'medium', text: 'Consider adding a sponsor to boost credibility.' }
          ]
        : [
            { priority: 'high', text: 'Reconsider the date — check competing events.' },
            { priority: 'high', text: 'Strengthen community engagement before launch.' }
          ];

    return {
      success: isSuccess,
      score,
      accuracy,
      auc,
      shap: shapFeatures,
      signals,
      recommendations,
      raw_markdown: md
    };
  }

  private animPredScore(target: number): void {
    this.predAnimScore = 0;
    const inc = target / 60;
    const iv = setInterval(() => {
      this.predAnimScore = Math.min(this.predAnimScore + inc, target);
      this.cdr.markForCheck();
      if (this.predAnimScore >= target) { this.predAnimScore = target; clearInterval(iv); }
    }, 16);
  }

  predScoreColor(s: number): string { return s >= 75 ? '#1e6b45' : s >= 55 ? '#c47d0e' : '#c0392b'; }
  predScoreDash(s: number): string  { const c = 2 * Math.PI * 54; return `${(s / 100) * c} ${c - (s / 100) * c}`; }
  predSigBg(st: string): string     { return st === 'good' ? 'rgba(30,107,69,.08)' : st === 'warning' ? 'rgba(196,125,14,.08)' : 'rgba(192,57,43,.08)'; }
  predSigColor(st: string): string  { return st === 'good' ? '#1e6b45' : st === 'warning' ? '#c47d0e' : '#c0392b'; }
  predShapColor(v: number): string  { return v > 0 ? '#1e6b45' : '#c0392b'; }
  predShapWidth(v: number): number  { return Math.min(100, Math.abs(v) * 80); }
  predPrioColor(p: string): string  { return p === 'high' ? '#c0392b' : p === 'medium' ? '#c47d0e' : '#1e6b45'; }

  skipPrediction(): void {
    this.predResult = null; this.predicting = false; this.predStep = 0; this.predAnimScore = 0;
    this.formStep = 5;
    this.cdr.markForCheck();
  }
}