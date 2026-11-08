import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

import { MODEL_OPTIONS } from '../connection.js';

export type ParticipationStatus = 'interested' | 'going' | 'cancelled';

export class EventParticipant extends Model<
  InferAttributes<EventParticipant>,
  InferCreationAttributes<EventParticipant>
> {
  declare id: CreationOptional<string>;
  declare eventListingId: string;
  declare userId: string;
  declare status: CreationOptional<ParticipationStatus>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initEventParticipantModel(sequelize: Sequelize): void {
  EventParticipant.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      eventListingId: { type: DataTypes.CHAR(36), allowNull: false },
      userId: { type: DataTypes.CHAR(36), allowNull: false },
      status: {
        type: DataTypes.ENUM('interested', 'going', 'cancelled'),
        allowNull: false,
        defaultValue: 'interested',
      },
      createdAt: DataTypes.DATE(3),
      updatedAt: DataTypes.DATE(3),
    },
    { sequelize, tableName: 'event_participants', ...MODEL_OPTIONS },
  );
}
