import type { DatabaseModels } from '../models/index.js';
import type { PostType } from '../models/category.model.js';
import { ensureAdminSeed } from './admin.js';

interface CategorySeed {
  readonly name: string;
  readonly slug: string;
  readonly postType: PostType;
  readonly icon: string;
  readonly sortOrder: number;
}

export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  { name: 'Elektronik', slug: 'elektronik', postType: 'sell', icon: 'devices', sortOrder: 10 },
  { name: 'Furnitur', slug: 'furnitur', postType: 'sell', icon: 'chair', sortOrder: 20 },
  { name: 'Pakaian & Aksesoris', slug: 'pakaian-aksesoris', postType: 'sell', icon: 'checkroom', sortOrder: 30 },
  { name: 'Buku & Alat Tulis', slug: 'buku-alat-tulis', postType: 'sell', icon: 'menu_book', sortOrder: 40 },
  { name: 'Peralatan Rumah', slug: 'peralatan-rumah', postType: 'sell', icon: 'home_repair_service', sortOrder: 50 },
  { name: 'Mainan & Hobi', slug: 'mainan-hobi', postType: 'sell', icon: 'toys', sortOrder: 60 },
  { name: 'Kendaraan', slug: 'kendaraan', postType: 'sell', icon: 'directions_bike', sortOrder: 70 },
  { name: 'Lainnya', slug: 'lainnya-jual', postType: 'sell', icon: 'more_horiz', sortOrder: 80 },
  { name: 'Komunitas', slug: 'komunitas', postType: 'event', icon: 'groups', sortOrder: 10 },
  { name: 'Olahraga', slug: 'olahraga', postType: 'event', icon: 'sports_soccer', sortOrder: 20 },
  { name: 'Musik & Seni', slug: 'musik-seni', postType: 'event', icon: 'music_note', sortOrder: 30 },
  { name: 'Bazaar & Pasar', slug: 'bazaar-pasar', postType: 'event', icon: 'storefront', sortOrder: 40 },
  { name: 'Info Warga', slug: 'info-warga', postType: 'information', icon: 'campaign', sortOrder: 10 },
  { name: 'Kehilangan & Temuan', slug: 'kehilangan-temuan', postType: 'information', icon: 'search', sortOrder: 20 },
  { name: 'Lowongan', slug: 'lowongan', postType: 'information', icon: 'work', sortOrder: 30 },
  { name: 'Layanan Umum', slug: 'layanan-umum', postType: 'information', icon: 'handshake', sortOrder: 40 },
];

interface SettingSeed {
  readonly key: string;
  readonly value: unknown;
}

export const APP_SETTING_SEEDS: readonly SettingSeed[] = [
  { key: 'app_name', value: 'C2C Nearby' },
  { key: 'tagline', value: 'Jual dekat. Beli dekat.' },
  { key: 'discovery_radius_m', value: 4000 },
  { key: 'max_listing_images', value: 8 },
  { key: 'listing_expiry_days', value: 30 },
  { key: 'event_lead_time_days', value: 90 },
  { key: 'report_auto_hide_threshold', value: 5 },
];

export async function runSeeders(models: DatabaseModels): Promise<void> {
  await ensureAdminSeed(models);

  for (const seed of CATEGORY_SEEDS) {
    const [record, created] = await models.Category.findOrCreate({
      where: { slug: seed.slug },
      defaults: {
        name: seed.name,
        slug: seed.slug,
        postType: seed.postType,
        icon: seed.icon,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    });
    if (!created) {
      await record.update({
        name: seed.name,
        postType: seed.postType,
        icon: seed.icon,
        sortOrder: seed.sortOrder,
      });
    }
  }

  for (const seed of APP_SETTING_SEEDS) {
    const [record, created] = await models.AppSetting.findOrCreate({
      where: { settingKey: seed.key },
      defaults: { settingKey: seed.key, value: seed.value },
    });
    if (!created) {
      await record.update({ value: seed.value });
    }
  }
}

export async function undoSeeders(models: DatabaseModels): Promise<void> {
  await models.Category.destroy({
    where: { slug: CATEGORY_SEEDS.map((seed) => seed.slug) },
  });
  await models.AppSetting.destroy({
    where: { settingKey: APP_SETTING_SEEDS.map((seed) => seed.key) },
  });
}
