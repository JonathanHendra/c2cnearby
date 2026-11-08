import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export class Review extends Model<InferAttributes<Review>, InferCreationAttributes<Review>> {
  declare id: CreationOptional<string>;
  declare listingId: string;
  declare reviewerId: string;
  declare revieweeId: string;
  declare rating: number;
  declare review: string | null;
  declare hiddenAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initReviewModel(sequelize: Sequelize): void {
  Review.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      listingId: { type: DataTypes.CHAR(36), allowNull: false },
      reviewerId: { type: DataTypes.CHAR(36), allowNull: false },
      revieweeId: { type: DataTypes.CHAR(36), allowNull: false },
      rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
      review: { type: DataTypes.STRING(1000), allowNull: true },
      hiddenAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'reviews', ...MODEL_OPTIONS },
  );
}
