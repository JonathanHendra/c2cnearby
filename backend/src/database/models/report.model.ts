import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export type ReportReason = 'spam' | 'fraud' | 'prohibited' | 'harassment' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export class Report extends Model<InferAttributes<Report>, InferCreationAttributes<Report>> {
  declare id: CreationOptional<string>;
  declare reporterId: string;
  declare reportedUserId: string | null;
  declare listingId: string | null;
  declare reason: ReportReason;
  declare description: string | null;
  declare status: CreationOptional<ReportStatus>;
  declare resolutionNote: string | null;
  declare handledByAdminId: string | null;
  declare handledAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initReportModel(sequelize: Sequelize): void {
  Report.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      reporterId: { type: DataTypes.CHAR(36), allowNull: false },
      reportedUserId: { type: DataTypes.CHAR(36), allowNull: true },
      listingId: { type: DataTypes.CHAR(36), allowNull: true },
      reason: {
        type: DataTypes.ENUM('spam', 'fraud', 'prohibited', 'harassment', 'other'),
        allowNull: false,
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('open', 'reviewing', 'resolved', 'dismissed'),
        allowNull: false,
        defaultValue: 'open',
      },
      resolutionNote: { type: DataTypes.STRING(500), allowNull: true },
      handledByAdminId: { type: DataTypes.CHAR(36), allowNull: true },
      handledAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'reports', ...MODEL_OPTIONS },
  );
}
