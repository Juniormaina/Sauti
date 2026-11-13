import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  classrooms,
  learnerProfiles,
  parentProfiles,
  teacherProfiles,
} from '../../src/db/schema.ts';
import { AuthUserContext } from '../middleware/auth.ts';
import { hasActiveGuardianConsent, isUnder13Learner } from './childSafetyService.ts';

export function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export type LearnerAccessResult =
  | {
      ok: true;
      learner: typeof learnerProfiles.$inferSelect;
      parent: typeof parentProfiles.$inferSelect | null;
      isParentActingForChild: boolean;
    }
  | {
      ok: false;
      status: 400 | 403 | 404;
      error: string;
    };

export async function resolveAuthorizedLearner(
  authUser: AuthUserContext,
  requestedLearnerId?: unknown,
  options?: {
    requireGuardianConsentForChild?: boolean;
  }
): Promise<LearnerAccessResult> {
  const hasRequestedId =
    requestedLearnerId !== undefined && requestedLearnerId !== null && requestedLearnerId !== '';

  let learner: typeof learnerProfiles.$inferSelect | undefined;

  if (hasRequestedId) {
    const parsedId = parsePositiveInt(requestedLearnerId);
    if (!parsedId) {
      return { ok: false, status: 400, error: 'Invalid learner identifier.' };
    }
    const [found] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.id, parsedId))
      .limit(1);
    learner = found;
  } else {
    const [own] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, authUser.id))
      .limit(1);
    learner = own;
  }

  // Return identical 404 for non-existent or unrelated learner IDs to prevent ID enumeration.
  if (!learner) {
    return { ok: false, status: 404, error: 'Learner profile not found.' };
  }

  const isOwnLearner = learner.userId !== null && learner.userId === authUser.id;

  let parent: typeof parentProfiles.$inferSelect | null = null;
  if (learner.parentId !== null) {
    const [parentRow] = await db
      .select()
      .from(parentProfiles)
      .where(eq(parentProfiles.id, learner.parentId))
      .limit(1);
    parent = parentRow || null;
  }

  const isParentOwner = Boolean(
    parent &&
      parent.userId === authUser.id &&
      (authUser.role === 'PARENT' || authUser.role === 'ADMIN')
  );

  if (!isOwnLearner && !isParentOwner) {
    return { ok: false, status: 404, error: 'Learner profile not found.' };
  }

  if (options?.requireGuardianConsentForChild) {
    if (learner.parentId !== null) {
      if (!parent || !hasActiveGuardianConsent(parent)) {
        return {
          ok: false,
          status: 403,
          error: 'Active guardian consent is required to access or modify this child profile.',
        };
      }
    } else if (isUnder13Learner(learner)) {
      return {
        ok: false,
        status: 403,
        error: 'Children under 13 require a linked parent account with active guardian consent.',
      };
    }
  }

  return {
    ok: true,
    learner,
    parent,
    isParentActingForChild: !isOwnLearner && isParentOwner,
  };
}

export async function resolveAuthorizedClassroom(
  authUser: AuthUserContext,
  requestedClassroomId: unknown
) {
  const classroomId = parsePositiveInt(requestedClassroomId);
  if (!classroomId) {
    return { ok: false as const, status: 400 as const, error: 'Invalid classroom identifier.' };
  }

  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);

  if (!classroom) {
    return { ok: false as const, status: 404 as const, error: 'Classroom not found.' };
  }

  if (authUser.role === 'ADMIN') {
    return { ok: true as const, classroom };
  }

  const [teacher] = await db
    .select()
    .from(teacherProfiles)
    .where(and(eq(teacherProfiles.userId, authUser.id), eq(teacherProfiles.id, classroom.teacherId)))
    .limit(1);

  if (!teacher) {
    return { ok: false as const, status: 404 as const, error: 'Classroom not found.' };
  }

  return { ok: true as const, classroom };
}
