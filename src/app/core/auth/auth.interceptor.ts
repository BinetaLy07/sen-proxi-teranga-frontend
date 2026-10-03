import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApi = request.url.startsWith(environment.apiUrl + '/');
  const publicEndpoint = /\/auth\/(connexion|register|refresh|inscription)(\/|$)/.test(request.url);
  if (!isApi || publicEndpoint) return next(request);
  const token = auth.session()?.accessToken;
  const authorized = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authorized).pipe(
    catchError((error) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.session())
        return throwError(() => error);
      return auth.refresh().pipe(
        switchMap((tokens) =>
          next(request.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } })),
        ),
        catchError((refreshError) => {
          if (refreshError instanceof HttpErrorResponse && refreshError.status === 401) {
            auth.clear();
            void router.navigate(['/connexion']);
          }
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
