export const CURRENT_CONSENT_VERSION = '2026-11-v1';

export const UNDER_13_ENVIRONMENTS = new Set(['little_voices', 'young_explorers']);
export const MINOR_ENVIRONMENTS = new Set(['little_voices', 'young_explorers', 'teen_voices']);
export const ADULT_ENVIRONMENTS = new Set([
  'young_adults',
  'professional_english',
  'lifelong_english',
]);

export const UNDER_13_LIVE_MODES = new Set([
  'Everyday conversations',
  'Introductions',
  'School conversations',
]);

export const TEEN_LIVE_MODES = new Set([
  'Everyday conversations',
  'Introductions',
  'Shopping',
  'Travel',
  'School conversations',
  'Public speaking',
]);

export const ALL_LIVE_MODES = [
  'Everyday conversations',
  'Introductions',
  'Shopping',
  'Travel',
  'School conversations',
  'Workplace conversations',
  'Interviews',
  'Public speaking',
  'Free conversation practice',
] as const;

export interface ParentConsentLike {
  id: number;
  consentAcceptedAt: Date | string | null;
  consentRevokedAt?: Date | string | null;
  consentVersion?: string | null;
  allowAiLiveForChildren: boolean;
  recordingRetentionDays: number;
}

export interface LearnerSafetyLike {
  id: number;
  userId: number | null;
  parentId: number | null;
  environment: string;
  ageRange: string;
  cefrLevel: string;
  voicePreferences?: {
    voiceName?: string;
    playbackSpeed?: number;
    saveTranscripts?: boolean;
  } | null;
}

export function hasActiveGuardianConsent(parent: ParentConsentLike | null | undefined): boolean {
  if (!parent || !parent.consentAcceptedAt) return false;
  const acceptedMs = new Date(parent.consentAcceptedAt).getTime();
  if (Number.isNaN(acceptedMs)) return false;
  if (!parent.consentRevokedAt) return true;
  const revokedMs = new Date(parent.consentRevokedAt).getTime();
  if (Number.isNaN(revokedMs)) return false;
  return acceptedMs > revokedMs;
}

export function isUnder13Learner(learner: Pick<LearnerSafetyLike, 'environment' | 'ageRange'>): boolean {
  return (
    UNDER_13_ENVIRONMENTS.has(learner.environment) ||
    learner.ageRange === '3-5' ||
    learner.ageRange === '6-10'
  );
}

export function isMinorLearner(learner: Pick<LearnerSafetyLike, 'environment' | 'ageRange'>): boolean {
  return isUnder13Learner(learner) || learner.environment === 'teen_voices' || learner.ageRange === '11-17';
}

export function canLearnerAccessCourseEnvironment(
  learner: Pick<LearnerSafetyLike, 'environment' | 'ageRange'>,
  courseEnvironment?: string | null
): boolean {
  if (!courseEnvironment) return true;
  if (isUnder13Learner(learner)) {
    return UNDER_13_ENVIRONMENTS.has(courseEnvironment);
  }
  if (isMinorLearner(learner)) {
    return MINOR_ENVIRONMENTS.has(courseEnvironment);
  }
  return true;
}

export function validateEnvironmentTransition(
  currentLearner: Pick<LearnerSafetyLike, 'environment' | 'ageRange' | 'parentId'>,
  nextEnvironment: string,
  options: { isParentActingForChild: boolean; isAdmin?: boolean }
): { allowed: true } | { allowed: false; error: string } {
  if (options.isAdmin) return { allowed: true };

  if (options.isParentActingForChild || currentLearner.parentId !== null) {
    if (!MINOR_ENVIRONMENTS.has(nextEnvironment)) {
      return {
        allowed: false,
        error: 'Child profiles managed by a guardian cannot be moved into adult learning environments.',
      };
    }
    if (!options.isParentActingForChild && isUnder13Learner(currentLearner) && nextEnvironment !== currentLearner.environment) {
      return {
        allowed: false,
        error: 'A parent or guardian must change a child’s learning environment.',
      };
    }
    return { allowed: true };
  }

  if (isUnder13Learner(currentLearner) && !UNDER_13_ENVIRONMENTS.has(nextEnvironment)) {
    return {
      allowed: false,
      error: 'Child accounts under 13 cannot switch into teen or adult environments without guardian approval.',
    };
  }

  if (isMinorLearner(currentLearner) && ADULT_ENVIRONMENTS.has(nextEnvironment)) {
    return {
      allowed: false,
      error: 'Minor learner profiles cannot switch into adult-only learning environments.',
    };
  }

  if (!isMinorLearner(currentLearner) && UNDER_13_ENVIRONMENTS.has(nextEnvironment)) {
    return {
      allowed: false,
      error: 'Under-13 child environments must be created and managed from a Parent Portal account.',
    };
  }

  return { allowed: true };
}

