import type { Sequelize } from 'sequelize';

import { AdminAuditLog, AdminUser, AppSetting, initAdminModels } from './admin.model.js';
import { Category, initCategoryModel } from './category.model.js';
import {
  Conversation,
  initConversationModels,
  Message,
  PriceOffer,
  TransactionAgreement,
} from './conversation.model.js';
import { EventParticipant, initEventParticipantModel } from './event-participant.model.js';
import { Favorite, initFavoriteModel } from './favorite.model.js';
import { initListingModels, Listing, ListingImage } from './listing.model.js';
import { initNotificationModel, Notification } from './notification.model.js';
import { initReportModel, Report } from './report.model.js';
import { initReviewModel, Review } from './review.model.js';
import {
  DeviceToken,
  initUserModels,
  NotificationPreference,
  User,
  UserBlock,
  UserLocation,
  UserVerification,
} from './user.model.js';

export interface DatabaseModels {
  readonly User: typeof User;
  readonly UserLocation: typeof UserLocation;
  readonly UserVerification: typeof UserVerification;
  readonly UserBlock: typeof UserBlock;
  readonly DeviceToken: typeof DeviceToken;
  readonly NotificationPreference: typeof NotificationPreference;
  readonly Category: typeof Category;
  readonly Listing: typeof Listing;
  readonly ListingImage: typeof ListingImage;
  readonly Favorite: typeof Favorite;
  readonly Conversation: typeof Conversation;
  readonly Message: typeof Message;
  readonly PriceOffer: typeof PriceOffer;
  readonly TransactionAgreement: typeof TransactionAgreement;
  readonly EventParticipant: typeof EventParticipant;
  readonly Review: typeof Review;
  readonly Report: typeof Report;
  readonly Notification: typeof Notification;
  readonly AdminUser: typeof AdminUser;
  readonly AdminAuditLog: typeof AdminAuditLog;
  readonly AppSetting: typeof AppSetting;
}

export const MODEL_COUNT = 21;

/**
 * Registers every model on the sequelize instance exactly once per instance.
 * Associations are NOT defined here; see `associations.ts`.
 */
export function initializeModels(sequelize: Sequelize): DatabaseModels {
  initUserModels(sequelize);
  initCategoryModel(sequelize);
  initListingModels(sequelize);
  initFavoriteModel(sequelize);
  initConversationModels(sequelize);
  initEventParticipantModel(sequelize);
  initReviewModel(sequelize);
  initReportModel(sequelize);
  initNotificationModel(sequelize);
  initAdminModels(sequelize);

  const models: DatabaseModels = {
    User,
    UserLocation,
    UserVerification,
    UserBlock,
    DeviceToken,
    NotificationPreference,
    Category,
    Listing,
    ListingImage,
    Favorite,
    Conversation,
    Message,
    PriceOffer,
    TransactionAgreement,
    EventParticipant,
    Review,
    Report,
    Notification,
    AdminUser,
    AdminAuditLog,
    AppSetting,
  };

  // Other registries (for example umzug's SequelizeMeta) may share the connection,
  // so validate our own models instead of the total model count.
  const registered = Object.values(models).filter(
    (model) => sequelize.models[model.name] === model,
  ).length;
  if (registered !== MODEL_COUNT) {
    throw new Error(
      `Model registry tidak lengkap: terdaftar ${registered} dari ${MODEL_COUNT} model.`,
    );
  }

  return models;
}

export {
  AdminAuditLog,
  AdminUser,
  AppSetting,
  Category,
  Conversation,
  DeviceToken,
  EventParticipant,
  Favorite,
  Listing,
  ListingImage,
  Message,
  Notification,
  NotificationPreference,
  PriceOffer,
  Report,
  Review,
  TransactionAgreement,
  User,
  UserBlock,
  UserLocation,
  UserVerification,
};
