import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [],
  template: `
    @if (url(); as imageUrl) {
      <img [src]="imageUrl" [alt]="name()" class="avatar" [style]="sizeStyle()" />
    } @else {
      <div class="avatar" [style]="sizeStyle()" [style.background]="background()">
        {{ initials() }}
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
    `,
  ],
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly url = input<string | null>(null);
  readonly size = input(40);
  readonly background = input<string | null>(null);

  readonly sizeStyle = computed(() => {
    const size = this.size();
    return `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px;`;
  });

  readonly initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2),
  );
}