export function isLiveModeAllowedForLearner(
  learner: Pick<LearnerSafetyLike, 'environment' | 'ageRange'>,
  mode: string
): boolean {
  if (isUnder13Learner(learner)) {
    return UNDER_13_LIVE_MODES.has(mode);
  }
  if (isMinorLearner(learner)) {
    return TEEN_LIVE_MODES.has(mode);
  }
  return (ALL_LIVE_MODES as readonly string[]).includes(mode);
}

export type LiveSafetyCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      code: 'GUARDIAN_REQUIRED' | 'CONSENT_REQUIRED' | 'SAFETY_RESTRICTED' | 'MODE_RESTRICTED';
      reason: string;
    };

export function evaluateLiveVoiceSafety(
  learner: LearnerSafetyLike,
  parent: ParentConsentLike | null | undefined,
  requestedMode: string
): LiveSafetyCheckResult {
  const under13 = isUnder13Learner(learner);
  const minor = isMinorLearner(learner);

  if (under13) {
    if (!learner.parentId || !parent) {
      return {
        allowed: false,
        code: 'GUARDIAN_REQUIRED',
        reason:
          'Learners in Little Voices and Young Explorers require a linked parent or guardian account before using Live AI voice.',
      };
    }
    if (!hasActiveGuardianConsent(parent)) {
      return {
        allowed: false,
        code: 'CONSENT_REQUIRED',
        reason:
          'Active guardian consent is required in the Parent Portal before Live AI voice can start.',
      };
    }
    if (!parent.allowAiLiveForChildren) {
      return {
        allowed: false,
        code: 'SAFETY_RESTRICTED',
        reason:
          'Live AI conversations are paused by parent privacy controls for this child. Use Listen & Learn or Speak & Practise instead.',
      };
    }
  } else if (minor && learner.parentId !== null) {
    if (!parent || !hasActiveGuardianConsent(parent)) {
      return {
        allowed: false,
        code: 'CONSENT_REQUIRED',
        reason:
          'Active guardian consent is required before this supervised teen profile can use Live AI voice.',
      };
    }
    if (!parent.allowAiLiveForChildren) {
      return {
        allowed: false,
        code: 'SAFETY_RESTRICTED',
        reason:
          'Live AI conversations are paused by parent privacy controls. Use guided lessons, Listen & Learn, or Speak & Practise instead.',
      };
    }
  }

  if (!isLiveModeAllowedForLearner(learner, requestedMode)) {
    return {
      allowed: false,
      code: 'MODE_RESTRICTED',
      reason: `The "${requestedMode}" conversation mode is not permitted for ${learner.environment.replace('_', ' ')}. Choose an age-appropriate guided mode.`,
    };
  }

  return { allowed: true };
}

export function shouldStoreTranscripts(
  learner: LearnerSafetyLike,
  parent: ParentConsentLike | null | undefined
): boolean {
  if (learner.voicePreferences?.saveTranscripts === false) {
    return false;
  }
  if (isUnder13Learner(learner)) {
    if (!parent || !hasActiveGuardianConsent(parent) || parent.recordingRetentionDays <= 0) {
      return false;
    }
  } else if (learner.parentId !== null && parent) {
    if (!hasActiveGuardianConsent(parent) || parent.recordingRetentionDays <= 0) {
      return false;
    }
  }
  return true;
}

export function buildAgeSafetyPromptGuard(environment: string, ageRange?: string): string {
  if (UNDER_13_ENVIRONMENTS.has(environment) || ageRange === '3-5' || ageRange === '6-10') {
    return (
      'CHILD SAFETY BOUNDARY: The learner is a child under 13. ' +
      'Strictly confine topics to gentle, concrete, educational themes (animals, colours, nature, school, family, everyday kindness). ' +
      'NEVER ask for or collect personal information (full name, home address, school name, age, location, phone number, or family details). ' +
      'NEVER discuss mature, violent, romantic, political, or alarming topics.'
    );
  }
  if (environment === 'teen_voices' || ageRange === '11-17') {
    return (
      'YOUTH SAFETY BOUNDARY: The learner is a minor (ages 11–17). ' +
      'Keep topics educational, respectful, and age-appropriate (school projects, hobbies, books, everyday communication). ' +
      'NEVER solicit personal identifying information, social handles, locations, or mature/adult content.'
    );
  }
  return 'Keep guidance respectful, encouraging, and focused on practical English fluency.';
}

export function defaultAgeRangeForEnvironment(env: string): '3-5' | '6-10' | '11-17' | '18-25' | '26-45' | '46+' {
  switch (env) {
    case 'little_voices':
      return '3-5';
    case 'young_explorers':
      return '6-10';
    case 'teen_voices':
      return '11-17';
    case 'professional_english':
      return '26-45';
    case 'lifelong_english':
      return '46+';
    default:
      return '18-25';
  }
}
