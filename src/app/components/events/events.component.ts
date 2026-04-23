import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Event, Reservation, EventApiService } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';
import { EventRatingService, RatingResponse } from '../../services/Event rating.service';

interface Leaf { style: string; color: string; }
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

  // â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  events: Event[]  = [];
  loading          = true;
  loadError        = false;
  joinedEventIds   = new Set<number>();

  // â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  toastMsg     = '';
  toastTitle   = '';
  toastIsError = false;

  // â”€â”€ Search / Filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  searchQuery  = '';
  activeFilter = 'ALL';

  // â”€â”€ Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  showDetail  = false;
  detailEvent: Event | null = null;
  joinLoading = false;

  // â”€â”€ Form Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Image Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  uploadedImageUrl  = '';
  uploadedImageFile: File | null = null;
  uploadPreview     = '';
  uploadLoading     = false;

  // â”€â”€ Delete Confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  showConfirm      = false;
  confirmEventName = '';
  confirmDeleteId?: number;

  // â”€â”€ Animations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  leaves:  Leaf[]   = [];
  turtles: Turtle[] = [];

  // â”€â”€ Flip Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  flippedId: number | null = null;

  // â”€â”€ Pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  pageSize    = 3;
  currentPage = 0;

  // â”€â”€ Ratings par event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  eventRatings:   { [eventId: number]: RatingResponse[] } = {};
  latestRatingIds: { [eventId: number]: number | null }   = {};
  private ratingSubs: { [eventId: number]: Subscription } = {};

  // â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  categories = [
    { key: 'Cleanup',      label: 'Cleanup',      emoji: 'ðŸ§¹', desc: 'Clean beaches, parks & streets' },
    { key: 'Planting',     label: 'Planting',     emoji: 'ðŸŒ±', desc: 'Plant trees & restore habitats' },
    { key: 'Workshop',     label: 'Workshop',     emoji: 'ðŸŽ¨', desc: 'Learn & share eco-skills'        },
    { key: 'Conservation', label: 'Conservation', emoji: 'ðŸ¦‹', desc: 'Protect biodiversity'            },
  ];

  private roleSub!: Subscription;

  constructor(
    private api:           EventApiService,
    private auth:          AuthService,
    private cdr:           ChangeDetectorRef,
    private ratingService: EventRatingService
  ) {}

  ngOnInit(): void {
    this.generateLeaves();
    this.generateTurtles();
    this.load();
    if (this.auth.isLoggedIn && !this.auth.isAdmin && !this.auth.isPartner) {
      this.loadMyReservations();
    }
    this.roleSub = this.auth.roleStream$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.roleSub?.unsubscribe();
    Object.values(this.ratingSubs).forEach(s => s.unsubscribe());
  }

  // â”€â”€ Leaves â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Turtles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (this.currentPage > 0) {
      this.currentPage--;
      this.flippedId = null;
      this.cdr.markForCheck();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.flippedId = null;
      this.cdr.markForCheck();
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.flippedId = null;
    this.cdr.markForCheck();
  }

  // â”€â”€ Roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  isAdmin():   boolean { return this.auth.isAdmin; }
  isPartner(): boolean { return this.auth.isPartner; }
  isUser(): boolean { return !this.auth.isAdmin && !this.auth.isPartner; }
  canManage(): boolean { return this.auth.canManageEvents; }

  // â”€â”€ Detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        this.showToast('Reservation confirmed! ðŸŽ‰', 'A confirmation email with your QR ticket has been sent.');
        this.cdr.markForCheck();
      },
      error: err => {
        this.joinLoading = false;
        const msg = err.error?.message || '';
        if (err.status === 409 || msg.toLowerCase().includes('dÃ©jÃ ') || msg.toLowerCase().includes('already')) {
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

  // â”€â”€ Flip Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  flipCard(eventId: number): void {
    if (this.flippedId === eventId) {
      this.flippedId = null;
    } else {
      this.flippedId = eventId;
      if (!this.eventRatings[eventId]) {
        this.loadRatingsForEvent(eventId);
      }
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
          if (!this.eventRatings[eventId]) {
            this.eventRatings[eventId] = [];
          }
          const idx = this.eventRatings[eventId].findIndex(r => r.id === newRating.id);
          if (idx >= 0) {
            this.eventRatings[eventId][idx] = newRating;
          } else {
            this.eventRatings[eventId] = [newRating, ...this.eventRatings[eventId]];
          }
          this.latestRatingIds[eventId] = newRating.id;
          setTimeout(() => {
            this.latestRatingIds[eventId] = null;
            this.cdr.markForCheck();
          }, 1000);
          this.cdr.markForCheck();
        });
    }
  }

  getEventRatings(eventId: number): RatingResponse[] {
    return this.eventRatings[eventId] || [];
  }

  getEventAvg(eventId: number): number {
    const ratings = this.getEventRatings(eventId);
    if (ratings.length === 0) return 0;
    return ratings[0].averageStars;
  }

  getEventAvgRounded(eventId: number): number {
    return Math.round(this.getEventAvg(eventId));
  }

  // â”€â”€ Image Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  onImageSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.uploadedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.uploadPreview = e.target.result;
      this.cdr.markForCheck();
    };
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

  // â”€â”€ Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  resetForm(): any {
    return { title: '', description: '', location: '', capacity: 50, startDate: '', endDate: '', status: 'UPCOMING', category: 'Cleanup', imageUrl: '' };
  }

  openCreate(): void {
    this.editMode = false; this.selectedId = undefined;
    this.form = this.resetForm();
    this.formDate = this.formTime = this.formEndDate = this.formEndTime = '';
    this.uploadPreview = ''; this.uploadedImageFile = null;
    this.formStep = 1; this.showFormModal = true;
  }

  openEdit(ev: Event): void {
    this.editMode = true; this.selectedId = ev.id;
    this.form = { ...ev, category: this.getCategoryLabel(ev) };
    this.uploadPreview = (ev as any).imageUrl || '';
    this.uploadedImageFile = null;
    if (ev.startDate) { this.formDate = ev.startDate.substring(0,10); this.formTime = ev.startDate.substring(11,16); }
    if (ev.endDate)   { this.formEndDate = ev.endDate.substring(0,10); this.formEndTime = ev.endDate.substring(11,16); }
    this.formStep = 1; this.showFormModal = true;
  }

  nextStep(): void {
    if (this.formStep === 1 && !this.form.title?.trim()) {
      this.showToast('', 'Le titre est obligatoire.', true); return;
    }
    if (this.formStep === 2) {
      this.form.startDate = `${this.formDate}T${this.formTime || '00:00'}:00`;
      this.form.endDate   = `${this.formEndDate || this.formDate}T${this.formEndTime || '23:59'}:00`;
    }
    this.formStep++;
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
          this.editMode ? 'Event updated! âœï¸' : 'Event created! ðŸŒ¿',
          this.editMode ? 'Changes saved successfully.' : 'Your event is now live.'
        );
        this.cdr.markForCheck();
      },
      error: err => {
        this.saveLoading = false;
        this.showToast('', err.error?.message || 'VÃ©rifiez vos permissions.', true);
        this.cdr.markForCheck();
      }
    });
  }

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      next:  () => this.showToast('Event deleted ðŸ—‘ï¸', 'The event has been removed.'),
      error: err => {
        this.events = backup;
        this.showToast('', err.error?.message || 'Erreur serveur.', true);
        this.cdr.markForCheck();
      }
    });
  }

  // â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  showToast(title: string, msg: string, isError = false): void {
    this.toastTitle = title; this.toastMsg = msg; this.toastIsError = isError;
    setTimeout(() => { this.toastMsg = ''; this.toastTitle = ''; this.cdr.markForCheck(); }, 4500);
  }

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
}
