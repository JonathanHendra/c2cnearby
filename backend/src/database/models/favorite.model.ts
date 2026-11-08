import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export class Favorite extends Model<InferAttributes<Favorite>, InferCreationAttributes<Favorite>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare listingId: string;
  declare createdAt: CreationOptional<Date>;
}

export function initFavoriteModel(sequelize: Sequelize): void {
  Favorite.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: { type: DataTypes.CHAR(36), allowNull: false },
      listingId: { type: DataTypes.CHAR(36), allowNull: false },
      createdAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'favorites', ...MODEL_OPTIONS, updatedAt: false },
  );
}
