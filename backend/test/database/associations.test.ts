import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../src/config/env.js';
import {
  ASSOCIATION_ALIASES,
  initializeAssociations,
  resetAssociationState,
} from '../../src/database/associations.js';
import { createSequelize } from '../../src/database/connection.js';
import { initializeModels, type DatabaseModels } from '../../src/database/models/index.js';
import type { Sequelize } from 'sequelize';

let sequelize: Sequelize;
let models: DatabaseModels;

beforeAll(() => {
  sequelize = createSequelize(loadConfig());
  models = initializeModels(sequelize);
  resetAssociationState();
});

afterAll(async () => {
  await sequelize.close();
});

describe('associations', () => {
  it('defines every documented alias and emits no SQL', () => {
    const querySpy = vi.spyOn(sequelize, 'query');
    initializeAssociations(models);

    expect(querySpy).not.toHaveBeenCalled();

    for (const [modelName, aliases] of Object.entries(ASSOCIATION_ALIASES)) {
      const model = models[modelName as keyof DatabaseModels];
      expect(model, `${modelName} tidak ada di registry`).toBeDefined();
      for (const alias of aliases) {
        expect(model.associations[alias], `${modelName}.${alias} tidak terdefinisi`).toBeDefined();
      }
    }

    querySpy.mockRestore();
  });

  it('is idempotent when initialized twice', () => {
    const before = Object.keys(models.Listing.associations).length;
    expect(() => initializeAssociations(models)).not.toThrow();
    expect(Object.keys(models.Listing.associations)).toHaveLength(before);
  });

  it('keeps constraints disabled so Sequelize never owns schema', () => {
    for (const model of Object.values(models)) {
      const associations = Object.values(model.associations) as unknown as Array<{
        options: { constraints?: boolean };
      }>;
      for (const association of associations) {
        expect(association.options.constraints).toBe(false);
      }
    }
  });

  it('uses the documented foreign keys', () => {
    expect(models.Listing.associations['images']?.foreignKey).toBe('listingId');
    expect(models.Listing.associations['seller']?.foreignKey).toBe('userId');
    expect(models.Conversation.associations['buyer']?.foreignKey).toBe('buyerId');
    expect(models.Review.associations['reviewer']?.foreignKey).toBe('reviewerId');
    expect(models.EventParticipant.associations['event']?.foreignKey).toBe('eventListingId');
  });
});
