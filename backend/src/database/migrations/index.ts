import { migration as createAdmin } from './20261105011000-create-admin.js';
import { migration as createCategories } from './20261105010200-create-categories.js';
import { migration as createConversations } from './20261105010500-create-conversations.js';
import { migration as createEventParticipants } from './20261105010600-create-event-participants.js';
import { migration as createFavorites } from './20261105010400-create-favorites.js';
import { migration as createListings } from './20261105010300-create-listings.js';
import { migration as createNotifications } from './20261105010900-create-notifications.js';
import { migration as createReports } from './20261105010800-create-reports.js';
import { migration as createReviews } from './20261105010700-create-reviews.js';
import { migration as createUsers } from './20261105010100-create-users.js';
import { migration as addForeignKeys } from './20261105011100-add-foreign-keys.js';
import { migration as addUserAccountLifecycle } from './20261105011200-add-user-account-lifecycle.js';
import { migration as addListingViewCount } from './20261106010100-add-listing-view-count.js';
import { migration as addAdminEmailPassword } from './20261106012000-add-admin-email-password.js';
import { migration as addReviewHiddenAt } from './20261107009000-add-review-hidden-at.js';
import type { Migration } from './types.js';

export const migrations: readonly Migration[] = [
  createUsers,
  createCategories,
  createListings,
  createFavorites,
  createConversations,
  createEventParticipants,
  createReviews,
  createReports,
  createNotifications,
  createAdmin,
  addForeignKeys,
  addUserAccountLifecycle,
  addListingViewCount,
  addAdminEmailPassword,
  addReviewHiddenAt,
];

export type { Migration, MigrationParams } from './types.js';
