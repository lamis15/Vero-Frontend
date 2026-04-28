import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DonationService } from '../../services/donation.service';

@Component({
  selector: 'app-donate-success',
  standalone: true,
  imports: [],
  styles: [`
    :host { display: block; }

    .success-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      font-family: 'DM Sans', sans-serif;
      background:
        radial-gradient(circle at 80% 12%, rgba(20,199,165,.18), transparent 30%),
        radial-gradient(circle at 14% 80%, rgba(237,218,157,.08), transparent 24%),
        linear-gradient(135deg, #050B14, #0A2B33 52%, #0E4C49);
      position: relative;
      overflow: hidden;
    }

    .success-page::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(circle, rgba(20,199,165,.08) 1px, transparent 1px);
      background-size: 34px 34px;
      opacity: .35;
      pointer-events: none;
      animation: gridMove 20s linear infinite;
    }

    .success-card {
      position: relative;
      z-index: 2;
      width: min(480px, 100%);
      padding: 52px 44px;
      border-radius: 32px;
      background: linear-gradient(145deg, rgba(255,255,255,.1), rgba(255,255,255,.03));
      border: 1px solid rgba(20,199,165,.28);
      backdrop-filter: blur(24px) saturate(150%);
      box-shadow:
        0 40px 100px rgba(0,0,0,.5),
        0 0 60px rgba(20,199,165,.10),
        inset 0 1px rgba(255,255,255,.1);
      text-align: center;
      animation: cardIn .7s cubic-bezier(.16,1,.3,1) both;
    }

    /* ─── Loading ─── */
    .loading-ring {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 3px solid rgba(20,199,165,.2);
      border-top-color: #14C7A5;
      animation: spin .8s linear infinite;
      margin: 0 auto 24px;
    }

    .loading-text {
      color: rgba(255,255,255,.62);
      font-size: 15px;
      letter-spacing: .02em;
    }

    /* ─── Success ─── */
    .check-ring {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      margin: 0 auto 28px;
      display: grid;
      place-items: center;
      background: rgba(20,199,165,.15);
      border: 2px solid rgba(20,199,165,.5);
      box-shadow: 0 0 48px rgba(20,199,165,.3);
      animation: popIn .6s cubic-bezier(.16,1,.3,1) .1s both;
      position: relative;
    }

    .check-ring::after {
      content: '';
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      border: 1.5px solid rgba(20,199,165,.2);
      animation: pingRing 2.2s ease infinite;
    }

    .check-icon {
      color: #14C7A5;
      font-size: 36px;
      line-height: 1;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(20,199,165,.12);
      border: 1.5px solid rgba(20,199,165,.35);
      color: #14C7A5;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .16em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    .eyebrow-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #14C7A5;
      box-shadow: 0 0 10px rgba(20,199,165,.8);
    }

    .success-title {
      margin: 0 0 12px;
      color: #fff;
      font-family: 'Playfair Display', serif;
      font-size: 34px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -.5px;
    }

    .success-sub {
      margin: 0 0 32px;
      color: rgba(255,255,255,.60);
      font-size: 15px;
      line-height: 1.65;
    }

    .impact-strip {
      display: flex;
      justify-content: center;
      gap: 0;
      margin-bottom: 36px;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.04);
    }

    .impact-item {
      flex: 1;
      padding: 16px 12px;
      text-align: center;
      border-right: 1px solid rgba(255,255,255,.08);
    }

    .impact-item:last-child { border-right: none; }

    .impact-num {
      display: block;
      font-size: 22px;
      font-weight: 900;
      color: #14C7A5;
      font-family: 'Playfair Display', serif;
      line-height: 1;
      margin-bottom: 4px;
    }

    .impact-lbl {
      display: block;
      font-size: 10px;
      color: rgba(255,255,255,.45);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .12em;
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 16px 32px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      font-weight: 800;
      background: #14C7A5;
      color: #011a14;
      transition: transform .2s ease, box-shadow .2s ease;
    }

    .btn-back:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 36px rgba(20,199,165,.45);
    }

    /* ─── Error ─── */
    .error-ring {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      margin: 0 auto 28px;
      display: grid;
      place-items: center;
      background: rgba(248,113,113,.1);
      border: 2px solid rgba(248,113,113,.4);
      box-shadow: 0 0 48px rgba(248,113,113,.2);
      animation: popIn .6s cubic-bezier(.16,1,.3,1) .1s both;
    }

    .error-icon {
      color: #f87171;
      font-size: 36px;
      line-height: 1;
    }

    .error-title {
      margin: 0 0 12px;
      color: #fff;
      font-family: 'Playfair Display', serif;
      font-size: 30px;
      font-weight: 800;
    }

    .error-sub {
      margin: 0 0 32px;
      color: rgba(255,255,255,.55);
      font-size: 15px;
      line-height: 1.6;
    }

    .btn-retry {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 16px 32px;
      border-radius: 999px;
      border: 1.5px solid rgba(248,113,113,.45);
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      font-weight: 800;
      background: rgba(248,113,113,.12);
      color: #f87171;
      transition: all .2s ease;
    }

    .btn-retry:hover {
      background: rgba(248,113,113,.2);
      transform: translateY(-2px);
    }

    /* ─── Particles ─── */
    .particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .particle {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      animation: particleFall linear infinite;
    }

    @keyframes gridMove {
      from { background-position: 0 0; }
      to { background-position: 34px 34px; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(28px) scale(.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(.6); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes pingRing {
      0% { transform: scale(1); opacity: .6; }
      60% { transform: scale(1.5); opacity: 0; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    @keyframes particleFall {
      0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
  `],
  template: `
    <div class="success-page">

      @if (!loading && success) {
        <div class="particles">
          @for (p of particles; track $index) {
            <div class="particle"
                 [style.left]="p.x"
                 [style.top]="p.startY"
                 [style.background]="p.color"
                 [style.animation-duration]="p.duration"
                 [style.animation-delay]="p.delay"
                 [style.width]="p.size"
                 [style.height]="p.size">
            </div>
          }
        </div>
      }

      <div class="success-card">

        @if (loading) {
          <div class="loading-ring"></div>
          <p class="loading-text">Verifying your payment...</p>
        } @else if (success) {
          <div class="check-ring">
            <span class="check-icon">✓</span>
          </div>

          <div class="eyebrow">
            <span class="eyebrow-dot"></span>
            Payment confirmed
          </div>

          <h2 class="success-title">Thank you for your<br>contribution!</h2>
          <p class="success-sub">
            Your donation has been recorded and will directly<br>
            support environmental initiatives in Tunisia.
          </p>

          <div class="impact-strip">
            <div class="impact-item">
              <span class="impact-num">🌱</span>
              <span class="impact-lbl">Impact</span>
            </div>
            <div class="impact-item">
              <span class="impact-num">✓</span>
              <span class="impact-lbl">Verified</span>
            </div>
            <div class="impact-item">
              <span class="impact-num">💚</span>
              <span class="impact-lbl">Thank you</span>
            </div>
          </div>

          <button class="btn-back" (click)="router.navigate(['/donate'])">
            ← Back to donations
          </button>
        } @else {
          <div class="error-ring">
            <span class="error-icon">✕</span>
          </div>
          <h2 class="error-title">Payment not confirmed</h2>
          <p class="error-sub">
            We couldn't verify your payment.<br>
            Please try again or contact support.
          </p>
          <button class="btn-retry" (click)="router.navigate(['/donate'])">
            ← Try again
          </button>
        }

      </div>
    </div>
  `
})
export class DonateSuccessComponent implements OnInit {
  loading = true;
  success = false;

