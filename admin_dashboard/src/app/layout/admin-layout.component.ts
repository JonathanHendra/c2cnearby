import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import type { NotificationRow } from '../core/admin.models';
import { AdminDataService } from '../core/admin-data.service';
import { AdminAuthService } from '../core/auth/admin-auth.service';
import { ThemeService } from '../core/theme.service';

export interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
  danger?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', path: 'dashboard' },
  { label: 'Pengguna', icon: 'group', path: 'pengguna' },
  { label: 'Verifikasi', icon: 'verified_user', path: 'verifikasi' },
  { label: 'Posting', icon: 'sell', path: 'posting' },
  { label: 'Kategori', icon: 'category', path: 'kategori' },
  { label: 'Event', icon: 'event', path: 'event' },
  { label: 'Informasi', icon: 'info', path: 'informasi' },
  { label: 'Moderasi', icon: 'gavel', path: 'moderasi', danger: true },
  { label: 'Laporan', icon: 'flag', path: 'laporan' },
  { label: 'Kesepakatan', icon: 'handshake', path: 'kesepakatan' },
  { label: 'Ulasan', icon: 'star', path: 'ulasan' },
  { label: 'Notifikasi', icon: 'notifications', path: 'notifikasi' },
  { label: 'Pengaturan', icon: 'settings', path: 'pengaturan' },
  { label: 'Admin & Role', icon: 'admin_panel_settings', path: 'admin' },
  { label: 'Audit Log', icon: 'history', path: 'audit-log' },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  pengguna: 'Daftar Pengguna',
  verifikasi: 'Verifikasi Pengguna',
  posting: 'Posting & Kategori',
  kategori: 'Kategori',
  event: 'Event & Promosi',
  informasi: 'Informasi & Edukasi',
  moderasi: 'Antrian Moderasi',
  laporan: 'Laporan Pengguna',
  kesepakatan: 'Kesepakatan & Risiko',
  ulasan: 'Ulasan & Kualitas',
  notifikasi: 'Notifikasi',
  pengaturan: 'Pengaturan Aplikasi',
  admin: 'Admin & Role',
  'audit-log': 'Audit Log',
};


const NOTIFICATION_ICONS: Record<NotificationRow['type'], string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
};

