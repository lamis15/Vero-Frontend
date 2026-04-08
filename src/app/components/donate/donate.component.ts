import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DonationService, Donation } from '../../services/donation.service';

@Component({
  selector: 'app-donate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './donate.component.html',
  styleUrl: './donate.component.css'
})
export class DonateComponent implements OnInit {

  @Input() eventId: number | null = null;
  @Input() partnerId: number | null = null;

  selectedAmount: number | null = 20;
  customAmount: number | null = null;
  donateState: 'idle' | 'processing' | 'confirmed' | 'error' = 'idle';

  fullName = '';
  email = '';
  isAnonymous = false;
  errorMessage = '';
  selectedProject = 0;

  projects = [
    {
      emoji: '🌳',
      region: 'Congo Basin, Africa',
      name: 'Restore 10,000 Hectares of Rainforest',
      desc: 'Replanting and protecting one of Earth\'s most biodiverse ecosystems with local communities.',
      raised: '€365,000',
      goal: 'Goal: €500,000',
      pct: 73,
      tags: ['Reforestation', 'Biodiversity', 'Community']
    },
    {
      emoji: '🌊',
      region: 'Pacific Ocean',
      name: 'Ocean Plastic Extraction Initiative',
      desc: 'Autonomous vessels collecting and recycling ocean plastic 24/7, tracked via satellite.',
      raised: '€290,000',
      goal: 'Goal: €500,000',
      pct: 58,
      tags: ['Ocean cleanup', 'Recycling', 'Innovation']
    },
    {
      emoji: '☀️',
      region: 'Sub-Saharan Africa',
      name: 'Solar Microgrids for 200 Villages',
      desc: 'Clean electricity for off-grid communities, cutting diesel dependence by 90%.',
      raised: '€445,000',
      goal: 'Goal: €500,000',
      pct: 89,
      tags: ['Renewable energy', 'Access', 'Impact']
    }
  ];

  donationSteps = [
    { title: 'You donate', desc: 'Choose a project, select an amount, and pay securely via Stripe.' },
    { title: 'Blockchain records it', desc: 'Your transaction is permanently recorded on the Ethereum blockchain.' },
    { title: 'Funds reach the project', desc: 'Smart contracts release funds directly to verified project partners.' },
    { title: 'Track your impact', desc: 'Watch real-time updates as trees grow, plastic is collected, or panels are installed.' }
  ];

  constructor(private donationService: DonationService) {}

  ngOnInit() {}

  selectAmount(amount: number) {
    this.selectedAmount = amount;
    this.customAmount = null;
  }

  getFinalAmount(): number {
    return this.customAmount || this.selectedAmount || 0;
  }

  getImpactText(): string {
    const amount = this.getFinalAmount();
    if (this.selectedProject === 0) {
      const trees = Math.floor(amount / 2);
      return `${trees} tree${trees > 1 ? 's' : ''} planted`;
    } else if (this.selectedProject === 1) {
      const kg = Math.floor(amount * 0.8);
      return `${kg}kg ocean plastic removed`;
    } else {
      const hours = Math.floor(amount * 2);
      return `${hours} hours of clean energy`;
    }
  }

  handleDonate() {
    if (this.donateState !== 'idle') return;

    const amount = this.getFinalAmount();

    if (amount <= 0) {
      this.errorMessage = 'Please select an amount';
      this.autoClearError();
      return;
    }
    if (!this.fullName.trim()) {
      this.errorMessage = 'Please enter your name';
      this.autoClearError();
      return;
    }
    if (!this.email.trim() || !this.isValidEmail(this.email)) {
      this.errorMessage = 'Please enter a valid email';
      this.autoClearError();
      return;
    }

    this.errorMessage = '';
    this.donateState = 'processing';

    const donation: Donation = {
      amount: amount,
      type: 'MONEY',
      message: `Don de ${this.fullName} — ${this.projects[this.selectedProject].name}`,
      anonymous: this.isAnonymous,
      transactionId: `TXN-${Date.now()}`
    };

    const request$ = this.eventId
      ? this.donationService.createDonationForEvent(donation, this.eventId)
      : this.partnerId
        ? this.donationService.createDonationForPartner(donation, this.partnerId)
        : null;

    if (!request$) {
      this.errorMessage = 'No donation target specified';
      this.donateState = 'idle';
      return;
    }

    request$.subscribe({
      next: () => {
        this.donateState = 'confirmed';
        setTimeout(() => {
          this.donateState = 'idle';
          this.resetForm();
        }, 4000);
      },
      error: (err) => {
        this.donateState = 'error';
        this.errorMessage = err.error?.message || 'Donation failed. Please try again.';
        setTimeout(() => { this.donateState = 'idle'; }, 3000);
      }
    });
  }

  autoClearError() {
    setTimeout(() => this.errorMessage = '', 4000);
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  resetForm() {
    this.selectedAmount = 20;
    this.customAmount = null;
    this.fullName = '';
    this.email = '';
    this.isAnonymous = false;
  }
}