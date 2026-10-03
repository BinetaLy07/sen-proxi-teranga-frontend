import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SessionInfo } from '../../core/auth/auth.models';
import { apiError } from '../../core/http/api-error';
@Component({ imports: [DatePipe], templateUrl: './account.html' })
export class Account {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly sessions = signal<SessionInfo[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  constructor() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.auth.sessions().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }
  revoke(session: SessionInfo) {
    this.auth.revoke(session.id).subscribe({
      next: () => {
        if (session.current) {
          this.auth.clear();
          void this.router.navigate(['/connexion']);
        } else this.load();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }
  logout(all = false) {
    this.auth.logout(all).subscribe({
      next: () => {
        void this.router.navigate(['/connexion']);
      },
      error: () => {
        void this.router.navigate(['/connexion']);
      },
    });
  }
}