const NOTIFICATION_COLORS: Record<NotificationRow['type'], string> = {
  info: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <aside class="sidebar" [class.collapsed]="themeService.collapsed()">
        <div class="sidebar-header">
          <div class="brand">
            <span class="brand-mark">j</span>
            <span>C2C Nearby</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          @for (item of navItems; track item.path) {
            <div class="nav-group">
              <div class="sidebar-list">
                <a
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  class="sidebar-item"
                  [title]="item.label"
                  (click)="onNavigate()"
                >
                  <span class="ms">{{ item.icon }}</span>
                  <span class="label">{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="badge">{{ item.badge }}</span>
                  }
                  @if (item.danger) {
                    <span class="badge-dot"></span>
                  }
                </a>
              </div>
            </div>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="user-pill">
            <span class="avatar" style="width:32px;height:32px;font-size:13px;">{{ initials() }}</span>
            <div>
              <div class="name" style="color:#fff;">{{ adminName() }}</div>
              <div style="font-size:11px;">{{ adminEmail() }}</div>
            </div>
          </div>
        </div>
      </aside>

      <div class="page" [class.collapsed]="themeService.collapsed()">
        <header class="topbar">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="themeService.toggleSidebar()"
            [attr.aria-label]="themeService.collapsed() ? 'Tampilkan menu' : 'Sembunyikan menu'"
          >
            <span class="ms">{{ themeService.collapsed() ? 'menu' : 'menu_open' }}</span>
          </button>

          <div class="topbar-title">{{ pageTitle() }}</div>

          <div class="spacer"></div>

          <div class="topbar-actions">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="themeService.toggleMode()"
              aria-label="Ubah tema"
            >
              <span class="ms">{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</span>
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="showNotifications.set(true)"
              aria-label="Notifikasi"
            >
              <span class="ms">notifications</span>
            </button>

            <button type="button" class="user-pill" (click)="showProfile.set(true)">
              <span class="avatar" style="width:30px;height:30px;font-size:12px;">{{ initials() }}</span>
              <span class="name">{{ adminName() }}</span>
              <span class="ms" style="font-size:16px;">arrow_forward</span>
            </button>
          </div>
        </header>

        <main class="page-inner">
          <router-outlet />
        </main>
      </div>
    </div>

    @if (showProfile()) {
      <div class="modal-backdrop" (click)="showProfile.set(false)">
        <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Profil Admin</h2>
            <button type="button" class="btn btn-ghost btn-sm" (click)="showProfile.set(false)" aria-label="Tutup">
              <span class="ms">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="flex align-items-center gap-12 mb-16">
              <span class="avatar" style="width:64px;height:64px;font-size:22px;">{{ initials() }}</span>
              <div class="flex-1">
                <div class="font-semibold">{{ adminName() }}</div>
                <div class="text-secondary">{{ adminEmail() }}</div>
                <div class="text-muted">C2C Nearby Platform</div>
              </div>
            </div>
            <div class="flex gap-12">
              <div class="flex-1">
                <div class="text-muted text-xs">Email</div>
                <div class="text-secondary">{{ adminEmail() }}</div>
              </div>
              <div class="flex-1">
                <div class="text-muted text-xs">Peran</div>
                <div class="text-secondary">{{ adminRole() }}</div>
              </div>
              <div class="flex-1">
                <div class="text-muted text-xs">Status</div>
                <div class="text-secondary">Aktif</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" (click)="showProfile.set(false)">Tutup</button>
          </div>
        </div>
      </div>
    }

    @if (showNotifications()) {
      <div class="modal-backdrop" (click)="showNotifications.set(false)">
        <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Notifikasi</h2>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="showNotifications.set(false)"
              aria-label="Tutup"
            >
              <span class="ms">close</span>
            </button>
          </div>
          <div class="modal-body" style="max-height:60vh;overflow:auto;">
            @for (item of notifications(); track item.id) {
              <div class="flex align-items-start gap-12 notif-row">
                <span class="ms" [style.color]="notificationColor(item)">{{ notificationIcon(item) }}</span>
                <div>
                  <div class="font-semibold">{{ item.title }}</div>
                  <div class="text-secondary">{{ item.body }}</div>
                  <div class="text-muted text-xs" style="margin-top:4px;">{{ item.sentAt }}</div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .notif-row {
        padding: 10px 0;
        border-bottom: 1px solid var(--border);
      }

      .notif-row:last-child {
        border-bottom: 0;
      }

      .user-pill {
        cursor: pointer;
      }
    `,
  ],
})
export class AdminLayoutComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly themeService = inject(ThemeService);

  private readonly data = inject(AdminDataService);
  private readonly auth = inject(AdminAuthService);

  readonly navItems = NAV_ITEMS;
  readonly notifications = toSignal(this.data.getNotifications(), {
    initialValue: [] as NotificationRow[],
  });

  readonly adminEmail = computed(() => this.auth.session()?.admin.email ?? '');
  readonly adminName = computed(() => {
    const email = this.adminEmail();
    return email.length === 0 ? 'Admin' : email.split('@')[0];
  });
  readonly adminRole = computed(() => {
    const role = this.auth.session()?.admin.role;
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      case 'verification_manager':
        return 'Manajer Verifikasi';
      case 'support':
        return 'Dukungan';
      default:
        return '-';
    }
  });
  readonly initials = computed(() =>
    this.adminName()
      .split(/[._-]+/)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2),
  );

  readonly showProfile = signal(false);
  readonly showNotifications = signal(false);

  readonly pageTitle = signal(this.resolveTitle(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.pageTitle.set(this.resolveTitle(event.urlAfterRedirects));
      });
  }

  onNavigate(): void {
    this.themeService.collapseSidebar(false);
  }

  notificationIcon(item: NotificationRow): string {
    return NOTIFICATION_ICONS[item.type];
  }

  notificationColor(item: NotificationRow): string {
    return NOTIFICATION_COLORS[item.type];
  }

  private resolveTitle(url: string): string {
    const segments = url.split('?')[0].split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? 'dashboard';
    return PAGE_TITLES[last] ?? 'Dashboard';
  }
}
