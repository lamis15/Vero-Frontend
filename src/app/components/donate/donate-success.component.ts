import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DonationService } from '../../services/donation.service';

@Component({
  selector: 'app-donate-success',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="text-align:center;padding:80px 24px;background:#f5f0e8;min-height:100vh">
      <div *ngIf="loading">⏳ Verifying payment...</div>
      <div *ngIf="!loading && success">
        <div style="font-size:64px">🎉</div>
        <h2 style="color:#1a2e1a">Payment confirmed!</h2>
        <p style="color:#8a8a7a">Your donation has been recorded.</p>
        <button (click)="router.navigate(['/donate'])"
                style="background:#1a2e1a;color:#fff;padding:14px 32px;
                       border-radius:100px;border:none;cursor:pointer;
                       font-size:15px;margin-top:24px">
          Back to donations →
        </button>
      </div>
      <div *ngIf="!loading && !success">
        <div style="font-size:64px">❌</div>
        <h2 style="color:#c62828">Payment not confirmed</h2>
        <button (click)="router.navigate(['/donate'])"
                style="background:#c62828;color:#fff;padding:14px 32px;
                       border-radius:100px;border:none;cursor:pointer;
                       font-size:15px;margin-top:24px">
          Try again →
        </button>
      </div>
    </div>
  `
})
export class DonateSuccessComponent implements OnInit {
  loading = true;
  success = false;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private donationService: DonationService
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
          },
          error: () => {
            this.loading = false;
            this.success = false;
          }
        });
    } else {
      this.loading = false;
      this.success = false;
    }
  }
}
