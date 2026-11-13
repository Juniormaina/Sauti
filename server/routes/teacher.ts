import crypto from 'node:crypto';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
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
  } catch (err: any) {
    console.error('Teacher dashboard error:', err);
    return res.status(500).json({ error: 'Unable to load teacher dashboard.' });
  }
});

const classroomSchema = z.object({
  name: z.string().min(2),
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
  } catch (err: any) {
    console.error('Create classroom error:', err);
    return res.status(500).json({ error: 'Unable to create classroom.' });
  }
});

router.get('/classrooms/:id', async (req: AuthRequest, res) => {
  try {
    const classroomId = Number(req.params.id);
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId))
      .limit(1);

    if (!classroom) return res.status(404).json({ error: 'Classroom not found.' });

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
  } catch (err: any) {
    console.error('Classroom detail error:', err);
    return res.status(500).json({ error: 'Unable to load classroom.' });
  }
});

router.post('/classrooms/:id/learners', async (req: AuthRequest, res) => {
  try {
    const classroomId = Number(req.params.id);
    const { email, displayName } = req.body || {};

    let learner: any = null;
    if (email) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, String(email).toLowerCase().trim()))
        .limit(1);
      if (user) {
        const [lp] = await db
          .select()
          .from(learnerProfiles)
          .where(eq(learnerProfiles.userId, user.id))
          .limit(1);
        learner = lp;
      }
    }

    if (!learner && displayName) {
      const [cls] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId)).limit(1);
      const [created] = await db
        .insert(learnerProfiles)
        .values({
          displayName: String(displayName),
          environment: cls?.environment || 'teen_voices',
          cefrLevel: cls?.cefrLevel || 'A2',
          onboardingCompleted: true,
        })
        .returning();
      learner = created;
    }

    if (!learner) {
      return res.status(404).json({ error: 'Provide an existing learner email or a learner display name.' });
    }

    const [membership] = await db
      .insert(classroomMemberships)
      .values({
        classroomId,
        learnerId: learner.id,
      })
      .returning();

    return res.status(201).json({ membership, learner });
  } catch (err: any) {
    console.error('Add learner to classroom error:', err);
    return res.status(500).json({ error: 'Unable to add learner to classroom.' });
  }
});

export default router;
