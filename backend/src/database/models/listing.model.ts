import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';
import type { PostType } from './category.model.js';

export type PriceType = 'fixed' | 'negotiable';
export type ListingCondition = 'new' | 'used';
export type ListingStatus =
  | 'draft'
  | 'active'
  | 'hidden'
  | 'sold'
  | 'completed'
  | 'rejected'
  | 'expired';

export class Listing extends Model<InferAttributes<Listing>, InferCreationAttributes<Listing>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare postType: PostType;
  declare categoryId: string | null;
  declare title: string;
  declare slug: string;
  declare description: string;
  declare price: string | null;
  declare priceType: PriceType | null;
  declare condition: ListingCondition | null;
  declare brand: string | null;
  declare locationPrivate: unknown;
  declare locationPublicLabel: string;
  declare eventStart: Date | null;
  declare eventEnd: Date | null;
  declare eventLocationPublic: string | null;
  declare eventIsFree: boolean | null;
  declare eventLink: string | null;
  declare informationLink: string | null;
  declare status: CreationOptional<ListingStatus>;
  declare publishedAt: Date | null;
  declare expiresAt: Date | null;
  declare viewCount: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: Date | null;
}

export class ListingImage extends Model<
  InferAttributes<ListingImage>,
  InferCreationAttributes<ListingImage>
> {
  declare id: CreationOptional<string>;
  declare listingId: string;
  declare imageUrl: string;
  declare thumbnailUrl: string;
  declare width: number | null;
  declare height: number | null;
  declare sortOrder: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
}

export function initListingModels(sequelize: Sequelize): void {
  Listing.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: { type: DataTypes.CHAR(36), allowNull: false },
      postType: { type: DataTypes.ENUM('sell', 'event', 'information'), allowNull: false },
      categoryId: { type: DataTypes.CHAR(36), allowNull: true },
      title: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(190), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: false },
      price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      priceType: { type: DataTypes.ENUM('fixed', 'negotiable'), allowNull: true },
      condition: { type: DataTypes.ENUM('new', 'used'), allowNull: true },
      brand: { type: DataTypes.STRING(80), allowNull: true },
      locationPrivate: { type: DataTypes.GEOMETRY('POINT', 4326), allowNull: false },
      locationPublicLabel: { type: DataTypes.STRING(150), allowNull: false },
      eventStart: { type: DataTypes.DATE(3), allowNull: true },
      eventEnd: { type: DataTypes.DATE(3), allowNull: true },
      eventLocationPublic: { type: DataTypes.STRING(255), allowNull: true },
      eventIsFree: { type: DataTypes.BOOLEAN, allowNull: true },
      eventLink: { type: DataTypes.STRING(500), allowNull: true },
      informationLink: { type: DataTypes.STRING(500), allowNull: true },
      status: {
        type: DataTypes.ENUM(
          'draft',
          'active',
          'hidden',
          'sold',
          'completed',
          'rejected',
          'expired',
        ),
        allowNull: false,
        defaultValue: 'draft',
      },
      publishedAt: { type: DataTypes.DATE(3), allowNull: true },
      expiresAt: { type: DataTypes.DATE(3), allowNull: true },
      viewCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
      deletedAt: { type: DataTypes.DATE(3), allowNull: true },
    },
    { sequelize, tableName: 'listings', ...MODEL_OPTIONS },
  );

  ListingImage.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      listingId: { type: DataTypes.CHAR(36), allowNull: false },
      imageUrl: { type: DataTypes.STRING(500), allowNull: false },
      thumbnailUrl: { type: DataTypes.STRING(500), allowNull: false },
      width: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      height: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'listing_images', ...MODEL_OPTIONS, updatedAt: false },
  );
}
