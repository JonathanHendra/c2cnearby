import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminDataService } from '../../core/admin-data.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Pengaturan Aplikasi</h3>
        <span class="text-secondary text-sm">Kunci terisolasi dari pengguna biasa.</span>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label class="field-label" for="app-name">Nama aplikasi</label>
            <input
              id="app-name"
              class="field"
              formControlName="appName"
              placeholder="C2C Nearby"
            />
            @if (form.get('appName')?.invalid && form.get('appName')?.touched) {
              <p class="text-danger text-xs mt-2">Nama aplikasi wajib diisi.</p>
            }
          </div>
          <div>
            <label class="field-label" for="support-email">Email dukungan</label>
            <input
              id="support-email"
              class="field"
              type="email"
              formControlName="supportEmail"
              placeholder="support@c2cnearby.id"
            />
            @if (form.get('supportEmail')?.invalid && form.get('supportEmail')?.touched) {
              <p class="text-danger text-xs mt-2">Format email tidak valid.</p>
            }
          </div>
        </div>

        <div>
          <label class="field-label" for="radius">Radius pencarian (meter)</label>
          <input
            id="radius"
            class="field"
            type="number"
            formControlName="radius"
            min="100"
            max="10000"
            step="100"
          />
          <p class="text-secondary text-xs mt-2">
            Radius selalu 4.000 m ditentukan server; pengaturan ini dokumen saja.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label class="field-label">Mode perawakan</label>
            <select class="field" formControlName="maintenance">
              <option value="inactive">Aktif</option>
              <option value="maintenance">Pemeliharaan</option>
            </select>
          </div>
          <div>
            <label class="field-label">Moderasi otomatis</label>
            <select class="field" formControlName="autoModeration">
              <option value="high">Aggresif</option>
              <option value="medium">Standar</option>
              <option value="low">Sandaran</option>
            </select>
          </div>
        </div>

        <div class="flex gap-8">
          <button class="btn btn-primary" type="submit" [disabled]="form.invalid">
            <span class="ms">save</span>
            Simpan pengaturan
          </button>
          <p class="text-secondary text-xs">
            Data diterapkan ke database pengguna. Tidak mengirim ulang ke penyedia pihak ketiga.
          </p>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.group({
    appName: ['C2C Nearby', Validators.required],
    supportEmail: ['support@c2cnearby.id', [Validators.required, Validators.email]],
    radius: [4000],
    maintenance: ['inactive' as const],
    autoModeration: ['medium' as const],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.service.updateSettings({
      appName: value.appName ?? '',
      supportEmail: value.supportEmail ?? '',
      radius: value.radius ?? 4000,
      maintenance: value.maintenance ?? 'inactive',
      autoModeration: value.autoModeration ?? 'medium',
    });
    this.toast.success('Pengaturan disimpan ke database pengguna');
    this.toast.info('Ubah radius real ke API Fastify pada fase 3.');
  }
}
