import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { Tokens } from './auth.models';

const tokens: Tokens = {
  accessToken: 'access-one',
  refreshToken: 'refresh-one',
  tokenType: 'Bearer',
  accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  utilisateurId: 10,
  role: 'CLIENT',
};
describe('Authentication and refresh', () => {
  let auth: AuthService;
  let http: HttpClient;
  let requests: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    requests.verify();
    sessionStorage.clear();
  });
  function login() {
    auth.login('awa@example.com', 'password').subscribe();
    requests.expectOne('/api/auth/connexion').flush(tokens);
  }
  it('stores tokens without storing the password', () => {
    login();
    expect(auth.session()?.accessToken).toBe('access-one');
    expect(sessionStorage.getItem('teranga.session')).not.toContain('password');
  });
  it('shares one refresh between concurrent 401 responses and retries with new tokens', () => {
    login();
    let completed = 0;
    http.get('/api/one').subscribe(() => completed++);
    http.get('/api/two').subscribe(() => completed++);
    const first = requests.expectOne('/api/one');
    const second = requests.expectOne('/api/two');
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-one');
    first.flush({}, { status: 401, statusText: 'Unauthorized' });
    second.flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = requests.expectOne('/api/auth/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-one' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush({ ...tokens, accessToken: 'access-two', refreshToken: 'refresh-two' });
    for (const path of ['/api/one', '/api/two']) {
      const retry = requests.expectOne(path);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-two');
      retry.flush({});
    }
    expect(completed).toBe(2);
    expect(auth.session()?.refreshToken).toBe('refresh-two');
  });
  it('does not send tokens outside the API or to public registration', () => {
    login();
    http.get('https://example.com/data').subscribe();
    auth
      .register({
        prenom: 'Awa',
        nom: 'Diop',
        email: 'awa@example.com',
        telephone: '771234567',
        motDePasse: 'password',
        cguAcceptees: true,
        role: 'CLIENT',
      })
      .subscribe();
    for (const url of ['https://example.com/data', '/api/auth/register']) {
      const r = requests.expectOne(url);
      expect(r.request.headers.has('Authorization')).toBe(false);
      r.flush({});
    }
  });
  it('clears the session when the refresh token is rejected', () => {
    login();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.get('/api/auth/sessions').subscribe({ error: () => {} });
    requests.expectOne('/api/auth/sessions').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem('teranga.session')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/connexion']);
  });
  it('clears the local session on logout even if the network fails', () => {
    login();
    auth.logout().subscribe({ error: () => {} });
    requests.expectOne('/api/auth/deconnexion').error(new ProgressEvent('error'));
    expect(auth.session()).toBeNull();
  });
});
