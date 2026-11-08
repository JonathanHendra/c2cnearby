import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { ADMIN_ROUTES } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(ADMIN_ROUTES, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};
