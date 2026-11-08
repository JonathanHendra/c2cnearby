import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [],
  template: `
    <div class="stat-card">
      <div class="value">{{ value() }}</div>
      <div class="label">{{ label() }}</div>
      @if (trend()) {
        <div class="trend trend-{{ type() }}">{{ trend() }}</div>
      }
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly trend = input<string | null>(null);
  readonly type = input<'up' | 'down'>('up');
}
