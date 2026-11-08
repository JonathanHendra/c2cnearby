import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const AUTO_DISMISS_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;

  readonly toasts = signal<Toast[]>([]);

  push(toast: Toast): void {
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.remove(toast.id), AUTO_DISMISS_MS);
  }

  success(message: string): void {
    this.push({ id: this.nextId++, type: 'success', message });
  }

  error(message: string): void {
    this.push({ id: this.nextId++, type: 'error', message });
  }

  info(message: string): void {
    this.push({ id: this.nextId++, type: 'info', message });
  }

  remove(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }
}
