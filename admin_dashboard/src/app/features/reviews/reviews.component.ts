import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { ReviewRow, ReviewVisible } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

const RATING_COLORS: Record<number, string> = {
  5: '#15a34a',
  4: '#1d4ed8',
  3: '#b45309',
  2: '#b45309',
  1: '#d92d20',
};

const RATING_LABELS: Record<number, string> = {
  5: 'Sangat baik',
  4: 'Baik',
  3: 'Cukup',
  2: 'Kurang',
  1: 'Buruk',
};

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ reviews().length }}</div>
        <div class="label">Total ulasan</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ visibleCount() }}</div>
        <div class="label">Tampil di situs</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ hiddenCount() }}</div>
        <div class="label">Tersembunyi</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Ulasan & Kualitas</h3>
        <span class="text-secondary text-sm">Ulasan dari pengguna lain yang dimoderasi sebelum tampil.</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Penilai</th>
              <th>Tinjau</th>
              <th>Rating</th>
              <th>Komentar</th>
              <th>Listing</th>
              <th>Dibuat</th>
              <th>Status</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (review of reviews(); track review.id) {
              <tr>
                <td>
                  <a [routerLink]="['/ulasan', review.id]" class="flex align-items-center gap-8">
                    <span class="avatar" style="width:30px;height:30px;font-size:12px;">{{ initials(review.reviewer) }}</span>
                    <span class="font-semibold">{{ review.reviewer }}</span>
                  </a>
                </td>
                <td class="text-sm">{{ review.reviewee }}</td>
                <td>
                  <div class="flex align-items-center gap-6">
                    @for (star of [1,2,3,4,5]; track star) {
                      <span
                        class="text-sm"
                        [style.color]="star <= review.rating ? RATING_COLORS[review.rating] : 'var(--text-tertiary)'"
                      >
                        {{ star <= review.rating ? '★' : '☆' }}
                      </span>
                    }
                    <span class="text-secondary text-xs">{{ review.rating }}</span>
                  </div>
                </td>
                <td>
                  <p class="text-sm">{{ review.comment }}</p>
                </td>
                <td class="text-sm">{{ review.listingTitle }}</td>
                <td class="text-sm">{{ review.createdAt }}</td>
                <td>
                  <app-status-badge
                    [label]="review.visible === 'visible' ? 'Tampil' : 'Tersembunyi'"
                    [tone]="review.visible === 'visible' ? 'success' : 'neutral'"
                  />
                </td>
                <td class="flex gap-8 justify-content-between">
                  <button
                    class="btn btn-ghost btn-sm"
                    (click)="toggleVisible(review)"
                  >
                    <span class="ms">{{ review.visible === 'visible' ? 'visibility_off' : 'visibility' }}</span>
                    {{ review.visible === 'visible' ? 'Sembunyikan' : 'Tampil' }}
                  </button>
                  <a [routerLink]="['/ulasan', review.id]" class="btn btn-primary btn-sm">
                    <span class="ms">visibility</span>
                    Detail
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ReviewsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly RATING_COLORS = RATING_COLORS;

  readonly reviews = toSignal(this.service.getReviews(), { initialValue: [] as ReviewRow[] });

  readonly visibleCount = computed(() => this.reviews().filter(r => r.visible === 'visible').length);
  readonly hiddenCount = computed(() => this.reviews().filter(r => r.visible === 'hidden').length);

  toggleVisible(review: ReviewRow): void {
    const next: ReviewVisible = review.visible === 'visible' ? 'hidden' : 'visible';
    this.service.toggleReviewVisibility(review.id, next);
    this.toast.success(`Ulasan "${review.reviewee}" ${next === 'visible' ? 'ditampilkan' : 'disembunyikan'}`);
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }
}
