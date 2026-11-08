import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [],
  template: `
    @if (open()) {
      <div class="modal-backdrop" role="presentation" (click)="dismiss.emit()">
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <h2>{{ title() }}</h2>
            <button type="button" class="btn btn-ghost btn-sm" (click)="dismiss.emit()" aria-label="Tutup">
              <span class="ms">close</span>
            </button>
          </div>
          <div class="modal-body">
            <ng-content />
          </div>
          <div class="modal-footer">
            <ng-content select="[footer]" />
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

      .modal {
        align-self: center;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 20px;
        border-bottom: 1px solid var(--border);
      }

      .modal-header h2 {
        margin: 0;
        font-size: 16px;
      }

      .modal-body {
        padding: 20px;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 14px 20px;
        border-top: 1px solid var(--border);
      }
    `,
  ],
})
export class ModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();

  readonly dismiss = output<void>();
}
