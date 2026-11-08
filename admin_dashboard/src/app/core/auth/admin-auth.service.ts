import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'moderator'
  | 'verification_manager'
  | 'support';

export interface AdminIdentity {
  id: string;
  email: string | null;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
}

/** Admin sessions come from the backend (`/admin/auth/login`), not Firebase. */
export interface AdminSession {
  admin: AdminIdentity;
  permissions: string[];
  token: string;
  expires_at: string;
}

const LOGIN_URL = `${environment.apiBaseUrl}/admin/auth/login`;
const ME_URL = `${environment.apiBaseUrl}/admin/auth/me`;
const STORAGE_KEY = 'c2c.admin.session';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);

  readonly session = signal<AdminSession | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed<AdminRole | null>(() => this.session()?.admin.role ?? null);

  /** Kept outside `session` so it is available while `/me` restores a reload. */
  private readonly authToken = signal<string | null>(null);

  /** Bearer token for API calls; the backend re-checks the admin row each time. */
  get token(): string | null {
    return this.authToken();
  }

  can(permission: string): boolean {
    return this.session()?.permissions.includes(permission) ?? false;
  }

  async loginWithEmailPassword(email: string, password: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<{ data: AdminSession }>(LOGIN_URL, { email, password }),
      );
      this.apply(response.data);
      return true;
    } catch (error) {
      this.clear();
      this.error.set(this.describe(error));
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  /** Restores the session on reload; false means "not an admin / signed out". */
  async ensureSession(): Promise<boolean> {
    if (this.session()) {
      return true;
    }

    const stored = this.readStoredSession();
    if (!stored) {
      return false;
    }
    if (this.isExpired(stored.expires_at)) {
      this.clear();
      return false;
    }

    this.authToken.set(stored.token);
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.http.get<{ data: AdminSession }>(ME_URL));
      this.apply(response.data);
      return true;
    } catch (error) {
      this.clear();
      this.error.set(this.describe(error));
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.clear();
  }

  clearError(): void {
    this.error.set(null);
  }

  private apply(session: AdminSession): void {
    this.authToken.set(session.token);
    this.session.set(session);
    this.error.set(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Private mode / storage disabled: the in-memory session still works.
    }
  }

  private clear(): void {
    this.authToken.set(null);
    this.session.set(null);
    this.error.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }

  private readStoredSession(): AdminSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<AdminSession> | null;
      if (
        !parsed ||
        typeof parsed.token !== 'string' ||
        typeof parsed.expires_at !== 'string' ||
        !parsed.admin ||
        !Array.isArray(parsed.permissions)
      ) {
        return null;
      }
      return parsed as AdminSession;
    } catch {
      return null;
    }
  }

  private isExpired(expiresAt: string): boolean {
    const timestamp = new Date(expiresAt).getTime();
    return !Number.isFinite(timestamp) || timestamp <= Date.now();
  }

  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { error?: { message?: string } } | null)?.error?.message;
      if (message) {
        return message;
      }
      if (error.status === 401) {
        return 'Sesi admin sudah berakhir. Silakan masuk kembali.';
      }
      if (error.status === 403) {
        return 'Akun ini tidak memiliki akses admin yang aktif.';
      }
      if (error.status === 0) {
        return 'Tidak dapat menghubungi API. Jalankan backend lalu coba lagi.';
      }
      return `Permintaan gagal (${error.status}).`;
    }
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }
    return 'Masuk gagal. Coba lagi.';
  }
}
