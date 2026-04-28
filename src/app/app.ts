import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { NavComponent } from './components/nav/nav.component';
import { FooterComponent } from './components/footer/footer.component';
import { NotificationComponent } from './components/notification/notification.component';
import { AuthService } from './services/auth.service';
import { filter, map, Subscription } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { MessagerieService } from './services/messagerie.service';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent, FooterComponent, NotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private messagerieService = inject(MessagerieService);
  private userService = inject(UserService);
  private callSub?: Subscription;
  private suppressGlobalOfferFromUserId: number | null = null;
  private suppressGlobalOfferUntil = 0;
  incomingGlobalCall: { fromUserId: number; fromName: string; videoEnabled: boolean } | null = null;

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => (event as NavigationEnd).urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  isAdminRoute = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/admin');
  });

  ngOnInit(): void {
    this.auth.restoreSession();
    const cached = this.auth.currentUser;
    if (cached) {
      this.messagerieService.connect(cached.id, cached.role === 'ADMIN');
    }
    this.auth.getMe().subscribe({
      next: (u) => this.messagerieService.connect(u.id, u.role === 'ADMIN'),
      error: () => {}
    });

    this.callSub = this.messagerieService.callSignal$.subscribe((signal) => {
      const myId = Number(this.auth.currentUser?.id ?? 0);
      if (!myId || Number(signal.toUserId) !== myId) return;
      if (signal.type === 'call-offer') {
        const now = Date.now();
        const isSuppressed =
          this.suppressGlobalOfferFromUserId === signal.fromUserId &&
          now < this.suppressGlobalOfferUntil;
        if (isSuppressed) {
          return;
        }
        if (this.router.url.startsWith('/messages')) {
          return;
        }
        this.incomingGlobalCall = {
          fromUserId: signal.fromUserId,
          fromName: `User #${signal.fromUserId}`,
          videoEnabled: !!signal.videoEnabled
        };
        this.userService.getById(signal.fromUserId).subscribe({
          next: (u) => {
            if (this.incomingGlobalCall?.fromUserId === signal.fromUserId) {
              this.incomingGlobalCall.fromName = u.fullName || this.incomingGlobalCall.fromName;
            }
          },
          error: () => {}
        });
        return;
      }
      if (signal.type === 'call-answer' || signal.type === 'call-reject' || signal.type === 'call-end') {
        this.incomingGlobalCall = null;
      }
    });
  }

  acceptGlobalCall(): void {
    if (this.incomingGlobalCall) {
      this.suppressGlobalOfferFromUserId = this.incomingGlobalCall.fromUserId;
      this.suppressGlobalOfferUntil = Date.now() + 20000;
    }
    this.messagerieService.silenceIncomingRing();
    this.incomingGlobalCall = null;
    if (!this.router.url.startsWith('/messages')) {
      void this.router.navigateByUrl('/messages');
    }
  }

  rejectGlobalCall(): void {
    if (!this.incomingGlobalCall) return;
    this.suppressGlobalOfferFromUserId = this.incomingGlobalCall.fromUserId;
    this.suppressGlobalOfferUntil = Date.now() + 20000;
    this.messagerieService.silenceIncomingRing();
    this.messagerieService.sendCallSignal({
      type: 'call-reject',
      toUserId: this.incomingGlobalCall.fromUserId
    });
    this.incomingGlobalCall = null;
  }
}
