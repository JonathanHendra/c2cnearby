import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />

    <div class="toast-wrap">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class.error]="toast.type === 'error'">
          <span class="ms">{{ toastIcon(toast.type) }}</span>
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AppComponent {
  readonly toastService = inject(ToastService);

  toastIcon(type: 'success' | 'error' | 'info'): string {
    return type === 'error' ? 'report_problem' : type === 'info' ? 'info' : 'check_circle';
  }
}
