import { HTTP_INTERCEPTORS, HttpInterceptorFn } from '@angular/common/http';

import { inject } from '@angular/core';
import { from, Observable } from 'rxjs';

import { AdminAuthService } from './admin-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AdminAuthService);
  const token = auth.token;
  if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(authReq);
  }
  return next(req);
};

export const provideAuthInterceptor = () => ({
  provide: HTTP_INTERCEPTORS,
  useValue: authInterceptor,
  multi: true,
});