  particles: Array<{
    x: string; startY: string; color: string;
    duration: string; delay: string; size: string;
  }> = [];

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private donationService: DonationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const sessionId = this.route.snapshot.queryParams['session_id'];
    const donationId = this.route.snapshot.queryParams['donationId'];

    if (sessionId && donationId) {
      this.donationService.verifyStripePayment(sessionId, +donationId)
        .subscribe({
          next: (res) => {
            this.loading = false;
            this.success = res.status === 'paid' || res.status === 'complete';
            if (this.success) this.buildParticles();
            this.cdr.detectChanges();
          },
          error: () => {
            this.loading = false;
            this.success = false;
            this.cdr.detectChanges();
          }
        });
    } else {
      this.loading = false;
      this.success = false;
      this.cdr.detectChanges();
    }
  }

  private buildParticles(): void {
    const colors = ['#14C7A5', '#EDDA9D', '#3b9ab2', '#fff', '#7dd3c0'];
    this.particles = Array.from({ length: 28 }, () => ({
      x: `${Math.random() * 100}%`,
      startY: `${-10 - Math.random() * 20}px`,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: `${3 + Math.random() * 4}s`,
      delay: `${Math.random() * 3}s`,
      size: `${4 + Math.random() * 6}px`,
    }));
  }
}
