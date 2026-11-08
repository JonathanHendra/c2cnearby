import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export class Notification extends Model<
  InferAttributes<Notification>,
  InferCreationAttributes<Notification>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare title: string;
  declare body: string;
  declare type: string;
  declare referenceId: string | null;
  declare readAt: Date | null;
  declare createdAt: CreationOptional<Date>;
}

export function initNotificationModel(sequelize: Sequelize): void {
  Notification.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: { type: DataTypes.CHAR(36), allowNull: false },
      title: { type: DataTypes.STRING(150), allowNull: false },
      body: { type: DataTypes.STRING(500), allowNull: false },
      type: { type: DataTypes.STRING(50), allowNull: false },
      referenceId: { type: DataTypes.CHAR(36), allowNull: true },
      readAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'notifications', ...MODEL_OPTIONS, updatedAt: false },
  );
}
