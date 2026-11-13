import crypto from 'node:crypto';
import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import {
  classroomMemberships,
  classrooms,
  courses,
  learnerProfiles,
  learnerProgress,
  teacherProfiles,
  users,
} from '../../src/db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { resolveAuthorizedClassroom } from '../services/authorizationService.ts';
import {
  defaultAgeRangeForEnvironment,
  UNDER_13_ENVIRONMENTS,
} from '../services/childSafetyService.ts';

const router = Router();
router.use(requireAuth, requireRole('TEACHER', 'ADMIN'));

async function getOrCreateTeacher(userId: number) {
  let [teacher] = await db
    .select()
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);
  if (!teacher) {
    const [created] = await db.insert(teacherProfiles).values({ userId }).returning();
    teacher = created;
  }
  return teacher;
}

router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const teacher = await getOrCreateTeacher(req.authUser!.id);
    const teacherClassrooms = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.teacherId, teacher.id));

    const enriched = await Promise.all(
      teacherClassrooms.map(async (cls) => {
        const members = await db
          .select()
          .from(classroomMemberships)
          .where(eq(classroomMemberships.classroomId, cls.id));
        return {
          ...cls,
          learnerCount: members.length,
        };
      })
    );

    const allCourses = await db.select().from(courses);
    return res.json({ teacher, classrooms: enriched, availableCourses: allCourses });
  } catch {
    return res.status(500).json({ error: 'Unable to load teacher dashboard.' });
  }
});

const classroomSchema = z.object({
  name: z.string().trim().min(2).max(100),
  environment: z.enum([
    'little_voices',
    'young_explorers',
    'teen_voices',
    'young_adults',
    'professional_english',
    'lifelong_english',
  ]),
  cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).default('A2'),
});

router.post('/classrooms', async (req: AuthRequest, res) => {
  try {
    const parsed = classroomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid classroom details.' });
    }
    const teacher = await getOrCreateTeacher(req.authUser!.id);
    const joinCode = `SAUTI-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const [created] = await db
      .insert(classrooms)
      .values({
        teacherId: teacher.id,
        name: parsed.data.name,
        environment: parsed.data.environment,
        cefrLevel: parsed.data.cefrLevel,
        joinCode,
      })
      .returning();

    return res.status(201).json({ classroom: created });
  } catch {
    return res.status(500).json({ error: 'Unable to create classroom.' });
  }
});

router.get('/classrooms/:id', async (req: AuthRequest, res) => {
  try {
    const access = await resolveAuthorizedClassroom(req.authUser!, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { classroom } = access;

    const memberships = await db
      .select()
      .from(classroomMemberships)
      .where(eq(classroomMemberships.classroomId, classroom.id));

    const learners = await Promise.all(
      memberships.map(async (m) => {
        const [learner] = await db
          .select()
          .from(learnerProfiles)
          .where(eq(learnerProfiles.id, m.learnerId))
          .limit(1);
        const progress = learner
          ? await db.select().from(learnerProgress).where(eq(learnerProgress.learnerId, learner.id))
          : [];
        return {
          membershipId: m.id,
          assignedCourseIds: m.assignedCourseIds,
          learner: learner || null,
          completedLessonsCount: progress.filter((p) => p.status === 'completed').length,
        };
      })
    );

    return res.json({ classroom, learners });
  } catch {
    return res.status(500).json({ error: 'Unable to load classroom.' });
  }
});

const addLearnerSchema = z
  .object({
    email: z.string().trim().email().optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
  })
  .refine((d) => Boolean(d.email || d.displayName), {
    message: 'Provide an existing learner email or a learner display name.',
  });

router.post('/classrooms/:id/learners', async (req: AuthRequest, res) => {
  try {
    const access = await resolveAuthorizedClassroom(req.authUser!, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { classroom } = access;

    const parsed = addLearnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid learner input.' });
    }

    const { email, displayName } = parsed.data;
    let learner: typeof learnerProfiles.$inferSelect | null = null;

    if (email) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);
      if (user) {
        const [lp] = await db
          .select()
          .from(learnerProfiles)
          .where(eq(learnerProfiles.userId, user.id))
          .limit(1);
        learner = lp || null;
      }
    }

    if (!learner && displayName) {
      if (UNDER_13_ENVIRONMENTS.has(classroom.environment)) {
        return res.status(400).json({
          error:
            'Under-13 learners require guardian registration and consent before joining a classroom by account email.',
        });
      }
      const [created] = await db
        .insert(learnerProfiles)
        .values({
          displayName,
          ageRange: defaultAgeRangeForEnvironment(classroom.environment),
          environment: classroom.environment,
          cefrLevel: classroom.cefrLevel,
          onboardingCompleted: true,
        })
        .returning();
      learner = created;
    }

    if (!learner) {
      return res.status(404).json({ error: 'No learner profile matched that email.' });
    }

    const [existingMembership] = await db
      .select()
      .from(classroomMemberships)
      .where(
        and(
          eq(classroomMemberships.classroomId, classroom.id),
          eq(classroomMemberships.learnerId, learner.id)
        )
      )
      .limit(1);

    if (existingMembership) {
      return res.status(409).json({ error: 'This learner is already enrolled in the classroom.' });
    }

    const [membership] = await db
      .insert(classroomMemberships)
      .values({
        classroomId: classroom.id,
        learnerId: learner.id,
      })
      .returning();

    return res.status(201).json({ membership, learner });
  } catch {
    return res.status(500).json({ error: 'Unable to add learner to classroom.' });
  }
});

export default router;
