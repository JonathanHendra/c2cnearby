import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { AdminDataService } from '../../core/admin-data.service';
import type { DashboardBar, DashboardStats, PostRow } from '../../core/admin.models';
import { StatCardComponent } from '../../core/components/stat-card.component';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

const EMPTY_STATS: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  totalPosts: 0,
  activePosts: 0,
  flaggedPosts: 0,
  conversations: 0,
  totalCategories: 0,
  activeCategories: 0,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StatCardComponent, StatusBadgeComponent],
  template: `
    <div class="stats-grid">
      <app-stat-card label="Total Pengguna" [value]="stats().totalUsers" />
      <app-stat-card
        label="Pengguna Aktif"
        [value]="stats().activeUsers"
        type="up"
      />
      <app-stat-card
        label="Posting Aktif"
        [value]="stats().activePosts"
        [trend]="stats().flaggedPosts > 0 ? '⚠ ' + stats().flaggedPosts : null"
      />
      <app-stat-card
        label="Kategori Aktif"
        [value]="stats().activeCategories"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 card">
        <div class="panel-head">
          <h3 class="panel-title">Volumn Posting 7 Hari Terakhir</h3>
          <span class="text-secondary text-sm">Jumlah postingan baru per hari</span>
        </div>
        <div class="chart-bars">
          @for (bar of weeklyBars(); track bar.label) {
            <div class="bar-row">
              <div class="bar-label">{{ bar.label }}</div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  [style.width.%]="(bar.value / 35) * 100"
                ></div>
              </div>
              <div class="text-secondary text-sm">{{ bar.value }}</div>
            </div>
          }
        </div>
      </div>

      <div class="card">
        <div class="panel-head">
          <h3 class="panel-title">Kategori Aktif</h3>
          <span class="text-secondary text-sm">Ringkasan kategori yang dipakai</span>
        </div>
        <div class="space-y-6">
          @for (cat of catBars(); track cat.label) {
            <div class="flex items-center gap-8">
              <div class="flex-1">
                <div class="flex justify-between text-sm">
                  <span>{{ cat.label }}</span>
                  <span class="text-secondary">{{ cat.value }}</span>
                </div>
                <div class="progress mt-2">
                  <div
                    class="progress-bar"
                    [style.width.%]="(cat.value / 35) * 100"
                  ></div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="card">
        <div class="panel-head">
          <h3 class="panel-title">Posting yang Dilaporkan</h3>
          <span class="text-secondary text-sm">Belum divalidasi tim moderasi</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Penjual</th>
                <th>Lokasi</th>
                <th>Tanggal Dibuat</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (post of reportedPosts(); track post.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/posting', post.id]" class="text-[#1b5cff] font-semibold">{{ post.title }}</a>
                  </td>
                  <td>{{ post.seller }}</td>
                  <td>{{ post.area }}</td>
                  <td>{{ post.createdAt }}</td>
                  <td>
                    <app-status-badge
                      label="Aktif"
                      tone="neutral"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="panel-head">
          <h3 class="panel-title">Aktivitas Terbaru</h3>
        </div>
        <ul class="space-y-5">
          @for (item of activity(); track item.id) {
            <li class="flex items-start gap-8">
              <span class="ms" style="font-size:18px;">pulse</span>
              <div class="min-w-0">
                <p class="text-sm font-semibold">{{ item.action }}</p>
                <p class="text-secondary text-xs">{{ item.admin }} · {{ item.target }}</p>
              </div>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .grid { display: grid; gap: 20px; }
    .lg\:col-span-2 { grid-column: span 2; }
    @media (max-width: 1024px) {
      .lg\\:col-span-2 { grid-column: span 1; }
    }
  `],
})
export class DashboardComponent {
  private readonly service = inject(AdminDataService);

  readonly stats = toSignal(this.service.stats, { initialValue: EMPTY_STATS });
  readonly weeklyBars = toSignal(this.service.weeklyBars$, {
    initialValue: [] as DashboardBar[],
  });

  readonly reportedPosts = toSignal(
    this.service
      .getPosts()
      .pipe(map(posts => posts.filter(p => p.reported || p.status === 'hidden' || p.status === 'rejected'))),
    { initialValue: [] as PostRow[] },
  );

  readonly catBars = toSignal(this.service.categoryBars$, {
    initialValue: [] as DashboardBar[],
  });

  readonly activity = toSignal(this.service.activity$, {
    initialValue: [] as { id: string; action: string; target: string; admin: string; at: string }[],
  });
}
