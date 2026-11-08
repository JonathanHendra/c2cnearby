import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export type MessageType = 'text' | 'image' | 'offer' | 'meetup' | 'system';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
export type AgreementStatus =
  | 'negotiating'
  | 'agreed'
  | 'meetup_scheduled'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export class Conversation extends Model<
  InferAttributes<Conversation>,
  InferCreationAttributes<Conversation>
> {
  declare id: CreationOptional<string>;
  declare listingId: string;
  declare buyerId: string;
  declare sellerId: string;
  declare lastMessageAt: Date | null;
  declare lastMessagePreview: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<string>;
  declare conversationId: string;
  declare senderId: string;
  declare messageType: MessageType;
  declare content: string | null;
  declare mediaUrl: string | null;
  declare readAt: Date | null;
  declare createdAt: CreationOptional<Date>;
}

export class PriceOffer extends Model<
  InferAttributes<PriceOffer>,
  InferCreationAttributes<PriceOffer>
> {
  declare id: CreationOptional<string>;
  declare conversationId: string;
  declare listingId: string;
  declare senderId: string;
  declare receiverId: string;
  declare offeredPrice: string;
  declare status: CreationOptional<OfferStatus>;
  declare expiresAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class TransactionAgreement extends Model<
  InferAttributes<TransactionAgreement>,
  InferCreationAttributes<TransactionAgreement>
> {
  declare id: CreationOptional<string>;
  declare listingId: string;
  declare conversationId: string;
  declare buyerId: string;
  declare sellerId: string;
  declare agreedPrice: string;
  declare meetupLocationPublic: string | null;
  declare meetupAt: Date | null;
  declare buyerConfirmation: CreationOptional<boolean>;
  declare sellerConfirmation: CreationOptional<boolean>;
  declare status: CreationOptional<AgreementStatus>;
  declare completedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initConversationModels(sequelize: Sequelize): void {
  Conversation.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      listingId: { type: DataTypes.CHAR(36), allowNull: false },
      buyerId: { type: DataTypes.CHAR(36), allowNull: false },
      sellerId: { type: DataTypes.CHAR(36), allowNull: false },
      lastMessageAt: { type: DataTypes.DATE(3), allowNull: true },
      lastMessagePreview: { type: DataTypes.STRING(200), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'conversations', ...MODEL_OPTIONS },
  );

  Message.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      conversationId: { type: DataTypes.CHAR(36), allowNull: false },
      senderId: { type: DataTypes.CHAR(36), allowNull: false },
      messageType: {
        type: DataTypes.ENUM('text', 'image', 'offer', 'meetup', 'system'),
        allowNull: false,
      },
      content: { type: DataTypes.TEXT, allowNull: true },
      mediaUrl: { type: DataTypes.STRING(500), allowNull: true },
      readAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'messages', ...MODEL_OPTIONS, updatedAt: false },
  );

  PriceOffer.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      conversationId: { type: DataTypes.CHAR(36), allowNull: false },
      listingId: { type: DataTypes.CHAR(36), allowNull: false },
      senderId: { type: DataTypes.CHAR(36), allowNull: false },
      receiverId: { type: DataTypes.CHAR(36), allowNull: false },
      offeredPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired'),
        allowNull: false,
        defaultValue: 'pending',
      },
      expiresAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'price_offers', ...MODEL_OPTIONS },
  );

  TransactionAgreement.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      listingId: { type: DataTypes.CHAR(36), allowNull: false },
      conversationId: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
      buyerId: { type: DataTypes.CHAR(36), allowNull: false },
      sellerId: { type: DataTypes.CHAR(36), allowNull: false },
      agreedPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      meetupLocationPublic: { type: DataTypes.STRING(255), allowNull: true },
      meetupAt: { type: DataTypes.DATE(3), allowNull: true },
      buyerConfirmation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sellerConfirmation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: {
        type: DataTypes.ENUM(
          'negotiating',
          'agreed',
          'meetup_scheduled',
          'completed',
          'cancelled',
          'disputed',
        ),
        allowNull: false,
        defaultValue: 'negotiating',
      },
      completedAt: { type: DataTypes.DATE(3), allowNull: true },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'transaction_agreements', ...MODEL_OPTIONS },
  );
}
