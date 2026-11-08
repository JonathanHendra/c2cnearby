import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'moderator'
  | 'verification_manager'
  | 'support';

export class AdminUser extends Model<
  InferAttributes<AdminUser>,
  InferCreationAttributes<AdminUser>
> {
  declare id: CreationOptional<string>;
  declare firebaseUid: string;
  declare email: string | null;
  declare passwordHash: string | null;
  declare role: AdminRole;
  declare isActive: CreationOptional<boolean>;
  declare lastLoginAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class AdminAuditLog extends Model<
  InferAttributes<AdminAuditLog>,
  InferCreationAttributes<AdminAuditLog>
> {
  declare id: CreationOptional<string>;
  declare adminId: string | null;
  declare action: string;
  declare targetType: string;
  declare targetId: string | null;
  declare metadata: Record<string, unknown> | null;
  declare ipAddress: string | null;
  declare createdAt: CreationOptional<Date>;
}

export class AppSetting extends Model<
  InferAttributes<AppSetting>,
  InferCreationAttributes<AppSetting>
> {
  declare id: CreationOptional<string>;
  declare settingKey: string;
  declare value: unknown;
  declare updatedByAdminId: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initAdminModels(sequelize: Sequelize): void {
  AdminUser.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      firebaseUid: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(190), allowNull: true, unique: true },
      passwordHash: { type: DataTypes.STRING(128), allowNull: true },
      role: {
        type: DataTypes.ENUM(
          'super_admin',
          'admin',
          'moderator',
          'verification_manager',
          'support',
        ),
        allowNull: false,
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastLoginAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'admin_users', ...MODEL_OPTIONS },
  );

  AdminAuditLog.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      adminId: { type: DataTypes.CHAR(36), allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false },
      targetType: { type: DataTypes.STRING(50), allowNull: false },
      targetId: { type: DataTypes.CHAR(36), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      ipAddress: { type: DataTypes.STRING(45), allowNull: true },
      createdAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'admin_audit_logs', ...MODEL_OPTIONS, updatedAt: false },
  );

  AppSetting.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      settingKey: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      value: { type: DataTypes.JSON, allowNull: false },
      updatedByAdminId: { type: DataTypes.CHAR(36), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'app_settings', ...MODEL_OPTIONS },
  );
}
