import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { PostRow, PostStatus } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

export type PostFilter = 'all' | 'sell' | 'event' | 'information';

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  draft: 'Rencana',
  hidden: 'Disembunyikan',
  rejected: 'Ditolak',
  sold: 'Terjual',
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

const TYPE_LABELS: Record<string, string> = {
  sell: 'Jual',
  event: 'Event',
  information: 'Informasi',
};

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ posts().length }}</div>
        <div class="label">Total posting</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ activeCount() }}</div>
        <div class="label">Aktif</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ reportedCount() }}</div>
        <div class="label">Dilaporkan</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ draftCount() }}</div>
        <div class="label">Rencana</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Manajemen Posting</h3>
        <div class="flex align-items-center gap-8">
          <div class="search-input">
            <span class="ms">search</span>
            <input
              type="text"
              placeholder="Cari judul atau penjual..."
              [(ngModel)]="search"
              (input)="applyFilters()"
            />
          </div>
          <select class="filter-select" [(ngModel)]="typeFilter" (change)="applyFilters()">
            <option value="">Semua tipe</option>
            <option value="sell">Jual</option>
            <option value="event">Event</option>
            <option value="information">Informasi</option>
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Gambar</th>
              <th>Judul</th>
              <th>Kategori</th>
              <th>Penjual</th>
              <th>Harga</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (post of filteredPosts(); track post.id) {
              <tr>
                <td>
                  <img [src]="post.image" alt="" class="w-10 h-10 object-cover rounded" />
                </td>
                <td>
                  <a [routerLink]="['/posting', post.id]" class="text-[#1b5cff] font-semibold block">{{ post.title }}</a>
                </td>
                <td class="text-sm">{{ post.category }}</td>
                <td class="text-sm">{{ post.seller }}</td>
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
                  <a [routerLink]="['/posting', post.id]" class="btn btn-primary btn-sm">
                    <span class="ms">visibility</span>
                    Detail
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (filteredPosts().length === 0) {
        <div class="empty">
          <span class="icon">search</span>
          <p>Tidak ada posting yang cocok.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    img.w-10 { width: 40px; height: 40px; }
  `],
})
export class PostsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly posts = toSignal(this.service.getPosts(), { initialValue: [] as PostRow[] });

  search = '';
  typeFilter: PostFilter | '' = '';

  readonly filteredPosts = computed(() => {
    const list = this.posts();
    const q = this.search.toLowerCase();
    return list.filter(p => {
      if (this.typeFilter && p.type !== this.typeFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.seller.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  readonly activeCount = computed(() => this.posts().filter(p => p.status === 'active').length);
  readonly reportedCount = computed(() => this.posts().filter(p => p.reported).length);
  readonly draftCount = computed(() => this.posts().filter(p => p.status === 'draft').length);

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_TONE = STATUS_TONE;
  readonly TYPE_LABELS = TYPE_LABELS;

  applyFilters(): void {}

  setStatus(post: PostRow, status: PostStatus): void {
    this.service.updatePost(post.title, status, post.id);
    this.toast.success(
      `Posting ${post.title} ${status === 'active' ? 'ditampilkan' : 'disembunyikan'}`,
    );
  }
}
