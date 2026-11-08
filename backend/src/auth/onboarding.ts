import type { User } from '../database/models/user.model.js';

export type OnboardingState =
  | 'incomplete'
  | 'profile_completed'
  | 'phone_verified'
  | 'face_verification_pending'
  | 'verified'
  | 'rejected';

export type OnboardingStep = 'profile' | 'phone' | 'face';

export interface OnboardingCapabilities {
  /** Browsing is allowed at every stage. */
  readonly browse: true;
  readonly sell: boolean;
  readonly chat: boolean;
  readonly high_value_sell: boolean;
}

export interface OnboardingSummary {
  readonly state: OnboardingState;
  readonly required_step: OnboardingStep | null;
  readonly capabilities: OnboardingCapabilities;
}

const FACE_RESTRICTED_STATES: readonly OnboardingState[] = ['verified'];

/**
 * Derives the client-visible onboarding state from the database row only. The
 * UI never decides which step is required; it renders what the server returns.
 */
export function describeOnboarding(user: User): OnboardingSummary {
  const profileCompleted =
    user.profileCompleted && Boolean(user.displayName) && Boolean(user.username);

  const state: OnboardingState = !profileCompleted
    ? 'incomplete'
    : !user.phoneVerified
      ? 'profile_completed'
      : user.faceVerificationStatus === 'pending'
        ? 'face_verification_pending'
        : user.faceVerificationStatus === 'verified'
          ? 'verified'
          : user.faceVerificationStatus === 'rejected'
            ? 'rejected'
            : 'phone_verified';

  const requiredStep: OnboardingStep | null =
    state === 'incomplete'
      ? 'profile'
      : state === 'profile_completed'
        ? 'phone'
        : state === 'rejected'
          ? 'face'
          : null;

  return {
    state,
    required_step: requiredStep,
    capabilities: {
      browse: true,
      sell: profileCompleted,
      chat: user.phoneVerified,
      high_value_sell: FACE_RESTRICTED_STATES.includes(state),
    },
  };
}

/** Masks a stored phone number for non-owner views. */
export function maskPhone(phone: string | null): string | null {
  if (!phone) {
    return null;
  }
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 6) {
    return '••••';
  }
  return `${phone.slice(0, 4)}•••••${digits.slice(-3)}`;
}
