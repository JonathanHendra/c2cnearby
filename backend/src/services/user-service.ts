import { QueryTypes, UniqueConstraintError } from 'sequelize';

import { maskPhone, describeOnboarding, type OnboardingSummary } from '../auth/onboarding.js';
import type { VerifiedIdentity } from '../auth/types.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../common/errors.js';
import type { DatabaseModels } from '../database/models/index.js';
import type {
  AccountStatus,
  FaceVerificationStatus,
  User,
} from '../database/models/user.model.js';
import { generatePlaceholderUsername, normalizeUsername, validateUsername } from './username.js';

export const ACCOUNT_DELETION_GRACE_DAYS = 30;

export interface UserDTO {
  readonly id: string;
  readonly username: string;
  readonly display_name: string | null;
  readonly full_name: string | null;
  readonly avatar_url: string | null;
  readonly bio: string | null;
  readonly area_label: string | null;
  readonly phone: string | null;
  readonly phone_masked: string | null;
  readonly phone_verified: boolean;
  readonly face_verification_status: FaceVerificationStatus;
  readonly profile_completed: boolean;
  readonly account_status: AccountStatus;
  readonly username_chosen: boolean;
  readonly deletion_requested_at: string | null;
  readonly joined_at: string;
  readonly last_active_at: string | null;
}

export interface ProfileUpdateInput {
  displayName?: string | undefined;
  fullName?: string | undefined;
  bio?: string | undefined;
  areaLabel?: string | undefined;
}

export interface LocationInput {
  lat: number;
  lng: number;
  areaLabel?: string | null | undefined;
}

export interface UserLocationDTO {
  readonly lat: number;
  readonly lng: number;
  readonly area_label: string | null;
  readonly updated_at: string;
}

export interface ProvisionResult {
  readonly user: User;
  readonly created: boolean;
}

interface LocationRow {
  readonly lng: number | string;
  readonly lat: number | string;
  readonly area_label: string | null;
  readonly location_updated_at: Date | string;
}

