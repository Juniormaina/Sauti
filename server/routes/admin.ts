import { Router } from 'express';
import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import {
  activities,
  courses,
  learnerProgress,
  lessons,
  modules,
  programmes,
  users,
  voicePracticeSessions,
} from '../../src/db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { parsePositiveInt } from '../services/authorizationService.ts';
import { ensureSeeded } from '../services/seedService.ts';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

const updateRoleSchema = z.object({
  role: z.enum(['LEARNER', 'PARENT', 'TEACHER', 'ADMIN']),
});

const createCourseSchema = z.object({
  programmeId: z.coerce.number().int().positive(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(600).default('Custom course'),
  cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).default('A1'),
  topic: z.string().trim().min(2).max(80).default('Everyday English'),
  skillFocus: z.string().trim().min(2).max(40).default('Speaking'),
  estimatedMinutes: z.coerce.number().int().min(5).max(300).default(25),
});

router.get('/stats', async (_req, res) => {
  try {
    await ensureSeeded();
    const [{ total: userCount }] = await db.select({ total: count() }).from(users);
    const [{ total: courseCount }] = await db.select({ total: count() }).from(courses);
    const [{ total: lessonCount }] = await db.select({ total: count() }).from(lessons);
    const [{ total: completionCount }] = await db.select({ total: count() }).from(learnerProgress);
    const [{ total: voiceCount }] = await db.select({ total: count() }).from(voicePracticeSessions);

    return res.json({
      users: Number(userCount),
      courses: Number(courseCount),
      lessons: Number(lessonCount),
      completions: Number(completionCount),
      voiceSessions: Number(voiceCount),
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load platform statistics.' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const list = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        accountType: users.accountType,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(100);
    return res.json({ users: list });
  } catch {
    return res.status(500).json({ error: 'Unable to load users.' });
  }
});

router.patch('/users/:id/role', async (req: AuthRequest, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user ID.' });

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    if (id === req.authUser!.id && parsed.data.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Administrators cannot remove their own ADMIN role.' });
    }

    const [updated] = await db
      .update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        uid: users.uid,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        accountType: users.accountType,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) return res.status(404).json({ error: 'User not found.' });

    return res.json({ user: updated });
  } catch {
    return res.status(500).json({ error: 'Unable to update user role.' });
  }
});

router.get('/curriculum', async (_req, res) => {
  try {
    await ensureSeeded();
    const [progs, courseList, modList, lessonList, actList] = await Promise.all([
      db.select().from(programmes),
      db.select().from(courses),
      db.select().from(modules),
      db.select().from(lessons),
      db.select().from(activities),
    ]);
    return res.json({
      programmes: progs,
      courses: courseList,
      modules: modList,
      lessons: lessonList,
      activities: actList,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load curriculum tree.' });
  }
});

router.post('/courses', async (req, res) => {
  try {
    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid course details.' });
    }

    const [prog] = await db
      .select({ id: programmes.id })
      .from(programmes)
      .where(eq(programmes.id, parsed.data.programmeId))
      .limit(1);
    if (!prog) {
      return res.status(404).json({ error: 'Programme not found.' });
    }

    const slug = `${parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}-${Date.now()}`;
    const [created] = await db
      .insert(courses)
      .values({
        programmeId: parsed.data.programmeId,
        slug,
        title: parsed.data.title,
        description: parsed.data.description,
        cefrLevel: parsed.data.cefrLevel,
        topic: parsed.data.topic,
        skillFocus: parsed.data.skillFocus,
        estimatedMinutes: parsed.data.estimatedMinutes,
      })
      .returning();
    return res.status(201).json({ course: created });
  } catch {
    return res.status(500).json({ error: 'Unable to create course.' });
  }
});

export default router;
