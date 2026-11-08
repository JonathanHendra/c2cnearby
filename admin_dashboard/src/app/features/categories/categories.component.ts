import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/admin-data.service';
import type { CategoryRow, CategoryType } from '../../core/admin.models';
import { ToastService } from '../../core/toast.service';
import { StatusBadgeComponent } from '../../core/components/status-badge.component';
import { ModalComponent } from '../../core/components/modal.component';
import { ModalFooterComponent } from '../../core/components/modal-footer.component';

const TYPE_LABELS: Record<string, string> = {
  sell: 'Jual',
  event: 'Event',
  information: 'Informasi',
};

const TYPE_TONE: Record<string, string> = {
  sell: 'soft',
  event: 'info',
  information: 'neutral',
};

interface FormState {
  id: string;
  name: string;
  slug: string;
  type: CategoryType;
  active: boolean;
  sortOrder: number;
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  slug: '',
  type: 'sell',
  active: true,
  sortOrder: 1,
};

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent, ModalComponent, ModalFooterComponent],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">{{ categories().length }}</div>
        <div class="label">Total kategori</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ activeCount() }}</div>
        <div class="label">Aktif</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ totalListings() }}</div>
        <div class="label">Posting terkait</div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h3 class="panel-title">Kelola Kategori</h3>
        <button class="btn btn-primary btn-sm" (click)="openDialog()">
          <span class="ms">add</span>
          Tambah kategori
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Tipe</th>
              <th class="text-right">Posting</th>
              <th>Urutan</th>
              <th>Status</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (cat of categories(); track cat.id) {
              <tr>
                <td>
                  <a [routerLink]="['/kategori', cat.slug]" class="font-semibold">{{ cat.name }}</a>
                </td>
                <td class="text-sm">{{ TYPE_LABELS[cat.type] }}</td>
                <td class="text-sm">{{ cat.listings }}</td>
                <td class="text-sm">
                  <span class="text-secondary">{{ cat.sortOrder }}</span>
                </td>
                <td>
                  <app-status-badge
                    [label]="cat.active ? 'Aktif' : 'Nonaktif'"
                    [tone]="cat.active ? 'success' : 'neutral'"
                  />
                </td>
                <td class="flex gap-8 justify-content-between">
                  <div class="flex gap-8">
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="toggleActive(cat)"
                    >
                      <span class="ms">{{ cat.active ? 'visibility_off' : 'visibility' }}</span>
                      {{ cat.active ? 'Nonaktifkan' : 'Aktifkan' }}
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="edit(cat)"
                    >
                      <span class="ms">edit</span>
                      Edit
                    </button>
                  </div>
                  <button
                    class="btn btn-danger btn-sm"
                    (click)="remove(cat)"
                  >
                    <span class="ms">delete</span>
                    Hapus
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (categories().length === 0) {
        <div class="empty">
          <span class="icon">folder_open</span>
          <p>Belum ada kategori. Tambahkan kategori baru.</p>
        </div>
      }
    </div>

    <!-- Tambah / Edit dialog -->
    <app-modal
      [open]="dialogOpen()"
      [title]="editingId() ? 'Edit Kategori' : 'Tambah Kategori'"
      (dismiss)="closeDialog()"
    >
      <div class="space-y-6">
        <div class="grid grid-cols-2 gap-8">
          <div>
            <label class="field-label">Nama kategori</label>
            <input class="field" [(ngModel)]="form.name" name="name" placeholder="Contoh: Pakaian" />
          </div>
          <div>
            <label class="field-label">Tipe</label>
            <select class="field" [(ngModel)]="form.type" name="type">
              <option value="sell">Jual</option>
              <option value="event">Event</option>
              <option value="information">Informasi</option>
            </select>
          </div>
        </div>
        <div>
          <label class="field-label">Slug URL</label>
          <input class="field" [(ngModel)]="form.slug" name="slug" placeholder="contoh: pakaian" />
        </div>
        <div class="grid grid-cols-2 gap-8">
          <div>
            <label class="field-label">Urutan tampil</label>
            <input class="field" type="number" [(ngModel)]="form.sortOrder" name="sortOrder" />
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-6 cursor-pointer text-sm">
              <input
                type="checkbox"
                [(ngModel)]="form.active"
                name="active"
              />
              <span>Aktif di situs</span>
            </label>
          </div>
        </div>
      </div>
      <app-modal-footer
        footer
        [actions]="[
          { label: 'Batal', primary: false },
          { label: editingId() ? 'Simpan perubahan' : 'Tambah kategori', primary: true }
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
export class CategoriesComponent {
  private readonly service = inject(AdminDataService);
  private readonly toast = inject(ToastService);

  readonly TYPE_LABELS = TYPE_LABELS;
  readonly TYPE_TONE = TYPE_TONE;

  readonly categories = toSignal(this.service.getCategories(), {
    initialValue: [] as CategoryRow[],
  });

  readonly activeCount = computed(() => this.categories().filter(c => c.active).length);
  readonly totalListings = computed(() => this.categories().reduce((acc, c) => acc + c.listings, 0));

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  form: FormState = { ...EMPTY_FORM };

  openDialog(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM, sortOrder: this.nextOrder() };
    this.dialogOpen.set(true);
  }

  edit(cat: CategoryRow): void {
    this.editingId.set(cat.id);
    this.form = {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      type: cat.type,
      active: cat.active,
      sortOrder: cat.sortOrder,
    };
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.form = { ...EMPTY_FORM };
  }

  saveDialog(index: number): void {
    if (index !== 1) {
      this.closeDialog();
      return;
    }
    const name = this.form.name.trim();
    if (!name) {
      this.toast.error('Nama kategori wajib diisi');
      return;
    }
    const slug = (this.form.slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');
    const editingId = this.editingId();

    if (editingId) {
      const current = this.categories().find(c => c.id === editingId);
      this.service.updateCategory({
        id: editingId,
        name,
        slug,
        type: this.form.type,
        active: this.form.active,
        sortOrder: this.form.sortOrder,
        listings: current?.listings ?? 0,
      });
      this.toast.success('Kategori diperbarui');
    } else {
      this.service.addCategory({
        name,
        slug,
        type: this.form.type,
        active: this.form.active,
        sortOrder: this.form.sortOrder,
        listings: 0,
      });
      this.toast.success('Kategori ditambahkan');
    }
    this.closeDialog();
  }

  toggleActive(cat: CategoryRow): void {
    this.service.toggleCategoryActive(cat.id);
    this.toast.success(cat.active ? 'Kategori nonaktif' : 'Kategori diaktifkan');
  }

  remove(cat: CategoryRow): void {
    if (!confirm('Hapus kategori ini? Posting terkait akan terpengaruh.')) return;
    this.service.removeCategory(cat.id);
    this.toast.success('Kategori dihapus');
  }

  private nextOrder(): number {
    return this.categories().reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
  }
}
