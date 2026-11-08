import { DataTypes, QueryTypes } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MODEL_COUNT, initializeModels } from '../../src/database/models/index.js';
import type { DatabaseModels } from '../../src/database/models/index.js';
import { createTestSequelize, ensureSchema } from '../helpers/database.js';
import type { Sequelize } from 'sequelize';

let sequelize: Sequelize;
let models: DatabaseModels;

const EXPECTED_TABLES: Record<string, string> = {
  User: 'users',
  UserLocation: 'user_locations',
  UserVerification: 'user_verifications',
  UserBlock: 'user_blocks',
  DeviceToken: 'device_tokens',
  NotificationPreference: 'notification_preferences',
  Category: 'categories',
  Listing: 'listings',
  ListingImage: 'listing_images',
  Favorite: 'favorites',
  Conversation: 'conversations',
  Message: 'messages',
  PriceOffer: 'price_offers',
  TransactionAgreement: 'transaction_agreements',
  EventParticipant: 'event_participants',
  Review: 'reviews',
  Report: 'reports',
  Notification: 'notifications',
  AdminUser: 'admin_users',
  AdminAuditLog: 'admin_audit_logs',
  AppSetting: 'app_settings',
};

beforeAll(async () => {
  sequelize = await createTestSequelize();
  await ensureSchema(sequelize);
  models = initializeModels(sequelize);
});

afterAll(async () => {
  await sequelize.close();
});

describe('model registry', () => {
  it('registers exactly 21 models', () => {
    expect(MODEL_COUNT).toBe(21);
    expect(Object.keys(models)).toHaveLength(21);
    expect(Object.keys(EXPECTED_TABLES)).toHaveLength(21);
    for (const modelName of Object.keys(EXPECTED_TABLES)) {
      expect(sequelize.models[modelName]).toBeDefined();
    }
  });

  it('maps every model to its documented snake_case table', () => {
    for (const [modelName, tableName] of Object.entries(EXPECTED_TABLES)) {
      const model = sequelize.models[modelName];
      expect(model, `${modelName} belum terdaftar`).toBeDefined();
      expect(model?.getTableName()).toBe(tableName);
      expect(model?.options.underscored).toBe(true);
      expect(model?.options.timestamps).toBe(true);
    }
  });

  it('uses CHAR(36) UUID primary keys and DECIMAL(15,2) for money', () => {
    const idType = models.User.getAttributes()['id']?.type;
    expect(idType).toBeInstanceOf(DataTypes.CHAR);
    expect(String(idType)).toContain('CHAR(36)');

    expect(String(models.Listing.getAttributes()['price']?.type)).toContain('DECIMAL(15,2)');
    expect(String(models.PriceOffer.getAttributes()['offeredPrice']?.type)).toContain('DECIMAL(15,2)');
    expect(String(models.TransactionAgreement.getAttributes()['agreedPrice']?.type)).toContain(
      'DECIMAL(15,2)',
    );
  });

  it('keeps private location and phone columns in the models', () => {
    expect(models.User.getAttributes()['phonePrivate']).toBeDefined();
    expect(String(models.UserLocation.getAttributes()['locationPrivate']?.type)).toContain('POINT');
    expect(String(models.Listing.getAttributes()['locationPrivate']?.type)).toContain('POINT');
  });

  it('matches the migrated columns one-to-one for every model', async () => {
    const rows = await sequelize.query<{ tableName: string; columnName: string }>(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
       FROM information_schema.columns WHERE table_schema = DATABASE()`,
      { type: QueryTypes.SELECT },
    );
    const byTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const columns = byTable.get(row.tableName) ?? new Set<string>();
      columns.add(row.columnName);
      byTable.set(row.tableName, columns);
    }

    for (const model of Object.values(models)) {
      const tableName = String(model.getTableName());
      const attributes = model.rawAttributes as Record<string, { field?: string }>;
      const expected = new Set(Object.values(attributes).map((attribute) => attribute.field ?? ''));
      const actual = byTable.get(tableName);
      expect(actual, `tabel ${tableName} tidak ada di database`).toBeDefined();
      if (!actual) {
        continue;
      }

      const missingInDb = [...expected].filter((column) => !actual.has(column));
      const missingInModel = [...actual].filter((column) => !expected.has(column));
      expect(missingInDb, `${tableName}: kolom model tanpa kolom DB`).toEqual([]);
      expect(missingInModel, `${tableName}: kolom DB tanpa atribut model`).toEqual([]);
    }
  });

  it('marks timestamp-less children correctly', () => {
    expect(models.Favorite.options.updatedAt).toBe(false);
    expect(models.Message.options.updatedAt).toBe(false);
    expect(models.Notification.options.updatedAt).toBe(false);
    expect(models.AdminAuditLog.options.updatedAt).toBe(false);
    expect(models.ListingImage.options.updatedAt).toBe(false);
    expect(models.UserBlock.options.updatedAt).toBe(false);
  });

});
