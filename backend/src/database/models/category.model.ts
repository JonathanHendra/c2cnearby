import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export type PostType = 'sell' | 'event' | 'information';

export class Category extends Model<InferAttributes<Category>, InferCreationAttributes<Category>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare slug: string;
  declare postType: PostType;
  declare icon: string | null;
  declare imageUrl: string | null;
  declare isActive: CreationOptional<boolean>;
  declare sortOrder: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initCategoryModel(sequelize: Sequelize): void {
  Category.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: { type: DataTypes.STRING(80), allowNull: false },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      postType: { type: DataTypes.ENUM('sell', 'event', 'information'), allowNull: false },
      icon: { type: DataTypes.STRING(80), allowNull: true },
      imageUrl: { type: DataTypes.STRING(500), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'categories', ...MODEL_OPTIONS },
  );
}