function trimmedOrNull(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function assertLength(value: string | null, field: string, min: number, max: number): void {
  if (value === null) {
    if (min > 0) {
      throw new ValidationError(`${field} wajib diisi.`, [{ path: field, message: 'wajib diisi' }]);
    }
    return;
  }
  if (value.length < min || value.length > max) {
    throw new ValidationError(`${field} harus ${min}–${max} karakter.`, [
      { path: field, message: `panjang ${min}–${max}` },
    ]);
  }
}

/** Normalises an Indonesian number to `+62…` and rejects anything else. */
export function normalizeIndonesianPhone(raw: string): string {
  const digits = raw.replace(/[\s()-]/g, '');
  const withoutPlus = digits.startsWith('+') ? digits.slice(1) : digits;
  const national = withoutPlus.startsWith('62')
    ? withoutPlus.slice(2)
    : withoutPlus.startsWith('0')
      ? withoutPlus.slice(1)
      : withoutPlus;

  if (!/^8[0-9]{7,12}$/.test(national)) {
    throw new ValidationError('Nomor telepon Indonesia tidak valid.', [
      { path: 'phone', message: 'gunakan format +62 8xx' },
    ]);
  }

  return `+62${national}`;
}

export class UserService {
  constructor(private readonly models: DatabaseModels) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.models.User.findOne({ where: { firebaseUid } });
  }

  /**
   * Finds or creates the local profile for a verified identity. Signing in during
   * the deletion grace window cancels the pending deletion, as documented.
   */
  async provision(identity: VerifiedIdentity): Promise<ProvisionResult> {
    const existing = await this.findByFirebaseUid(identity.uid);
    if (existing) {
      await this.cancelDeletion(existing);
      existing.lastActiveAt = new Date();
      await existing.save();
      return { user: existing, created: false };
    }

    try {
      const user = await this.models.User.create({
        firebaseUid: identity.uid,
        username: generatePlaceholderUsername(),
        displayName: identity.displayName,
        avatarUrl: identity.photoUrl,
        lastActiveAt: new Date(),
      });
      return { user, created: true };
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const raced = await this.findByFirebaseUid(identity.uid);
        if (raced) {
          return { user: raced, created: false };
        }
      }
      throw error;
    }
  }

  async cancelDeletion(user: User): Promise<boolean> {
    if (!user.deletionRequestedAt) {
      return false;
    }
    user.deletionRequestedAt = null;
    user.accountStatus = 'active';
    await user.save();
    return true;
  }

  async touch(user: User): Promise<void> {
    user.lastActiveAt = new Date();
    await user.save({ fields: ['lastActiveAt'] });
  }

  async updateProfile(user: User, input: ProfileUpdateInput): Promise<User> {
    const displayName = trimmedOrNull(input.displayName);
    const fullName = trimmedOrNull(input.fullName);
    const bio = trimmedOrNull(input.bio);
    const areaLabel = trimmedOrNull(input.areaLabel);

    if (displayName !== undefined) {
      assertLength(displayName, 'display_name', 2, 100);
    }
    if (fullName !== undefined) {
      assertLength(fullName, 'full_name', 2, 120);
    }
    if (bio !== undefined) {
      assertLength(bio, 'bio', 0, 280);
    }
    if (areaLabel !== undefined) {
      assertLength(areaLabel, 'area_label', 2, 120);
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (areaLabel !== undefined) user.areaLabel = areaLabel;

    this.recomputeProfileCompletion(user);
    await user.save();
    return user;
  }

  async changeUsername(user: User, raw: string): Promise<User> {
    const username = normalizeUsername(raw);
    const problem = validateUsername(username);
    if (problem === 'format') {
      throw new ValidationError('Username harus 3–30 karakter: huruf kecil, angka, atau garis bawah.', [
        { path: 'username', message: 'format tidak valid' },
      ]);
    }
    if (problem === 'reserved') {
      throw new BusinessRuleError('USERNAME_RESERVED', 'Username ini tidak tersedia.');
    }
    if (username === user.username) {
      return user;
    }

    const taken = await this.models.User.findOne({ where: { username } });
    if (taken && taken.id !== user.id) {
      throw new ConflictError('USERNAME_TAKEN', 'Username sudah dipakai pengguna lain.');
    }

    user.username = username;
    user.usernameChosenAt = new Date();
    this.recomputeProfileCompletion(user);
    try {
      await user.save();
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictError('USERNAME_TAKEN', 'Username sudah dipakai pengguna lain.');
      }
      throw error;
    }
    return user;
  }

  async markPhoneVerified(user: User, rawPhone: string): Promise<User> {
    const phone = normalizeIndonesianPhone(rawPhone);

    if (user.phonePrivate === phone && user.phoneVerified) {
      return user;
    }

    user.phonePrivate = phone;
    user.phoneVerified = true;

    await this.models.UserVerification.create({
      userId: user.id,
      verificationType: 'phone',
      provider: 'firebase',
      providerReference: null,
      status: 'verified',
      verifiedAt: new Date(),
      expiresAt: null,
    });

    await user.save();
    return user;
  }

  async setAvatar(user: User, avatarUrl: string): Promise<User> {
    user.avatarUrl = avatarUrl;
    await user.save({ fields: ['avatarUrl'] });
    return user;
  }

  async getLocation(userId: string): Promise<UserLocationDTO | null> {
    const rows = await this.models.UserLocation.sequelize?.query<LocationRow>(
      `SELECT ST_Latitude(location_private) AS lat, ST_Longitude(location_private) AS lng,
              area_label, location_updated_at
         FROM user_locations WHERE user_id = ? LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: [userId] },
    );

    const row = rows?.[0];
    if (!row) {
      return null;
    }

    return {
      lat: Number(row.lat),
      lng: Number(row.lng),
      area_label: row.area_label,
      updated_at: new Date(row.location_updated_at).toISOString(),
    };
  }

  async setLocation(user: User, input: LocationInput): Promise<UserLocationDTO> {
    if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
      throw new ValidationError('Latitude tidak valid.', [{ path: 'lat', message: '-90..90' }]);
    }
    if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
      throw new ValidationError('Longitude tidak valid.', [{ path: 'lng', message: '-180..180' }]);
    }

    const areaLabel = trimmedOrNull(input.areaLabel ?? undefined) ?? null;
    if (areaLabel !== null) {
      assertLength(areaLabel, 'area_label', 2, 120);
    }

    const sequelize = this.models.UserLocation.sequelize;
    if (!sequelize) {
      throw new Error('Sequelize belum terpasang pada model UserLocation.');
    }

    const now = new Date();
    await sequelize.query(
      `INSERT INTO user_locations
         (id, user_id, location_private, area_label, location_updated_at, created_at, updated_at)
       VALUES (UUID(), ?, ST_GeomFromText(?, 4326), ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         location_private = VALUES(location_private),
         area_label = VALUES(area_label),
         location_updated_at = VALUES(location_updated_at),
         updated_at = VALUES(updated_at)`,
      {
        replacements: [
          user.id,
          // SRID 4326 is axis-ordered latitude-longitude in MySQL.
          `POINT(${input.lat} ${input.lng})`,
          areaLabel,
          now,
          now,
          now,
        ],
      },
    );

    if (areaLabel !== null) {
      user.areaLabel = areaLabel;
      this.recomputeProfileCompletion(user);
      await user.save({ fields: ['areaLabel', 'profileCompleted'] });
    }

    return {
      lat: input.lat,
      lng: input.lng,
      area_label: areaLabel,
      updated_at: now.toISOString(),
    };
  }

  async requestDeletion(user: User): Promise<Date> {
    if (user.deletionRequestedAt) {
      return user.deletionRequestedAt;
    }
    const requestedAt = new Date();
    user.deletionRequestedAt = requestedAt;
    user.accountStatus = 'deactivated';
    await user.save();
    return requestedAt;
  }

  onboarding(user: User): OnboardingSummary {
    return describeOnboarding(user);
  }

  async requireUserById(id: string): Promise<User> {
    const user = await this.models.User.findByPk(id);
    if (!user) {
      throw new NotFoundError('Pengguna', 'USER_NOT_FOUND');
    }
    return user;
  }

  /** Profile completion needs an explicit username, a display name and an area. */
  private recomputeProfileCompletion(user: User): void {
    user.profileCompleted = Boolean(
      user.usernameChosenAt && user.displayName && user.areaLabel,
    );
  }
}

export function toUserDto(user: User, options: { includePhone?: boolean } = {}): UserDTO {
  const includePhone = options.includePhone ?? true;
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
    full_name: user.fullName,
    avatar_url: user.avatarUrl,
    bio: user.bio,
    area_label: user.areaLabel,
    phone: includePhone ? user.phonePrivate : null,
    phone_masked: maskPhone(user.phonePrivate),
    phone_verified: user.phoneVerified,
    face_verification_status: user.faceVerificationStatus,
    profile_completed: user.profileCompleted,
    account_status: user.accountStatus,
    username_chosen: Boolean(user.usernameChosenAt),
    deletion_requested_at: user.deletionRequestedAt
      ? user.deletionRequestedAt.toISOString()
      : null,
    joined_at: user.createdAt.toISOString(),
    last_active_at: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
  };
}
