import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { PostRow, PostStatus } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  draft: 'Rencana',
  hidden: 'Disembunyikan',
  rejected: 'Ditolak',
  sold: 'Dijual',
  expired: 'Kadaluwarsa',
  completed: 'Selesai',
};

const STATUS_TONE: Record<string, string> = {
  active: 'success',
  draft: 'neutral',
  hidden: 'danger',
  rejected: 'danger',
  sold: 'success',
  expired: 'neutral',
  completed: 'neutral',
};

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ events().length }}</div>
        <div class="label">Total event</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ activeCount() }}</div>
        <div class="label">Aktif</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ soldCount() }}</div>
        <div class="label">Sudah terjual</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Event & Promosi</h3>
        <span class="text-secondary text-sm">Ekspor posting event untuk promosi.</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Gambar</th>
              <th>Judul</th>
              <th>Penjual</th>
              <th>Lokasi</th>
              <th>Harga</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (post of events(); track post.id) {
              <tr>
                <td>
                  <img [src]="post.image" alt="" class="w-10 h-10 object-cover rounded" />
                </td>
                <td>
                  <a [routerLink]="['/event', post.id]" class="text-[#1b5cff] font-semibold block">{{ post.title }}</a>
                </td>
                <td class="text-sm">{{ post.seller }}</td>
                <td class="text-sm">{{ post.area }}</td>
                <td class="text-sm">
                  @if (post.price) {
                    <span>{{ post.price | currency:'Rp' }}</span>
                  } @else {
                    <span class="text-secondary">Gratis</span>
                  }
                </td>
                <td>
                  <app-status-badge [label]="STATUS_LABELS[post.status]" [tone]="STATUS_TONE[post.status]" />
                </td>
                <td class="text-sm">{{ post.createdAt }}</td>
                <td class="flex gap-8 justify-content-between">
                  <div class="flex gap-8">
                    <button
                      class="btn btn-ghost btn-sm"
                      [class.btn-danger]="post.status === 'active'"
                      (click)="setStatus(post, post.status === 'active' ? 'hidden' : 'active')"
                    >
                      <span class="ms">{{ post.status === 'active' ? 'visibility_off' : 'visibility' }}</span>
                      {{ post.status === 'active' ? 'Sembunyikan' : 'Tampilkan' }}
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="setStatus(post, 'draft')"
                    >
                      <span class="ms">draft</span>
                      Rencana
                    </button>
                  </div>
                  <a [routerLink]="['/event', post.id]" class="btn btn-primary btn-sm">
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
    img.w-10 { width: 40px; height: 40px; }
  `],
})
export class EventsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly events = toSignal(this.service.getPosts(), { initialValue: [] as PostRow[] });

  readonly activeCount = computed(() => this.events().filter(p => p.type === 'event' && p.status === 'active').length);
  readonly soldCount = computed(() => this.events().filter(p => p.type === 'event' && p.status === 'sold').length);

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_TONE = STATUS_TONE;

  setStatus(post: PostRow, status: PostStatus): void {
    this.service.updatePost(post.title, status, post.id);
    this.toast.success(
      `Event ${post.title} ${status === 'active' ? 'ditampilkan' : 'disembunyikan'}`,
    );
  }
}
