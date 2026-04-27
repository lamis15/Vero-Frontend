import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EventRatingService, RatingResponse, RatingRequest } from '../../services/Event rating.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-event-rating',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
<div class="rating-wrapper">

  <!-- Moyenne globale -->
  <div class="rating-summary" *ngIf="ratings.length > 0">
    <div class="avg-score">{{ averageStars }}</div>
    <div class="avg-stars">
      <span *ngFor="let s of [1,2,3,4,5,6]" class="star-display" [class.filled]="s <= roundedAvg">★</span>
    </div>
    <div class="avg-count">{{ totalRatings }} review{{ totalRatings > 1 ? 's' : '' }}</div>
  </div>

  <!-- Message succès -->
  <div class="already-rated" *ngIf="showThanks">
    <div class="check-icon">✓</div>
    <p>Thank you for sharing your experience! 🌿</p>
  </div>

  <!-- Formulaire -->
  <div class="rating-form-card" *ngIf="canRate && !alreadyRated && !showThanks">
    <h3 class="form-title">Rate this event</h3>
    <p class="form-sub">Share your experience with the community</p>

    <div class="stars-row">
      <button *ngFor="let s of [1,2,3,4,5,6]"
              class="star-btn"
              [class.filled]="s <= (hoverStar || selectedStar)"
              [class.hovered]="s <= hoverStar"
              (mouseenter)="hoverStar = s"
              (mouseleave)="hoverStar = 0"
              (click)="selectedStar = s">★</button>
    </div>
    <p class="star-label">{{ starLabel }}</p>

    <textarea class="comment-input"
              [(ngModel)]="comment"
              rows="3"
              placeholder="Tell others what you thought about this event…"
              maxlength="500"></textarea>
    <div class="char-count">{{ comment.length }}/500</div>

    <!-- SHARE YOUR MOMENT -->
    <div class="moment-section">
      <div class="moment-label">
        <span class="moment-icon">📸</span>
        <span>Share your moment <em>(optional)</em></span>
      </div>
      <div class="moment-upload-zone" [class.has-image]="momentPreview" (click)="momentInput.click()">
        <input #momentInput type="file" accept="image/*"
               style="display:none" (change)="onMomentSelected($event)" />
        <ng-container *ngIf="!momentPreview">
          <div class="upload-placeholder">
            <div class="upload-ph-icon">🖼️</div>
            <div class="upload-ph-text">Click to add a photo</div>
            <div class="upload-ph-sub">PNG, JPG, WEBP · max 10MB</div>
          </div>
        </ng-container>
        <ng-container *ngIf="momentPreview">
          <img [src]="momentPreview" class="moment-preview-img" alt="preview" />
          <button class="moment-remove-btn" (click)="removeMoment($event)">✕</button>
          <div class="moment-overlay-label">Click to change</div>
        </ng-container>
      </div>
      <div class="moment-uploading" *ngIf="uploadingMoment">
        <div class="moment-upload-spinner"></div>
        <span>Uploading photo…</span>
      </div>
    </div>

    <button class="btn-submit"
            [disabled]="selectedStar === 0 || submitting || uploadingMoment"
            (click)="submit()">
      <span *ngIf="!submitting">Submit Review</span>
      <span *ngIf="submitting">Submitting…</span>
    </button>
    <p class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</p>
  </div>

  <!-- Liste reviews -->
  <div class="reviews-section" *ngIf="ratings.length > 0">
    <h4 class="reviews-title">
      Community Reviews
      <span class="live-badge">● LIVE</span>
    </h4>
    <div class="review-card" *ngFor="let r of ratings; trackBy: trackById"
         [class.new-rating]="r.id === latestRatingId">
      <div class="review-header">
        <div class="reviewer-avatar">{{ r.userName.charAt(0).toUpperCase() }}</div>
        <div class="reviewer-info">
          <span class="reviewer-name">{{ r.userName }}</span>
          <div class="review-stars">
            <span *ngFor="let s of [1,2,3,4,5,6]" class="star-sm" [class.filled]="s <= r.stars">★</span>
          </div>
        </div>
        <span class="review-date">{{ r.ratedAt | date:'MMM d, y' }}</span>
      </div>
      <p class="review-comment" *ngIf="r.comment">{{ r.comment }}</p>
      <div class="review-moment" *ngIf="r.imageUrl">
        <img [src]="resolveImageUrl(r.imageUrl)"
             class="review-moment-img"
             alt="Event moment"
             (click)="openLightbox(resolveImageUrl(r.imageUrl))" />
        <div class="review-moment-caption">📸 Shared moment</div>
      </div>
    </div>
  </div>

  <div class="empty-reviews" *ngIf="ratings.length === 0 && !canRate">
    <p>👉 You can't leave a review since you canceled your reservation!</p>
  </div>

