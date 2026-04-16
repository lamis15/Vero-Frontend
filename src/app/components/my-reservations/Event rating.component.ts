import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EventRatingService, RatingResponse } from '../../services/Event rating.service';

@Component({
  selector: 'app-event-rating',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  <!-- Message succès temporaire -->
  <div class="already-rated" *ngIf="showThanks">
    <div class="check-icon">✓</div>
    <p>You've already reviewed this event. Thank you!</p>
  </div>

  <!-- Formulaire (visible si pas encore noté ET message pas affiché) -->
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

    <button class="btn-submit" [disabled]="selectedStar === 0 || submitting" (click)="submit()">
      <span *ngIf="!submitting">Submit Review</span>
      <span *ngIf="submitting">Submitting…</span>
    </button>

    <p class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</p>
  </div>

  <!-- Liste reviews en temps réel -->
  <div class="reviews-section" *ngIf="ratings.length > 0">
    <h4 class="reviews-title">Community Reviews
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
    </div>
  </div>

  <div class="empty-reviews" *ngIf="ratings.length === 0 && !canRate">
    <p>👉 You can’t leave a review since you canceled your reservation !</p>
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
      color: #ddd; cursor: pointer;
      transition: color .15s, transform .15s;
      line-height: 1; padding: 0;
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
    .char-count { font-size: 11px; color: #8aaa96; text-align: right; margin-top: 4px; margin-bottom: 14px; }

    .btn-submit {
      width: 100%; padding: 13px;
      background: #1e6b45; color: #fff;
      border: none; border-radius: 12px;
      font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700;
      cursor: pointer; transition: all .2s;
    }
    .btn-submit:hover:not(:disabled) { background: #2d8f5c; }
    .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
    .error-msg { font-size: 12px; color: #c0392b; margin-top: 8px; }

    /* Message succès — avec animation fade out */
    .already-rated {
      display: flex; align-items: center; gap: 12px;
      background: #d6eedd; border: 1.5px solid rgba(30,107,69,.25);
      border-radius: 14px; padding: 14px 18px;
      color: #1e6b45; font-weight: 600; font-size: 14px;
      margin-bottom: 20px;
      animation: fadeInOut 3s ease forwards;
    }
    @keyframes fadeInOut {
      0%   { opacity: 0; transform: translateY(-6px); }
      15%  { opacity: 1; transform: translateY(0); }
      70%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-4px); }
    }
    .check-icon {
      width: 28px; height: 28px; border-radius: 50%;
      background: #1e6b45; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    }

    .reviews-section { margin-top: 8px; }
    .reviews-title {
      font-size: 15px; font-weight: 800; color: #141f1a;
      margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
    }
    .live-badge { font-size: 10px; font-weight: 700; color: #c0392b; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    .review-card {
      background: #f2efe8; border: 1.5px solid rgba(30,107,69,.1);
      border-radius: 14px; padding: 16px; margin-bottom: 12px; transition: all .3s;
    }
    .review-card.new-rating { animation: highlight .8s ease; }
    @keyframes highlight {
      0%   { background: #d6eedd; border-color: #1e6b45; }
      100% { background: #f2efe8; border-color: rgba(30,107,69,.1); }
    }

    .review-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .reviewer-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #1e6b45; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; flex-shrink: 0;
    }
    .reviewer-info { flex: 1; }
    .reviewer-name { font-size: 13px; font-weight: 700; color: #141f1a; display: block; }
    .review-stars  { display: flex; gap: 2px; margin-top: 2px; }
    .star-sm { font-size: 13px; color: #ddd; }
    .star-sm.filled { color: #f4b400; }
    .review-date { font-size: 11px; color: #8aaa96; white-space: nowrap; }
    .review-comment { font-size: 13px; color: #4a6357; line-height: 1.6; margin: 0; }
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

  selectedStar = 0;
  hoverStar    = 0;
  comment      = '';
  submitting   = false;
  alreadyRated = false;  // déjà noté depuis le serveur (chargement initial)
  showThanks   = false;  // affichage temporaire du message après submit

  errorMsg = '';

  private sub?: Subscription;

  readonly starLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent', 'Outstanding!'];
  get starLabel(): string { return this.starLabels[this.hoverStar || this.selectedStar] || ''; }

  constructor(
    private ratingService: EventRatingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.ratingService.getRatings(this.eventId).subscribe({
      next: (ratings: RatingResponse[]) => {
        this.ratings = ratings;
        this.updateStats();
        this.cdr.markForCheck();
      }
    });

    if (this.canRate) {
      this.ratingService.hasRated(this.eventId).subscribe({
        next: (has: boolean) => {
          this.alreadyRated = has;
          this.cdr.markForCheck();
        }
      });
    }

    this.sub = this.ratingService.subscribeToRatings(this.eventId).subscribe({
      next: (newRating: RatingResponse) => {
        const idx = this.ratings.findIndex(r => r.id === newRating.id);
        if (idx >= 0) {
          this.ratings[idx] = newRating;
        } else {
          this.ratings = [newRating, ...this.ratings];
        }
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

  submit(): void {
    if (this.selectedStar === 0 || this.submitting) return;
    this.submitting = true;
    this.errorMsg   = '';

    this.ratingService.submitRating(this.eventId, {
      stars:   this.selectedStar,
      comment: this.comment.trim()
    }).subscribe({
      next: () => {
        this.submitting  = false;
        this.alreadyRated = true;

        // Afficher le message de remerciement 3 secondes puis le masquer
        this.showThanks = true;
        setTimeout(() => {
          this.showThanks = false;
          this.cdr.markForCheck();
        }, 3000);

        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.submitting = false;
        this.errorMsg   = err.error?.message || 'Failed to submit review.';
        this.cdr.markForCheck();
      }
    });
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