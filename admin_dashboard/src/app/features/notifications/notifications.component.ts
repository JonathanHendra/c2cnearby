import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminDataService } from '../../core/admin-data.service';
import type { NotificationRow } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

export type AdminNotificationType = 'info' | 'success' | 'warning';

interface NewNotification {
  audience: string;
  title: string;
  body: string;
  type: AdminNotificationType;
}

const TYPE_LABELS: Record<AdminNotificationType, string> = {
  info: 'Informasi',
  success: 'Berhasil',
  warning: 'Perhatian',
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent],
  template: `
    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Kirim Notifikasi Admin</h3>
        <span class="text-secondary text-sm">
          Konten terkirim disimpan lokal selama fase 1. Mengirim ke pengguna resmi terjadi pada fase 7.
        </span>
      </div>

      <form
        (ngSubmit)="onSubmit()"
        class="grid grid-cols-1 md:grid-cols-4 gap-8"
      >
        <div class="md:col-span-1">
          <label class="field-label">Target</label>
          <select class="field" [(ngModel)]="form.audience" name="audience">
            <option value="semua">Semua pengguna</option>
            <option value="pribadi">Pribadi</option>
            <option value="seluruh">Seluruh komunitas</option>
          </select>
        </div>
        <div class="md:col-span-1">
          <label class="field-label">Judul</label>
          <input class="field" [(ngModel)]="form.title" name="title" placeholder="Contoh: Live now" required />
        </div>
        <div class="md:col-span-2">
          <label class="field-label">Isi pesan</label>
          <textarea class="field" [(ngModel)]="form.body" name="body" rows="3" placeholder="Isi pesan..." required></textarea>
        </div>
        <div class="md:col-span-2">
          <div class="flex gap-8">
            <button class="btn btn-primary" type="submit">
              <span class="ms">send</span>
              Kirim & Hafal
            </button>
            <span class="text-secondary text-xs">
              Peringatan: bukan kirim ke FCM (fase 7).
            </span>
          </div>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Riwayat Notifikasi</h3>
        <span class="text-secondary text-sm">Semua notifikasi tersimpan di database pengguna.</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Jenis</th>
              <th>Judul</th>
              <th>Isi</th>
              <th>Target</th>
              <th>Dikirim</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (item of notifications(); track item.id) {
              <tr>
                <td>
                  <span class="badge" [class]="item.type === 'warning' ? 'badge-warning' : item.type === 'success' ? 'badge-success' : 'badge-info'">
                    {{ TYPE_LABELS[item.type] }}
                  </span>
                </td>
                <td>{{ item.title }}</td>
                <td class="text-sm">{{ item.body }}</td>
                <td class="text-sm">{{ item.audience }}</td>
                <td class="text-sm">{{ item.sentAt }}</td>
                <td>
                  <app-status-badge
                    [label]="item.read ? 'Dibaca' : 'Belum dibaca'"
                    [tone]="item.read ? 'neutral' : 'info'"
                  />
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
export class NotificationsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly TYPE_LABELS = TYPE_LABELS;

  readonly notifications = toSignal(this.service.getNotifications(), {
    initialValue: [] as NotificationRow[],
  });

  form = { audience: 'semua', title: '', body: '' };

  onSubmit(): void {
    if (!this.form.title.trim() || !this.form.body.trim()) return;
    this.service.addNotification({
      audience: this.form.audience,
      title: this.form.title.trim(),
      body: this.form.body.trim(),
      type: 'info',
      read: false,
      storedLocally: true,
    });
    this.form.title = '';
    this.form.body = '';
    this.toast.success('Notifikasi tersimpan di database pengguna');
  }
}
