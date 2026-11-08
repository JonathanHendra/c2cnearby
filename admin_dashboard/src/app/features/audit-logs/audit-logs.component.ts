import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminDataService } from '../../core/admin-data.service';
import type { AuditRow } from '../../core/admin.models';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Audit Log</h3>
        <div class="flex align-items-center gap-8">
          <select class="filter-select" [(ngModel)]="actionFilter" (change)="applyFilters()">
            <option value="">Semua aksi</option>
            <option value="status_changing">Perubahan status akun</option>
            <option value="post_hidden">Posting disembunyikan</option>
            <option value="post_active">Posting diaktifkan</option>
            <option value="verification_verified">Verifikasi disetujui</option>
            <option value="verification_rejected">Verifikasi ditolak</option>
            <option value="report_resolved">Laporan diselesaikan</option>
            <option value="role_changed">Perubahan peran admin</option>
            <option value="admin_added">Admin ditambahkan</option>
          </select>
          <span class="text-secondary text-sm">
            {{ audit().length }} entri
          </span>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Admin</th>
              <th>Aksi</th>
              <th>Target</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of filteredAudit(); track entry.id) {
              <tr>
                <td class="text-sm">{{ entry.at }}</td>
                <td class="font-semibold">{{ entry.admin }}</td>
                <td class="text-sm">{{ entry.action }}</td>
                <td class="text-sm">{{ entry.target }}</td>
                <td class="text-sm">
                  <span class="text-tertiary">{{ entry.ip }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (filteredAudit().length === 0) {
        <div class="empty">
          <span class="icon">history</span>
          <p>Belum ada entri audit.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class AuditLogsComponent {
  private readonly service = inject(AdminDataService);

  readonly audit = toSignal(this.service.getAudit(), { initialValue: [] as AuditRow[] });
  actionFilter = '';

  readonly filteredAudit = computed(() => {
    const list = this.audit();
    if (this.actionFilter === '') return list;
    return list.filter(a => a.action === this.actionFilter);
  });

  applyFilters(): void {}
}
