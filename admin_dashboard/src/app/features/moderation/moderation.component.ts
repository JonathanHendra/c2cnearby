import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { PostRow } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

const STATUS_LABELS: Record<string, string> = {
  hidden: 'Disembunyikan',
  rejected: 'Ditolak',
  active: 'Aktif',
  draft: 'Rencana',
};

const STATUS_TONE: Record<string, string> = {
  hidden: 'danger',
  rejected: 'danger',
  active: 'success',
  draft: 'neutral',
};

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Antrian Moderasi</h3>
        <span class="text-secondary text-sm">
          Posting yang dilaporkan atau ditandai anomali. Tindakan di sini terdokumentasi di Audit Log.
        </span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Gambar</th>
              <th>Judul</th>
              <th>Penjual</th>
              <th>Kategori</th>
              <th>Lokasi</th>
              <th>Alasan</th>
              <th>Status</th>
              <th class="text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            @for (post of queue(); track post.id) {
              <tr>
                <td>
                  <img [src]="post.image" alt="" class="w-10 h-10 object-cover rounded" />
                </td>
                <td>
                  <a [routerLink]="['/posting', post.id]" class="text-[#1b5cff] font-semibold block">{{ post.title }}</a>
                </td>
                <td class="text-sm">{{ post.seller }}</td>
                <td class="text-sm">{{ post.category }}</td>
                <td class="text-sm">{{ post.area }}</td>
                <td class="text-sm">
                  @if (post.reported) {
                    <span class="text-danger">Dilaporkan pengguna lain</span>
                  } @else {
                    <span class="text-secondary">Anomali otomatis</span>
                  }
                </td>
                <td>
                  <app-status-badge [label]="STATUS_LABELS[post.status]" [tone]="STATUS_TONE[post.status]" />
                </td>
                <td class="flex gap-8 justify-content-between">
                  <div class="flex gap-8">
                    <button
                      class="btn btn-primary btn-sm"
                      (click)="approve(post)"
                    >
                      <span class="ms">check_circle_outline</span>
                      Terima
                    </button>
                    <button
                      class="btn btn-danger btn-sm"
                      (click)="reject(post)"
                    >
                      <span class="ms">block</span>
                      Tolak
                    </button>
                  </div>
                  <span class="text-secondary text-sm">Lihat</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (queue().length === 0) {
        <div class="empty">
          <span class="icon">check_circle</span>
          <p>Tidak ada posting yang menunggu moderasi.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    img.w-10 { width: 40px; height: 40px; }
  `],
})
export class ModerationComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_TONE = STATUS_TONE;

  readonly posts = toSignal(this.service.getPosts(), { initialValue: [] as PostRow[] });

  readonly queue = computed(() => this.posts().filter(p => p.reported || p.status === 'hidden' || p.status === 'rejected'));

  approve(post: PostRow): void {
    this.service.moderatePost(post.id, 'active');
    this.toast.success(`Posting "${post.title}" diterima`);
  }

  reject(post: PostRow): void {
    this.service.moderatePost(post.id, 'rejected');
    this.toast.success(`Posting "${post.title}" ditolak`);
  }
}
