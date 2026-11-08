import type { Model, ModelStatic } from 'sequelize';

import type { DatabaseModels } from './models/index.js';

type LinkKind = 'hasOne' | 'hasMany' | 'belongsTo';

let initialized = false;

function link<S extends Model, T extends Model>(
  source: ModelStatic<S>,
  target: ModelStatic<T>,
  kind: LinkKind,
  as: string,
  foreignKey: string,
): void {
  const options = { as, foreignKey, constraints: false } as const;
  switch (kind) {
    case 'hasOne':
      source.hasOne(target, options);
      break;
    case 'hasMany':
      source.hasMany(target, options);
      break;
    case 'belongsTo':
      source.belongsTo(target, options);
      break;
  }
}

/**
 * Defines all associations exactly once. Foreign keys are declared as model
 * attribute names (`userId`); Sequelize maps them to `user_id` columns because
 * models use `underscored: true`. `constraints: false` keeps DDL ownership in
 * migrations.
 */
export function initializeAssociations(models: DatabaseModels): void {
  if (initialized) {
    return;
  }
  initialized = true;

  const {
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
  } = models;

  // User identity
  link(User, UserLocation, 'hasOne', 'location', 'userId');
  link(UserLocation, User, 'belongsTo', 'user', 'userId');
  link(User, UserVerification, 'hasMany', 'verifications', 'userId');
  link(UserVerification, User, 'belongsTo', 'user', 'userId');

  // Listings
  link(User, Listing, 'hasMany', 'listings', 'userId');
  link(Listing, User, 'belongsTo', 'seller', 'userId');
  link(Category, Listing, 'hasMany', 'listings', 'categoryId');
  link(Listing, Category, 'belongsTo', 'category', 'categoryId');
  link(Listing, ListingImage, 'hasMany', 'images', 'listingId');
  link(ListingImage, Listing, 'belongsTo', 'listing', 'listingId');

  // Favorites
  link(User, Favorite, 'hasMany', 'favorites', 'userId');
  link(Listing, Favorite, 'hasMany', 'favorites', 'listingId');
  link(Favorite, User, 'belongsTo', 'user', 'userId');
  link(Favorite, Listing, 'belongsTo', 'listing', 'listingId');

  // Chat
  link(Listing, Conversation, 'hasMany', 'conversations', 'listingId');
  link(Conversation, Listing, 'belongsTo', 'listing', 'listingId');
  link(User, Conversation, 'hasMany', 'conversationsAsBuyer', 'buyerId');
  link(User, Conversation, 'hasMany', 'conversationsAsSeller', 'sellerId');
  link(Conversation, User, 'belongsTo', 'buyer', 'buyerId');
  link(Conversation, User, 'belongsTo', 'seller', 'sellerId');
  link(Conversation, Message, 'hasMany', 'messages', 'conversationId');
  link(Message, Conversation, 'belongsTo', 'conversation', 'conversationId');
  link(Message, User, 'belongsTo', 'sender', 'senderId');

  // Offers and agreements
  link(Conversation, PriceOffer, 'hasMany', 'offers', 'conversationId');
  link(PriceOffer, Conversation, 'belongsTo', 'conversation', 'conversationId');
  link(Listing, PriceOffer, 'hasMany', 'offers', 'listingId');
  link(PriceOffer, Listing, 'belongsTo', 'listing', 'listingId');
  link(PriceOffer, User, 'belongsTo', 'sender', 'senderId');
  link(PriceOffer, User, 'belongsTo', 'receiver', 'receiverId');
  link(Conversation, TransactionAgreement, 'hasOne', 'agreement', 'conversationId');
  link(TransactionAgreement, Conversation, 'belongsTo', 'conversation', 'conversationId');
  link(Listing, TransactionAgreement, 'hasOne', 'agreement', 'listingId');
  link(TransactionAgreement, Listing, 'belongsTo', 'listing', 'listingId');
  link(User, TransactionAgreement, 'hasMany', 'agreementsAsBuyer', 'buyerId');
  link(User, TransactionAgreement, 'hasMany', 'agreementsAsSeller', 'sellerId');
  link(TransactionAgreement, User, 'belongsTo', 'buyer', 'buyerId');
  link(TransactionAgreement, User, 'belongsTo', 'seller', 'sellerId');

  // Events
  link(Listing, EventParticipant, 'hasMany', 'participants', 'eventListingId');
  link(EventParticipant, Listing, 'belongsTo', 'event', 'eventListingId');
  link(User, EventParticipant, 'hasMany', 'eventParticipations', 'userId');
  link(EventParticipant, User, 'belongsTo', 'user', 'userId');

  // Reviews
  link(Listing, Review, 'hasMany', 'reviews', 'listingId');
  link(Review, Listing, 'belongsTo', 'listing', 'listingId');
  link(User, Review, 'hasMany', 'reviewsWritten', 'reviewerId');
  link(User, Review, 'hasMany', 'reviewsReceived', 'revieweeId');
  link(Review, User, 'belongsTo', 'reviewer', 'reviewerId');
  link(Review, User, 'belongsTo', 'reviewee', 'revieweeId');

  // Reports
  link(User, Report, 'hasMany', 'reportsFiled', 'reporterId');
  link(User, Report, 'hasMany', 'reportsReceived', 'reportedUserId');
  link(Report, User, 'belongsTo', 'reporter', 'reporterId');
  link(Report, User, 'belongsTo', 'reportedUser', 'reportedUserId');
  link(Listing, Report, 'hasMany', 'reports', 'listingId');
  link(Report, Listing, 'belongsTo', 'listing', 'listingId');
  link(AdminUser, Report, 'hasMany', 'handledReports', 'handledByAdminId');
  link(Report, AdminUser, 'belongsTo', 'handledBy', 'handledByAdminId');

  // Blocks
  link(User, UserBlock, 'hasMany', 'blocksCreated', 'blockerId');
  link(User, UserBlock, 'hasMany', 'blocksReceived', 'blockedId');
  link(UserBlock, User, 'belongsTo', 'blocker', 'blockerId');
  link(UserBlock, User, 'belongsTo', 'blocked', 'blockedId');

  // Notifications and devices
  link(User, Notification, 'hasMany', 'notifications', 'userId');
  link(Notification, User, 'belongsTo', 'user', 'userId');
  link(User, DeviceToken, 'hasMany', 'deviceTokens', 'userId');
  link(DeviceToken, User, 'belongsTo', 'user', 'userId');
  link(User, NotificationPreference, 'hasMany', 'notificationPreferences', 'userId');
  link(NotificationPreference, User, 'belongsTo', 'user', 'userId');

  // Admin
  link(AdminUser, AdminAuditLog, 'hasMany', 'auditLogs', 'adminId');
  link(AdminAuditLog, AdminUser, 'belongsTo', 'admin', 'adminId');
  link(AdminUser, AppSetting, 'hasMany', 'updatedSettings', 'updatedByAdminId');
  link(AppSetting, AdminUser, 'belongsTo', 'updatedBy', 'updatedByAdminId');
}

