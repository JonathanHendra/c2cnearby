import { Component, computed, input } from '@angular/core';

function toneClass(value: string): string {
  switch (value) {
    case 'success':
      return 'badge-success';
    case 'warning':
      return 'badge-warning';
    case 'danger':
      return 'badge-danger';
    case 'info':
      return 'badge-info';
    case 'neutral':
      return 'badge-neutral';
    case 'soft':
      return 'badge-soft';
    default:
      return 'badge-neutral';
  }
}

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [],
  template: `<span class="badge" [class]="toneClass()">{{ label() }}</span>`,
  styles: [`:host { display: inline-block; }`],
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input.required<string>();
  readonly className = input<string>();

  readonly toneClass = computed(() => {
    const cls = toneClass(this.tone());
    return this.className() ? cls + ' ' + this.className() : cls;
  });
}
