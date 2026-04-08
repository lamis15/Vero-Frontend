import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'alert';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts: Toast[] = [];
  toastState$ = new Subject<Toast[]>();
  private idCounter = 0;

  show(title: string, message: string, type: 'info'|'success'|'alert' = 'info', duration = 4000) {
    const toast: Toast = { id: ++this.idCounter, title, message, type, duration };
    this.toasts.push(toast);
    this.toastState$.next([...this.toasts]);

    this.playChime();

    if (duration > 0) {
      setTimeout(() => this.remove(toast.id), duration);
    }
  }

  remove(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.toastState$.next([...this.toasts]);
  }

  // Generate a premium sci-fi/glass ping using native Web Audio (No asset downloading needed)
  private playChime() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);     // High pitch (A5)
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // Slide up

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.02); // Quick fade in
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); // Long elegant fade out

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      // AudioCtx might be blocked before first user interaction
    }
  }
}
