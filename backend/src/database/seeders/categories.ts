import type { DatabaseModels } from '../models/index.js';
import type { PostType } from '../models/category.model.js';

interface CategorySeed {
  readonly name: string;
  readonly slug: string;
  readonly type: PostType;
  readonly icon: string;
}

/**
 * Reference data, not sample content: the marketplace needs at least one active
 * category per post type before members can publish anything.
 */
const CATEGORY_SEEDS: readonly CategorySeed[] = [
  { name: 'Elektronik', slug: 'elektronik', type: 'sell', icon: 'devices' },
  { name: 'Pakaian', slug: 'pakaian', type: 'sell', icon: 'checkroom' },
  { name: 'Perabot', slug: 'perabot', type: 'sell', icon: 'chair' },
  { name: 'Kendaraan', slug: 'kendaraan', type: 'sell', icon: 'directions_bike' },
  { name: 'Tanaman', slug: 'tanaman', type: 'sell', icon: 'yard' },
  { name: 'Kuliner', slug: 'kuliner', type: 'sell', icon: 'restaurant' },
  { name: 'Jasa', slug: 'jasa', type: 'sell', icon: 'handyman' },
  { name: 'Komunitas', slug: 'komunitas', type: 'event', icon: 'groups' },
  { name: 'Seminar', slug: 'seminar', type: 'event', icon: 'school' },
  { name: 'Olahraga', slug: 'olahraga', type: 'event', icon: 'sports_soccer' },
  { name: 'Berita', slug: 'berita', type: 'information', icon: 'newspaper' },
  { name: 'Edukasi', slug: 'edukasi', type: 'information', icon: 'menu_book' },
];

/** Seeds only when the table is empty, so admin edits are never overwritten. */
export async function ensureCategorySeed(models: DatabaseModels): Promise<number> {
  const existing = await models.Category.count();
  if (existing > 0) {
    return 0;
  }

  await models.Category.bulkCreate(
    CATEGORY_SEEDS.map((seed, index) => ({
      name: seed.name,
      slug: seed.slug,
      postType: seed.type,
      icon: seed.icon,
      imageUrl: null,
      isActive: true,
      sortOrder: index + 1,
    })),
    {},
  );

  return CATEGORY_SEEDS.length;
}