/** Test-only hook so a fresh registry can be verified in isolation. */
export function resetAssociationState(): void {
  initialized = false;
}

export const ASSOCIATION_ALIASES: Readonly<Record<string, readonly string[]>> = {
  User: [
    'location',
    'verifications',
    'listings',
    'favorites',
    'conversationsAsBuyer',
    'conversationsAsSeller',
    'agreementsAsBuyer',
    'agreementsAsSeller',
    'eventParticipations',
    'reviewsWritten',
    'reviewsReceived',
    'reportsFiled',
    'reportsReceived',
    'blocksCreated',
    'blocksReceived',
    'notifications',
    'deviceTokens',
    'notificationPreferences',
  ],
  UserLocation: ['user'],
  UserVerification: ['user'],
  Listing: [
    'seller',
    'category',
    'images',
    'favorites',
    'conversations',
    'offers',
    'agreement',
    'participants',
    'reviews',
    'reports',
  ],
  Category: ['listings'],
  ListingImage: ['listing'],
  Favorite: ['user', 'listing'],
  Conversation: ['listing', 'buyer', 'seller', 'messages', 'offers', 'agreement'],
  Message: ['conversation', 'sender'],
  PriceOffer: ['conversation', 'listing', 'sender', 'receiver'],
  TransactionAgreement: ['conversation', 'listing', 'buyer', 'seller'],
  EventParticipant: ['event', 'user'],
  Review: ['listing', 'reviewer', 'reviewee'],
  Report: ['reporter', 'reportedUser', 'listing', 'handledBy'],
  UserBlock: ['blocker', 'blocked'],
  Notification: ['user'],
  DeviceToken: ['user'],
  NotificationPreference: ['user'],
  AdminUser: ['handledReports', 'auditLogs', 'updatedSettings'],
  AdminAuditLog: ['admin'],
  AppSetting: ['updatedBy'],
};
