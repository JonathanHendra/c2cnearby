import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { ReportRow, ReportStatus } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

const STATUS_LABELS: Record<string, string> = {
  open: 'Buka',
  reviewing: 'Menilai',
  resolved: 'Terselesaikan',
  dismissed: 'Dibatalkan',
};

const STATUS_TONE: Record<string, string> = {
  open: 'warning',
  reviewing: 'info',
  resolved: 'success',
  dismissed: 'neutral',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ reports().length }}</div>
        <div class="label">Total laporan</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ openCount() }}</div>
        <div class="label">Buka</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ resolvedCount() }}</div>
        <div class="label">Terselesaikan</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Laporan Pengguna</h3>
        <div class="flex align-items-center gap-8">
          <select class="filter-select" [(ngModel)]="statusFilter" (change)="applyFilters()">
            <option value="">Semua status</option>
            <option value="open">Buka</option>
            <option value="reviewing">Menilai</option>
            <option value="resolved">Terselesaikan</option>
            <option value="dismissed">Dibatalkan</option>
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Pelapor</th>
              <th>Target</th>
              <th>Iklan</th>
              <th>Alasan</th>
              <th>Dibuat</th>
              <th>Status</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (report of filteredReports(); track report.id) {
              <tr>
                <td>{{ report.reporter }}</td>
                <td>
                  <a [routerLink]="['/laporan', report.target]" class="flex align-items-center gap-8">
                    <span class="avatar" style="width:28px;height:28px;font-size:11px;">{{ initials(report.target) }}</span>
                    <span class="font-semibold">{{ report.target }}</span>
                  </a>
                </td>
                <td class="text-sm">{{ report.listingTitle }}</td>
                <td class="text-sm">{{ report.reason }}</td>
                <td class="text-sm">{{ report.createdAt }}</td>
                <td>
                  <app-status-badge [label]="STATUS_LABELS[report.status]" [tone]="STATUS_TONE[report.status]" />
                </td>
                <td class="flex gap-8 justify-content-between">
                  @if (report.status === 'open' || report.status === 'reviewing') {
                    <div class="flex gap-8">
                      <button
                        class="btn btn-primary btn-sm"
                        (click)="resolve(report, 'resolved')"
                      >
                        <span class="ms">check_circle</span>
                        Selesaikan
                      </button>
                      <button
                        class="btn btn-ghost btn-sm"
                        (click)="resolve(report, 'dismissed')"
                      >
                        <span class="ms">cancel</span>
                        Batalkan
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

      @if (filteredReports().length === 0) {
        <div class="empty">
          <span class="icon">flag_off</span>
          <p>Tidak ada laporan yang cocok.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ReportsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_TONE = STATUS_TONE;

  readonly reports = toSignal(this.service.getReports(), { initialValue: [] as ReportRow[] });
  statusFilter = '';

  readonly filteredReports = computed(() => {
    const list = this.reports();
    if (this.statusFilter === '') return list;
    return list.filter(r => r.status === this.statusFilter);
  });

  readonly openCount = computed(() => this.reports().filter(r => r.status === 'open').length);
  readonly resolvedCount = computed(() => this.reports().filter(r => r.status === 'resolved').length);

  applyFilters(): void {}

  resolve(report: ReportRow, status: ReportStatus): void {
    this.service.resolveReport(report.id, status);
    this.toast.success(`Laporan "${report.target}" diselesaikan`);
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }
}
