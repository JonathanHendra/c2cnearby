import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal-footer',
  standalone: true,
  imports: [],
  template: `
    <div class="modal-actions">
      @for (action of actions(); track $index) {
        <button
          type="button"
          class="btn"
          [class.btn-primary]="action.primary"
          [class.btn-danger]="action.danger"
          [disabled]="action.disabled"
          (click)="actionTriggered.emit($index)"
        >
          {{ action.label }}
        </button>
      }
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class ModalFooterComponent {
  readonly actions = input.required<
    { label: string; primary?: boolean; danger?: boolean; disabled?: boolean }[]
  >();
  readonly actionTriggered = output<number>();
}