</div>

<!-- Lightbox -->
<div class="lightbox-overlay" *ngIf="lightboxUrl" (click)="closeLightbox()">
  <div class="lightbox-box" (click)="$event.stopPropagation()">
    <button class="lightbox-close" (click)="closeLightbox()">✕</button>
    <img [src]="lightboxUrl" class="lightbox-img" alt="moment" />
  </div>
</div>
  `,
  styles: [`
    .rating-wrapper { font-family: 'Outfit', sans-serif; max-width: 580px; }
    .rating-summary {
      display: flex; align-items: center; gap: 14px;
      background: #f2efe8; border: 1.5px solid rgba(30,107,69,.13);
      border-radius: 16px; padding: 16px 20px; margin-bottom: 20px;
    }
    .avg-score { font-size: 36px; font-weight: 900; color: #1e6b45; line-height: 1; }
    .avg-stars { display: flex; gap: 3px; }
    .star-display { font-size: 18px; color: #ddd; }
    .star-display.filled { color: #f4b400; }
    .avg-count { font-size: 12px; color: #8aaa96; font-weight: 600; }
    .rating-form-card {
      background: #f2efe8; border: 1.5px solid rgba(30,107,69,.13);
      border-radius: 20px; padding: 24px; margin-bottom: 24px;
    }
    .form-title { font-size: 17px; font-weight: 800; color: #141f1a; margin-bottom: 4px; }
    .form-sub   { font-size: 13px; color: #4a6357; margin-bottom: 18px; }
    .stars-row { display: flex; gap: 6px; margin-bottom: 8px; }
    .star-btn {
      background: none; border: none; font-size: 32px;
      color: #ddd; cursor: pointer; transition: color .15s, transform .15s; line-height: 1; padding: 0;
    }
    .star-btn.filled  { color: #f4b400; }
    .star-btn.hovered { transform: scale(1.2); }
    .star-btn:hover   { color: #f4b400; }
    .star-label { font-size: 12px; font-weight: 700; color: #1e6b45; min-height: 18px; margin-bottom: 14px; }
    .comment-input {
      width: 100%; padding: 12px 14px;
      background: #ece9e1; border: 1.5px solid rgba(30,107,69,.13);
      border-radius: 12px; color: #141f1a;
      font-family: 'Outfit', sans-serif; font-size: 13px;
      outline: none; resize: vertical; transition: border-color .2s;
    }
    .comment-input:focus { border-color: #2d8f5c; }
    .char-count { font-size: 11px; color: #8aaa96; text-align: right; margin-top: 4px; margin-bottom: 16px; }
    .moment-section { margin-bottom: 18px; }
    .moment-label {
      display: flex; align-items: center; gap: 7px;
      font-size: 13px; font-weight: 700; color: #4a6357; margin-bottom: 10px;
    }
    .moment-label em { font-style: normal; font-weight: 400; color: #8aaa96; }
    .moment-icon { font-size: 16px; }
    .moment-upload-zone {
      position: relative; border: 2px dashed rgba(30,107,69,.25);
      border-radius: 14px; overflow: hidden; cursor: pointer;
      transition: border-color .2s, background .2s;
      min-height: 110px; display: flex; align-items: center; justify-content: center;
      background: #ece9e1;
    }
    .moment-upload-zone:hover { border-color: #2d8f5c; background: #e6ede9; }
    .moment-upload-zone.has-image { border-style: solid; border-color: rgba(30,107,69,.3); }
    .upload-placeholder { text-align: center; padding: 20px; }
    .upload-ph-icon  { font-size: 28px; margin-bottom: 6px; }
    .upload-ph-text  { font-size: 13px; font-weight: 700; color: #4a6357; margin-bottom: 3px; }
    .upload-ph-sub   { font-size: 11px; color: #8aaa96; }
    .moment-preview-img { width: 100%; height: 180px; object-fit: cover; display: block; }
    .moment-remove-btn {
      position: absolute; top: 8px; right: 8px;
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(0,0,0,.6); color: #fff; border: none;
      cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center;
      transition: background .2s; z-index: 2;
    }
    .moment-remove-btn:hover { background: #c0392b; }
    .moment-overlay-label {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: rgba(0,0,0,.4); color: #fff;
      text-align: center; font-size: 11px; font-weight: 600;
      padding: 6px; pointer-events: none;
    }
    .moment-uploading {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #4a6357; margin-top: 8px;
    }
    .moment-upload-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(30,107,69,.2); border-top-color: #1e6b45;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-submit {
      width: 100%; padding: 13px; background: #1e6b45; color: #fff;
      border: none; border-radius: 12px;
      font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700;
      cursor: pointer; transition: all .2s;
    }
    .btn-submit:hover:not(:disabled) { background: #2d8f5c; }
    .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
    .error-msg { font-size: 12px; color: #c0392b; margin-top: 8px; }
    .already-rated {
      display: flex; align-items: center; gap: 12px;
      background: #d6eedd; border: 1.5px solid rgba(30,107,69,.25);
      border-radius: 14px; padding: 14px 18px;
      color: #1e6b45; font-weight: 600; font-size: 14px;
      margin-bottom: 20px; animation: fadeInOut 3s ease forwards;
    }
    @keyframes fadeInOut {
      0%{opacity:0;transform:translateY(-6px)} 15%{opacity:1;transform:translateY(0)}
      70%{opacity:1} 100%{opacity:0;transform:translateY(-4px)}
    }
    .check-icon {
      width: 28px; height: 28px; border-radius: 50%; background: #1e6b45; color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
    }
    .reviews-section { margin-top: 8px; }
    .reviews-title {
      font-size: 15px; font-weight: 800; color: #141f1a; margin-bottom: 14px;
      display: flex; align-items: center; gap: 8px;
    }
    .live-badge { font-size: 10px; font-weight: 700; color: #c0392b; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .review-card {
      background: #f2efe8; border: 1.5px solid rgba(30,107,69,.1);
      border-radius: 14px; padding: 16px; margin-bottom: 12px; transition: all .3s;
    }
    .review-card.new-rating { animation: highlight .8s ease; }
    @keyframes highlight {
      0%{background:#d6eedd;border-color:#1e6b45} 100%{background:#f2efe8;border-color:rgba(30,107,69,.1)}
    }
    .review-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .reviewer-avatar {
      width: 36px; height: 36px; border-radius: 50%; background: #1e6b45; color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;
    }
    .reviewer-info { flex: 1; }
    .reviewer-name { font-size: 13px; font-weight: 700; color: #141f1a; display: block; }
    .review-stars  { display: flex; gap: 2px; margin-top: 2px; }
    .star-sm { font-size: 13px; color: #ddd; }
    .star-sm.filled { color: #f4b400; }
    .review-date { font-size: 11px; color: #8aaa96; white-space: nowrap; }
    .review-comment { font-size: 13px; color: #4a6357; line-height: 1.6; margin: 0 0 10px; }
    .review-moment { margin-top: 10px; border-radius: 12px; overflow: hidden; position: relative; }
    .review-moment-img {
      width: 100%; max-height: 220px; object-fit: cover; display: block;
      border-radius: 12px; cursor: zoom-in; transition: transform .3s;
    }
    .review-moment-img:hover { transform: scale(1.02); }
    .review-moment-caption { font-size: 11px; color: #8aaa96; margin-top: 5px; font-style: italic; }
    .lightbox-overlay {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(0,0,0,.85); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    .lightbox-box { position: relative; max-width: 90vw; max-height: 90vh; }
    .lightbox-img {
      max-width: 100%; max-height: 85vh; border-radius: 16px;
      box-shadow: 0 30px 80px rgba(0,0,0,.5); display: block;
    }
    .lightbox-close {
      position: absolute; top: -14px; right: -14px;
      width: 34px; height: 34px; border-radius: 50%;
      background: #fff; border: none; cursor: pointer;
      font-size: 16px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,.25); transition: background .2s;
    }
    .lightbox-close:hover { background: #f2efe8; }
    .empty-reviews { text-align: center; padding: 20px; color: #8aaa96; font-size: 13px; }
  `]
})
export class EventRatingComponent implements OnInit, OnDestroy {

  @Input() eventId!: number;
  @Input() canRate = false;

  ratings:        RatingResponse[] = [];
  averageStars    = 0;
  roundedAvg      = 0;
  totalRatings    = 0;
  latestRatingId: number | null = null;

  selectedStar    = 0;
  hoverStar       = 0;
  comment         = '';
  submitting      = false;
  alreadyRated    = false;
  showThanks      = false;
  errorMsg        = '';

  momentFile:      File | null = null;
  momentPreview    = '';
  momentImageUrl   = '';
  uploadingMoment  = false;
  lightboxUrl      = '';

  private sub?: Subscription;

  readonly starLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent', 'Outstanding!'];
  get starLabel(): string { return this.starLabels[this.hoverStar || this.selectedStar] || ''; }

  constructor(
    private ratingService: EventRatingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // ✅ Charger les ratings existants depuis la BDD
    this.loadRatings();

    if (this.canRate) {
      this.ratingService.hasRated(this.eventId).subscribe({
        next: (has: boolean) => { this.alreadyRated = has; this.cdr.markForCheck(); }
      });
    }

    // ✅ WebSocket pour les nouveaux ratings en temps réel
    this.sub = this.ratingService.subscribeToRatings(this.eventId).subscribe({
      next: (newRating: RatingResponse) => {
        const idx = this.ratings.findIndex(r => r.id === newRating.id);
        if (idx >= 0) { this.ratings[idx] = newRating; }
        else          { this.ratings = [newRating, ...this.ratings]; }
        this.latestRatingId = newRating.id;
        this.averageStars   = newRating.averageStars;
        this.roundedAvg     = Math.round(newRating.averageStars);
        this.totalRatings   = newRating.totalRatings;
        setTimeout(() => { this.latestRatingId = null; this.cdr.markForCheck(); }, 1000);
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ✅ Méthode séparée pour recharger les ratings
  private loadRatings(): void {
    this.ratingService.getRatings(this.eventId).subscribe({
      next: (ratings: RatingResponse[]) => {
        this.ratings = ratings;
        this.updateStats();
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  onMomentSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.momentFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => { this.momentPreview = e.target.result; this.cdr.markForCheck(); };
    reader.readAsDataURL(file);
    this.uploadingMoment = true;
    this.ratingService.uploadRatingImage(file).subscribe({
      next: (res: { url: string }) => {
        this.momentImageUrl  = res.url;
        this.uploadingMoment = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.uploadingMoment = false;
        this.errorMsg = 'Image upload failed. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  removeMoment(e: MouseEvent): void {
    e.stopPropagation();
    this.momentFile     = null;
    this.momentPreview  = '';
    this.momentImageUrl = '';
    this.cdr.markForCheck();
  }

  submit(): void {
    if (this.selectedStar === 0 || this.submitting || this.uploadingMoment) return;
    this.submitting = true;
    this.errorMsg   = '';

    const req: RatingRequest = {
      stars:    this.selectedStar,
      comment:  this.comment.trim(),
      imageUrl: this.momentImageUrl || undefined
    };

    this.ratingService.submitRating(this.eventId, req).subscribe({
      next: (saved: RatingResponse) => {
        this.submitting   = false;
        this.alreadyRated = true;
        this.showThanks   = true;

        // ✅ Injecter directement le rating retourné dans la liste
        const idx = this.ratings.findIndex(r => r.id === saved.id);
        if (idx >= 0) { this.ratings[idx] = saved; }
        else          { this.ratings = [saved, ...this.ratings]; }
        this.updateStats();

        setTimeout(() => { this.showThanks = false; this.cdr.markForCheck(); }, 3000);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.submitting = false;
        this.errorMsg   = err.error?.message || 'Failed to submit review.';
        this.cdr.markForCheck();
      }
    });
  }

  openLightbox(url: string): void { this.lightboxUrl = url; }
  closeLightbox(): void            { this.lightboxUrl = ''; }

  resolveImageUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
  }

  private updateStats(): void {
    if (this.ratings.length > 0) {
      this.averageStars = this.ratings[0].averageStars;
      this.roundedAvg   = Math.round(this.averageStars);
      this.totalRatings = this.ratings[0].totalRatings;
    }
  }

  trackById(_: number, r: RatingResponse): number { return r.id; }
}