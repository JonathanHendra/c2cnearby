import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { VerificationRow } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

export type Filter = 'all' | 'pending' | 'verified' | 'rejected';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
};

const STATUS_TONE: Record<string, string> = {
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
};

@Component({
  selector: 'app-verifications',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ pending() }}</div>
        <div class="label">Menunggu verifikasi</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ verified() }}</div>
        <div class="label">Sudah tervalidasi</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ rejected() }}</div>
        <div class="label">Ditolak</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Pendaftaran Verifikasi Wajah & No. HP</h3>
        <span class="text-secondary text-sm">
          Wajah menggunakan sensor 3D; data mentah tidak pernah dikirim ke perangkat pengguna.
        </span>
      </div>

      <div class="flex align-items-center gap-8 mb-8">
        <button
          class="btn btn-ghost btn-sm"
          [class.btn-primary]="filter() === 'all'"
          (click)="filter.set('all')"
        >
          <span class="ms">label</span>
          Semua
        </button>
        <button
          class="btn btn-ghost btn-sm"
          [class.btn-primary]="filter() === 'pending'"
          (click)="filter.set('pending')"
        >
          <span class="ms">pending</span>
          Menunggu
        </button>
        <button
          class="btn btn-ghost btn-sm"
          [class.btn-primary]="filter() === 'verified'"
          (click)="filter.set('verified')"
        >
          <span class="ms">check_circle</span>
          Terverifikasi
        </button>
        <button
          class="btn btn-ghost btn-sm"
          [class.btn-primary]="filter() === 'rejected'"
          (click)="filter.set('rejected')"
        >
          <span class="ms">block</span>
          Ditolak
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>No. HP</th>
              <th>Verifikasi Wajah</th>
              <th>Status</th>
              <th>Dilempar</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (item of filtered(); track item.id) {
              <tr>
                <td>
                  <a [routerLink]="['/users', item.id]" class="flex align-items-center gap-8">
                    <span class="avatar" style="width:32px;height:32px;font-size:12px;">{{ initial(item.user) }}</span>
                    <span class="font-semibold">{{ item.user }}</span>
                  </a>
                </td>
                <td class="text-sm">{{ item.phone }}</td>
                <td class="text-sm">{{ item.faceVerified ? 'Sudah' : 'Belum' }}</td>
                <td>
                  <app-status-badge [label]="STATUS_LABELS[item.status]" [tone]="STATUS_TONE[item.status]" />
                </td>
                <td class="text-sm">{{ item.submittedAt }}</td>
                <td class="flex gap-8 justify-content-between">
                  @if (item.status === 'pending') {
                    <div class="flex gap-8">
                      <button
                        class="btn btn-primary btn-sm"
                        (click)="approve(item)"
                      >
                        <span class="ms">check_circle_outline</span>
                        Setujui
                      </button>
                      <button
                        class="btn btn-danger btn-sm"
                        (click)="reject(item)"
                      >
                        <span class="ms">cancel</span>
                        Tolak
                      </button>
                    </div>
                  } @else {
                    <span class="text-secondary text-sm">Sudah ditindaklanjuti</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (filtered().length === 0) {
        <div class="empty">
          <span class="icon">loop</span>
          <p>Belum ada pendaftaran yang cocok.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .space-y-6 > * { margin-bottom: 6px; }
    .space-y-6 > *:last-child { margin-bottom: 0; }
  `],
})
export class VerificationsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_TONE = STATUS_TONE;

  readonly verifications = toSignal(this.service.getVerifications(), {
    initialValue: [] as VerificationRow[],
  });

  readonly filter = signal<Filter>('all');

  readonly filtered = computed(() => {
    const list = this.verifications();
    return list.filter(v => {
      if (this.filter() === 'pending' && v.status !== 'pending') return false;
      if (this.filter() === 'verified' && v.status !== 'verified') return false;
      if (this.filter() === 'rejected' && v.status !== 'rejected') return false;
      return true;
    });
  });

  readonly pending = computed(
    () => this.verifications().filter(v => v.status === 'pending').length,
  );
  readonly verified = computed(
    () => this.verifications().filter(v => v.status === 'verified').length,
  );
  readonly rejected = computed(
    () => this.verifications().filter(v => v.status === 'rejected').length,
  );

  approve(item: VerificationRow): void {
    this.service.updateVerification(item.id, 'verified');
    this.toast.success(`Verifikasi ${item.user} disetujui`);
  }

  reject(item: VerificationRow): void {
    this.service.updateVerification(item.id, 'rejected');
    this.toast.success(`Verifikasi ${item.user} ditolak`);
  }

  initial(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }
}
