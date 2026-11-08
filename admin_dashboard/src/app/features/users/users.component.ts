import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { UserRow, UserStatus } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';
import { ModalComponent } from '../../core/components/modal.component';
import { ModalFooterComponent } from '../../core/components/modal-footer.component';

export type UserAction = 'suspend' | 'activate' | 'view';

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  deactivated: 'Nonaktif',
};

const STATUS_TONE: Record<string, string> = {
  active: 'success',
  suspended: 'warning',
  deactivated: 'neutral',
};

function avatarName(name: string): string {
  return name.split(' ').map((w: string) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    ModalComponent,
    ModalFooterComponent,
  ],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ users().length }}</div>
        <div class="label">Total pengguna</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ activeCount() }}</div>
        <div class="label">Aktif</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ suspendedCount() }}</div>
        <div class="label">Ditangguhkan</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ pendingVerification() }}</div>
        <div class="label">Verifikasi belum selesai</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Daftar Pengguna</h3>
        <div class="flex align-items-center gap-8">
          <div class="search-input">
            <span class="ms">search</span>
            <input
              type="text"
              placeholder="Cari nama, username, area..."
              [(ngModel)]="search"
              (input)="applyFilters()"
            />
          </div>
          <select class="filter-select" [(ngModel)]="statusFilter" (change)="applyFilters()">
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="suspended">Ditangguhkan</option>
            <option value="deactivated">Nonaktif</option>
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Area</th>
              <th>Verifikasi</th>
              <th>Status</th>
              <th>Posting</th>
              <th>Laporan</th>
              <th>Bergabung</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (user of filteredUsers(); track user.id) {
              <tr>
                <td>
                  <a [routerLink]="['/verifikasi', user.id]" class="flex align-items-center gap-8">
                    <span class="avatar" style="width:36px;height:36px;font-size:13px;">{{ avatarName(user.name) }}</span>
                    <div>
                      <div class="font-semibold">{{ user.name }}</div>
                      <div class="text-secondary text-xs">@{{ user.username }}</div>
                    </div>
                  </a>
                </td>
                <td class="text-sm">{{ user.area }}</td>
                <td>
                  <div class="flex gap-8">
                    @if (user.phoneVerified) {
                      <span class="badge badge-success">Nomor</span>
                    }
                    @if (user.faceVerified) {
                      <span class="badge badge-success">Wajah</span>
                    } @else {
                      <span class="badge badge-neutral">Belum selesai</span>
                    }
                  </div>
                </td>
                <td>
                  <app-status-badge [label]="STATUS_LABELS[user.status]" [tone]="STATUS_TONE[user.status]" />
                </td>
                <td class="text-sm">{{ user.listings }}</td>
                <td class="text-sm">{{ user.reports }}</td>
                <td class="text-sm">{{ user.joinedAt }}</td>
                <td class="flex gap-8 justify-content-between">
                  <button
                    class="btn btn-ghost btn-sm"
                    [class.btn-danger]="statusFilter === 'suspended'"
                    (click)="runAction(user, statusFilter === 'suspended' ? 'activate' : 'suspend')"
                  >
                    <span class="ms">{{ statusFilter === 'suspended' ? 'check_circle' : 'block' }}</span>
                    {{ statusFilter === 'suspended' ? 'Aktifkan' : 'Tangguhkan' }}
                  </button>
                  <a [routerLink]="['/verifikasi', user.id]" class="btn btn-primary btn-sm">
                    <span class="ms">visibility</span>
                    Detail
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (filteredUsers().length === 0) {
        <div class="empty">
          <span class="icon">search</span>
          <p>Tidak ada pengguna yang cocok.</p>
        </div>
      }
    </div>

    <!-- Detail modal -->
    <app-modal
      [open]="detailOpen()"
      title="Detail Profil Pengguna"
      (dismiss)="detailOpen.set(false)"
    >
      @if (detailUser()) {
        <div class="space-y-6">
          <div>
            <div class="text-secondary text-sm">Nama</div>
            <div class="text-lg font-semibold">{{ detailUser()!.name }}</div>
          </div>
          <div>
            <div class="text-secondary text-sm">Username</div>
            <div class="text-secondary">@{{ detailUser()!.username }}</div>
          </div>
          <div class="flex gap-8">
            <div>
              <div class="text-secondary text-sm">Email</div>
              <div class="text-secondary">{{ detailUser()!.email }}</div>
            </div>
            <div>
              <div class="text-secondary text-sm">Area</div>
              <div class="text-secondary">{{ detailUser()!.area }}</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-8">
            <div>
              <div class="text-secondary text-sm">No. HP</div>
              <div class="text-secondary">{{ detailUser()!.phoneMasked }}</div>
            </div>
            <div>
              <div class="text-secondary text-sm">Verifikasi wajah</div>
              <div class="flex gap-8">
                @if (detailUser()!.faceVerified) {
                  <span class="badge badge-success">Terverifikasi</span>
                } @else {
                  <span class="badge badge-warning">Belum selesai</span>
                }
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-8">
            <div>
              <div class="text-secondary text-sm">Tiket terdaftar</div>
              <div class="text-secondary">{{ detailUser()!.listings }} pasangan</div>
            </div>
            <div>
              <div class="text-secondary text-sm">Laporan terkait</div>
              <div class="text-secondary">{{ detailUser()!.reports }} laporan</div>
            </div>
          </div>
          <div class="flex gap-8">
            <div class="flex-1">
              <div class="text-secondary text-xs">
                <span class="font-semibold">Catatan keamanan:</span> verification wajah menggunakan
                sensor 3D lokal perangkat untuk memastikan kartu identitas asli; hasilnya tersimpan
                di server keamanan, bukan di perangkat pengguna.
              </div>
            </div>
          </div>
        </div>
      }
      <app-modal-footer
        footer
        [actions]="[
          { label: 'Tutup', primary: false },
          { label: 'Tandai selesai', primary: true }
        ]"
        (actionTriggered)="onDetailFooter($event)"
      />
    </app-modal>
  `,
  styles: [`
    :host { display: block; }
    .grid { display: grid; gap: 20px; }
    .space-y-6 > * { margin-bottom: 6px; }
    .space-y-6 > *:last-child { margin-bottom: 0; }
  `],
})
export class UsersComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly users = toSignal(this.service.getUsers(), { initialValue: [] as UserRow[] });

  search = '';
  statusFilter: UserStatus | '' = '';
  readonly detailUser = signal<UserRow | null>(null);
  readonly detailOpen = signal(false);

  readonly filteredUsers = computed(() => {
    const list = this.users();
    const q = this.search.toLowerCase();
    return list.filter(u => {
      if (this.statusFilter && u.status !== this.statusFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  readonly activeCount = computed(() => this.users().filter(u => u.status === 'active').length);
  readonly suspendedCount = computed(() => this.users().filter(u => u.status === 'suspended').length);
  readonly pendingVerification = computed(() => this.users().filter(u => !u.phoneVerified || !u.faceVerified).length);

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_TONE = STATUS_TONE;
  readonly avatarName = avatarName;

  applyFilters(): void {
    // filter applied inline
  }

  runAction(user: UserRow, action: UserAction): void {
    if (action === 'suspend') {
      this.service.updateUserStatus(user.id, 'suspended');
      this.toast.success('Pengguna ditangguhkan');
    } else {
      this.service.updateUserStatus(user.id, 'active');
      this.toast.success('Pengguna diaktifkan');
    }
  }

  onDetailFooter(index: number): void {
    if (index === 1) this.detailOpen.set(false);
  }
}
