import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { AgreementRow, AgreementStatus } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';

const STATUS_LABELS: Record<string, string> = {
  negotiating: 'Negosiasi',
  agreed: 'Sepakat',
  meetup_scheduled: 'Rapat dijadwalkan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  disputed: 'Terdissertasi',
};

const STATUS_TONE: Record<string, string> = {
  negotiating: 'warning',
  agreed: 'success',
  meetup_scheduled: 'info',
  completed: 'neutral',
  cancelled: 'danger',
  disputed: 'danger',
};

@Component({
  selector: 'app-agreements',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Kesepakatan & Risiko</h3>
        <span class="text-secondary text-sm">
          Jejak transaksi antar pengguna. Perhatian khusus terhadap kesepakatan yang menyimpang.
        </span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Penjual</th>
              <th>Pembeli</th>
              <th>Harga</th>
              <th>Status</th>
              <th>Rapat</th>
              <th>Terakhir</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (item of agreements(); track item.id) {
              <tr>
                <td>
                  <a [routerLink]="['/kesepakatan', item.id]" class="text-[#1b5cff] font-semibold block">{{ item.listing }}</a>
                </td>
                <td class="text-sm">{{ item.seller }}</td>
                <td>
                  <a [routerLink]="['/kesepakatan', item.id]" class="flex align-items-center gap-8">
                    <span class="avatar" style="width:28px;height:28px;font-size:11px;">{{ initials(item.buyer) }}</span>
                    {{ item.buyer }}
                  </a>
                </td>
                <td class="text-sm">{{ item.price | currency:'Rp' }}</td>
                <td>
                  <app-status-badge [label]="STATUS_LABELS[item.status]" [tone]="STATUS_TONE[item.status]" />
                </td>
                <td class="text-sm">{{ item.meetup }}</td>
                <td class="text-sm">{{ item.updatedAt }}</td>
                <td class="flex gap-8 justify-content-between">
                  <div class="flex gap-8">
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="updateStatus(item, 'completed')"
                    >
                      <span class="ms">check_circle</span>
                      Tandai selesai
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="updateStatus(item, 'cancelled')"
                    >
                      <span class="ms">cancel</span>
                      Batalkan
                    </button>
                  </div>
                  <a [routerLink]="['/kesepakatan', item.id]" class="btn btn-primary btn-sm">
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
  `],
})
export class AgreementsComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_TONE = STATUS_TONE;

  readonly agreements = toSignal(this.service.getAgreements(), {
    initialValue: [] as AgreementRow[],
  });

  updateStatus(item: AgreementRow, status: AgreementStatus): void {
    this.service.updateAgreement(item.id, status);
    this.toast.success(`Kesepakatan "${item.listing}" diubah ke ${STATUS_LABELS[status]}`);
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }
}
