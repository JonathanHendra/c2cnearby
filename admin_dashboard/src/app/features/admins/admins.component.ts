import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminDataService } from '../../core/admin-data.service';
import type { AdminRow } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';
import { ModalComponent } from '../../core/components/modal.component';
import { ModalFooterComponent } from '../../core/components/modal-footer.component';

export type Role = 'super-admin' | 'admin';

const ROLE_LABELS: Record<Role, string> = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
};

const ROLE_TONE: Record<Role, string> = {
  'super-admin': 'soft',
  admin: 'info',
};

interface FormState {
  name: string;
  email: string;
}

@Component({
  selector: 'app-admins',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, ModalComponent, ModalFooterComponent],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ admins().length }}</div>
        <div class="label">Total admin</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ activeAdmins() }}</div>
        <div class="label">Aktif</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ superAdminCount() }}</div>
        <div class="label">Super Admin</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Manajemen Admin</h3>
        <button class="btn btn-primary btn-sm" (click)="openDialog()">
          <span class="ms">add</span>
          Tambah admin
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Peran</th>
              <th>Status</th>
              <th>Login terakhir</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (admin of admins(); track admin.id) {
              <tr>
                <td>{{ admin.name }}</td>
                <td class="text-sm">{{ admin.email }}</td>
                <td>
                  <app-status-badge
                    [label]="ROLE_LABELS[admin.role]"
                    [tone]="ROLE_TONE[admin.role]"
                  />
                </td>
                <td>
                  <app-status-badge
                    [label]="admin.active ? 'Aktif' : 'Tidak aktif'"
                    [tone]="admin.active ? 'success' : 'neutral'"
                  />
                </td>
                <td class="text-sm">{{ admin.lastLogin }}</td>
                <td class="flex gap-8 justify-content-between">
                  <div class="flex gap-8">
                    <select
                      class="select"
                      [ngModel]="admin.role"
                      (ngModelChange)="saveRole(admin, $event)"
                    >
                      <option value="super-admin">Super Admin</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      class="btn btn-ghost btn-sm"
                      [class.btn-danger]="!admin.active"
                      (click)="toggleActive(admin)"
                    >
                      <span class="ms">{{ admin.active ? 'power_settings_new' : 'power_settings_new' }}</span>
                      {{ admin.active ? 'Nonaktif' : 'Aktif' }}
                    </button>
                  </div>
                  <button class="btn btn-danger btn-sm" (click)="remove(admin)">
                    <span class="ms">delete</span>
                    Hapus
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (admins().length === 0) {
        <div class="empty">
          <span class="icon">group_remove</span>
          <p>Belum ada admin. Tambahkan akun baru.</p>
        </div>
      }
    </div>

    <!-- Tambah dialog -->
    <app-modal
      [open]="dialogOpen()"
      title="Tambah Admin"
      (dismiss)="closeDialog()"
    >
      <div class="space-y-6">
        <div class="grid grid-cols-2 gap-8">
          <div>
            <label class="field-label">Nama lengkap</label>
            <input class="field" [(ngModel)]="form.name" name="name" placeholder="Nama admin (opsional)" />
          </div>
          <div>
            <label class="field-label">Email</label>
            <input class="field" type="email" [(ngModel)]="form.email" name="email" placeholder="admin@example.com" />
          </div>
        </div>
      </div>
      <app-modal-footer
        footer
        [actions]="[
          { label: 'Batal', primary: false },
          { label: 'Tambah admin', primary: true }
        ]"
        (actionTriggered)="saveDialog($event)"
      />
    </app-modal>
  `,
  styles: [`
    :host { display: block; }
    .grid { display: grid; gap: 20px; }
  `],
})
export class AdminsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly ROLE_LABELS = ROLE_LABELS;
  readonly ROLE_TONE = ROLE_TONE;

  readonly admins = toSignal(this.service.getAdmins(), { initialValue: [] as AdminRow[] });

  readonly activeAdmins = computed(() => this.admins().filter(a => a.active).length);
  readonly superAdminCount = computed(() => this.admins().filter(a => a.role === 'super-admin').length);

  readonly dialogOpen = signal(false);
  form: FormState = { name: '', email: '' };

  openDialog(): void {
    this.form = { name: '', email: '' };
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  saveDialog(index: number): void {
    if (index !== 1) {
      this.closeDialog();
      return;
    }
    const name = this.form.name.trim();
    const email = this.form.email.trim();
    if (!name || !email) {
      this.toast.error('Nama dan email admin wajib diisi');
      return;
    }
    this.service.addAdmin({ name, email, role: 'admin', active: true, lastLogin: '-' });
    this.closeDialog();
    this.toast.success('Admin baru ditambahkan');
  }

  saveRole(admin: AdminRow, role: Role): void {
    this.service.updateAdminRole(admin.id, role);
    this.toast.success(`Peran ${admin.name} diubah`);
  }

  toggleActive(admin: AdminRow): void {
    this.service.toggleAdminActive(admin.id);
    this.toast.success(admin.active ? 'Admin nonaktif' : 'Admin diaktifkan');
  }

  remove(admin: AdminRow): void {
    if (!confirm('Hapus admin ini?')) return;
    this.service.removeAdmin(admin.id);
    this.toast.success('Admin dihapus dari daftar');
  }
}
