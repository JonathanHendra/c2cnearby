import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'c2c-admin-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly modeSignal = signal<ThemeMode>(this.readStoredMode());
  private readonly collapsedSignal = signal(false);

  readonly mode = this.modeSignal.asReadonly();
  readonly collapsed = this.collapsedSignal.asReadonly();
  readonly isDark = computed(() => this.modeSignal() === 'dark');

  constructor() {
    effect(() => {
      const dark = this.isDark();
      this.document.body.classList.toggle('dark', dark);
      this.persist(dark ? 'dark' : 'light');
    });
  }

  toggleMode(): void {
    this.modeSignal.update((mode) => (mode === 'light' ? 'dark' : 'light'));
  }

  setMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);
  }

  toggleSidebar(): void {
    this.collapsedSignal.update((collapsed) => !collapsed);
  }

  collapseSidebar(collapsed: boolean): void {
    this.collapsedSignal.set(collapsed);
  }

  private readStoredMode(): ThemeMode {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // localStorage dapat diblokir; jatuh ke tema terang.
    }
    return 'light';
  }

  private persist(mode: ThemeMode): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // abaikan bila penyimpanan tidak tersedia
    }
  }
}
