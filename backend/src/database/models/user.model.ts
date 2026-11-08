import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export type FaceVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';
export type VerificationType = 'phone' | 'face' | 'email';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export type DevicePlatform = 'android' | 'ios' | 'web';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare firebaseUid: string;
  declare username: string;
  declare usernameChosenAt: Date | null;
  declare displayName: string | null;
  declare fullName: string | null;
  declare avatarUrl: string | null;
  declare bio: string | null;
  declare areaLabel: string | null;
  declare phonePrivate: string | null;
  declare phoneVerified: CreationOptional<boolean>;
  declare faceVerificationStatus: CreationOptional<FaceVerificationStatus>;
  declare profileCompleted: CreationOptional<boolean>;
  declare accountStatus: CreationOptional<AccountStatus>;
  declare deletionRequestedAt: Date | null;
  declare lastActiveAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: Date | null;
}

export class UserLocation extends Model<
  InferAttributes<UserLocation>,
  InferCreationAttributes<UserLocation>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare locationPrivate: unknown;
  declare areaLabel: string | null;
  declare locationUpdatedAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class UserVerification extends Model<
  InferAttributes<UserVerification>,
  InferCreationAttributes<UserVerification>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare verificationType: VerificationType;
  declare provider: string;
  declare providerReference: string | null;
  declare status: CreationOptional<VerificationStatus>;
  declare verifiedAt: Date | null;
  declare expiresAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class UserBlock extends Model<InferAttributes<UserBlock>, InferCreationAttributes<UserBlock>> {
  declare id: CreationOptional<string>;
  declare blockerId: string;
  declare blockedId: string;
  declare createdAt: CreationOptional<Date>;
}

export class DeviceToken extends Model<
  InferAttributes<DeviceToken>,
  InferCreationAttributes<DeviceToken>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare token: string;
  declare platform: DevicePlatform;
  declare lastUsedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class NotificationPreference extends Model<
  InferAttributes<NotificationPreference>,
  InferCreationAttributes<NotificationPreference>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare type: string;
  declare pushEnabled: CreationOptional<boolean>;
  declare inAppEnabled: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const uuidPrimaryKey = {
  type: DataTypes.CHAR(36),
  primaryKey: true,
  defaultValue: DataTypes.UUIDV4,
} as const;

export function initUserModels(sequelize: Sequelize): void {
  User.init(
    {
      id: uuidPrimaryKey,
      firebaseUid: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      username: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      usernameChosenAt: { type: DataTypes.DATE(3), allowNull: true },
      displayName: { type: DataTypes.STRING(100), allowNull: true },
      fullName: { type: DataTypes.STRING(120), allowNull: true },
      avatarUrl: { type: DataTypes.STRING(500), allowNull: true },
      bio: { type: DataTypes.STRING(280), allowNull: true },
      areaLabel: { type: DataTypes.STRING(120), allowNull: true },
      phonePrivate: { type: DataTypes.STRING(20), allowNull: true },
      phoneVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      faceVerificationStatus: {
        type: DataTypes.ENUM('unverified', 'pending', 'verified', 'rejected'),
        allowNull: false,
        defaultValue: 'unverified',
      },
      profileCompleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      accountStatus: {
        type: DataTypes.ENUM('active', 'suspended', 'deactivated'),
        allowNull: false,
        defaultValue: 'active',
      },
      deletionRequestedAt: { type: DataTypes.DATE(3), allowNull: true },
      lastActiveAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
      deletedAt: { type: DataTypes.DATE(3), allowNull: true },
    },
    { sequelize, tableName: 'users', ...MODEL_OPTIONS },
  );

  UserLocation.init(
    {
      id: uuidPrimaryKey,
      userId: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
      locationPrivate: { type: DataTypes.GEOMETRY('POINT', 4326), allowNull: false },
      areaLabel: { type: DataTypes.STRING(120), allowNull: true },
      locationUpdatedAt: { type: DataTypes.DATE(3), allowNull: false },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'user_locations', ...MODEL_OPTIONS },
  );

  UserVerification.init(
    {
      id: uuidPrimaryKey,
      userId: { type: DataTypes.CHAR(36), allowNull: false },
      verificationType: {
        type: DataTypes.ENUM('phone', 'face', 'email'),
        allowNull: false,
      },
      provider: { type: DataTypes.STRING(50), allowNull: false },
      providerReference: { type: DataTypes.STRING(190), allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'verified', 'rejected', 'expired'),
        allowNull: false,
        defaultValue: 'pending',
      },
      verifiedAt: { type: DataTypes.DATE(3), allowNull: true },
      expiresAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'user_verifications', ...MODEL_OPTIONS },
  );

  UserBlock.init(
    {
      id: uuidPrimaryKey,
      blockerId: { type: DataTypes.CHAR(36), allowNull: false },
      blockedId: { type: DataTypes.CHAR(36), allowNull: false },
      createdAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'user_blocks', ...MODEL_OPTIONS, updatedAt: false },
  );

  DeviceToken.init(
    {
      id: uuidPrimaryKey,
      userId: { type: DataTypes.CHAR(36), allowNull: false },
      token: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      platform: { type: DataTypes.ENUM('android', 'ios', 'web'), allowNull: false },
      lastUsedAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'device_tokens', ...MODEL_OPTIONS },
  );

  NotificationPreference.init(
    {
      id: uuidPrimaryKey,
      userId: { type: DataTypes.CHAR(36), allowNull: false },
      type: { type: DataTypes.STRING(50), allowNull: false },
      pushEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      inAppEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'notification_preferences', ...MODEL_OPTIONS },
  );
}
