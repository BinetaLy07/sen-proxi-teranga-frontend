import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, Observable, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RegisterRequest, SessionInfo, Tokens, UserResponse } from './auth.models';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly directHttp = new HttpClient(inject(HttpBackend));
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly key = 'teranga.session';
  private readonly state = signal<Tokens | null>(this.restore());
  readonly session = this.state.asReadonly();
  private refreshRequest?: Observable<Tokens>;
  login(email: string, motDePasse: string) {
    return this.http
      .post<Tokens>(`${environment.apiUrl}/auth/connexion`, { email, motDePasse })
      .pipe(tap((tokens) => this.store(tokens)));
  }
  register(request: RegisterRequest) {
    return this.http.post<UserResponse>(`${environment.apiUrl}/auth/register`, request);
  }
  refresh(): Observable<Tokens> {
    if (this.refreshRequest) return this.refreshRequest;
    const refreshToken = this.state()?.refreshToken;
    if (!refreshToken) return throwError(() => new Error('Session absente'));
    this.refreshRequest = this.directHttp
      .post<Tokens>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => this.store(tokens)),
        catchError((error) => {
          if (error instanceof HttpErrorResponse && error.status === 401) this.clear();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshRequest = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshRequest;
  }
  sessions() {
    return this.http.get<SessionInfo[]>(`${environment.apiUrl}/auth/sessions`);
  }
  revoke(id: number) {
    return this.http.delete<void>(`${environment.apiUrl}/auth/sessions/${id}`);
  }
  logout(all = false) {
    return this.http
      .post<void>(`${environment.apiUrl}/auth/${all ? 'deconnexion-toutes' : 'deconnexion'}`, {})
      .pipe(finalize(() => this.clear()));
  }
  clear() {
    this.state.set(null);
    if (this.browser) {
      try {
        sessionStorage.removeItem(this.key);
      } catch {
        /* Storage unavailable. */
      }
    }
  }
  private store(tokens: Tokens) {
    this.state.set(tokens);
    if (this.browser) {
      try {
        sessionStorage.setItem(this.key, JSON.stringify(tokens));
      } catch {
        /* Keep session in memory. */
      }
    }
  }
  private restore(): Tokens | null {
    if (!this.browser) return null;
    try {
      const raw = sessionStorage.getItem(this.key);
      if (!raw) return null;
      const tokens = JSON.parse(raw) as Tokens;
      if (
        typeof tokens.accessToken !== 'string' ||
        typeof tokens.refreshToken !== 'string' ||
        !['CLIENT', 'PROFESSIONNEL', 'ADMINISTRATEUR'].includes(tokens.role) ||
        !(Date.parse(tokens.refreshExpiresAt) > Date.now())
      ) {
        sessionStorage.removeItem(this.key);
        return null;
      }
      return tokens;
    } catch {
      return null;
    }
  }
}
