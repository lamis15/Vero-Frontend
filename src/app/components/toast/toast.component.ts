import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (t of toasts; track t.id) {
        <div class="toast-card" [class]="'toast-' + t.type">
          <div class="toast-icon">
            @if (t.type === 'info') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            } @else if (t.type === 'success') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            }
          </div>
          <div class="toast-content">
            <strong>{{ t.title }}</strong>
            <p>{{ t.message }}</p>
          </div>
          <button class="toast-close" (click)="dismiss(t.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 40px;
      right: 40px;
      width: 380px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 16px;
      pointer-events: none;
    }
    .toast-card {
      pointer-events: auto;
      background: rgba(26, 46, 26, 0.95);
      border: 1px solid rgba(245, 240, 232, 0.08);
      backdrop-filter: blur(12px);
      box-shadow: 0 16px 40px rgba(0,0,0,0.4);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
      color: var(--cream, #f5f0e8);
      font-family: 'DM Sans', sans-serif;
      animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom center;
    }
    @keyframes slideIn {
      0% { opacity: 0; transform: translateY(40px) scale(0.95); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .toast-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .toast-icon svg { width: 22px; height: 22px; }
    .toast-info .toast-icon { color: var(--fern, #6aaa6a); }
    .toast-success .toast-icon { color: var(--gold, #d4a843); }
    .toast-alert .toast-icon { color: #e57373; }

    .toast-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .toast-content strong {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .toast-content p {
      font-size: 13px;
      opacity: 0.8;
      margin: 0;
      line-height: 1.4;
    }
    .toast-close {
      background: transparent;
      border: none;
      color: var(--cream, #f5f0e8);
      opacity: 0.5;
      cursor: pointer;
      padding: 4px;
      transition: opacity 0.2s;
    }
    .toast-close:hover { opacity: 1; }
    .toast-close svg { width: 16px; height: 16px; }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub!: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.sub = this.toastService.toastState$.subscribe(t => {
      this.toasts = t;
    });
  }

  dismiss(id: number) {
    this.toastService.remove(id);
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }
}
