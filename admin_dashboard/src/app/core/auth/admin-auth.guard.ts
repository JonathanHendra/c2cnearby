import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AdminDataService } from '../admin-data.service';
import { AdminAuthService } from './admin-auth.service';

/** Every admin screen requires an active `admin_users` row, re-checked on load. */
export const adminAuthGuard: CanActivateFn = async () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  // Resolve before awaiting: `inject()` is only valid inside the synchronous
  // part of the guard.
  const data = inject(AdminDataService);

  const allowed = await auth.ensureSession();
  if (!allowed) {
    return router.createUrlTree(['/masuk']);
  }
  await data.loadAll();
  return true;
};
