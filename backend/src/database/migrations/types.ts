import type { QueryInterface, Sequelize } from 'sequelize';

export interface MigrationParams {
  context: QueryInterface;
  sequelize: Sequelize;
}

export type Migration = {
  readonly name: string;
  readonly up: (params: MigrationParams) => Promise<void>;
  readonly down: (params: MigrationParams) => Promise<void>;
};

export const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci';

export const TIMESTAMPS = `created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL`;
