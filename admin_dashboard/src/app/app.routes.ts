import { Route } from '@angular/router';

import { adminAuthGuard } from './core/auth/admin-auth.guard';
import { AdminLoginComponent } from './features/login/admin-login.component';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const ADMIN_ROUTES: Route[] = [
  { path: 'masuk', component: AdminLoginComponent, title: 'Masuk Admin' },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [adminAuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent, title: 'Dashboard' },
      { path: 'pengguna', loadComponent: () =>
        import('./features/users/users.component').then(m => m.UsersComponent),
        title: 'Pengguna' },
      { path: 'verifikasi', loadComponent: () =>
        import('./features/verifications/verifications.component').then(m => m.VerificationsComponent),
        title: 'Verifikasi' },
      { path: 'posting', loadComponent: () =>
        import('./features/posts/posts.component').then(m => m.PostsComponent),
        title: 'Posting' },
      { path: 'kategori', loadComponent: () =>
        import('./features/categories/categories.component').then(m => m.CategoriesComponent),
        title: 'Kategori' },
      { path: 'event', loadComponent: () =>
        import('./features/events/events.component').then(m => m.EventsComponent),
        title: 'Event' },
      { path: 'informasi', loadComponent: () =>
        import('./features/information/information.component').then(m => m.InformationComponent),
        title: 'Informasi' },
      { path: 'moderasi', loadComponent: () =>
        import('./features/moderation/moderation.component').then(m => m.ModerationComponent),
        title: 'Moderasi' },
      { path: 'laporan', loadComponent: () =>
        import('./features/reports/reports.component').then(m => m.ReportsComponent),
        title: 'Laporan Pengguna' },
      { path: 'kesepakatan', loadComponent: () =>
        import('./features/agreements/agreements.component').then(m => m.AgreementsComponent),
        title: 'Kesepakatan' },
      { path: 'ulasan', loadComponent: () =>
        import('./features/reviews/reviews.component').then(m => m.ReviewsComponent),
        title: 'Ulasan' },
      { path: 'notifikasi', loadComponent: () =>
        import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
        title: 'Notifikasi' },
      { path: 'pengaturan', loadComponent: () =>
        import('./features/settings/settings.component').then(m => m.SettingsComponent),
        title: 'Pengaturan Aplikasi' },
      { path: 'admin', loadComponent: () =>
        import('./features/admins/admins.component').then(m => m.AdminsComponent),
        title: 'Admin & Role' },
      { path: 'audit-log', loadComponent: () =>
        import('./features/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent),
        title: 'Audit Log' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
