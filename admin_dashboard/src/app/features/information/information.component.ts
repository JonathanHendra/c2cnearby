import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { PostRow, PostStatus } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';

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
  selector: 'app-information',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ information().length }}</div>
        <div class="label">Total informasi</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ activeCount() }}</div>
        <div class="label">Aktif</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ pendingReport() }}</div>
        <div class="label">Dilaporkan</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Informasi & Edukasi</h3>
        <span class="text-secondary text-sm">Pusat edukasi dan berita pasar.</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Gambar</th>
              <th>Judul</th>
              <th>Penulis</th>
              <th>Area</th>
              <th>Tampil</th>
              <th>Dibuat</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (post of information(); track post.id) {
              <tr>
                <td>
                  <img [src]="post.image" alt="" class="w-10 h-10 object-cover rounded" />
                </td>
                <td>
                  <a [routerLink]="['/informasi', post.id]" class="text-[#1b5cff] font-semibold block">{{ post.title }}</a>
                </td>
                <td class="text-sm">{{ post.seller }}</td>
                <td class="text-sm">{{ post.area }}</td>
                <td class="text-sm">
                  @if (post.status === 'active') {
                    <span class="text-secondary">Tampil</span>
                  } @else {
                    <span class="text-secondary">Sembunyikan</span>
                  }
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
                  <a [routerLink]="['/informasi', post.id]" class="btn btn-primary btn-sm">
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
export class InformationComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly information = toSignal(this.service.getPosts(), { initialValue: [] as PostRow[] });

  readonly activeCount = computed(() => this.information().filter(p => p.type === 'information' && p.status === 'active').length);
  readonly pendingReport = computed(() => this.information().filter(p => p.reported).length);

  setStatus(post: PostRow, status: PostStatus): void {
    this.service.updatePost(post.title, status, post.id);
    this.toast.success(
      `Informasi ${post.title} ${status === 'active' ? 'ditampilkan' : 'disembunyikan'}`,
    );
  }
}
