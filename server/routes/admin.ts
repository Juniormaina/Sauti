import { Router } from 'express';
import { count, desc, eq } from 'drizzle-orm';
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
import { ensureSeeded } from '../services/seedService.ts';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

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
  } catch (err: any) {
    console.error('Admin stats error:', err);
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
  } catch (err: any) {
    return res.status(500).json({ error: 'Unable to load users.' });
  }
});

router.patch('/users/:id/role', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body || {};
    if (!['LEARNER', 'PARENT', 'TEACHER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
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
    const { programmeId, title, description, cefrLevel, topic, skillFocus, estimatedMinutes } =
      req.body || {};
    if (!programmeId || !title) {
      return res.status(400).json({ error: 'programmeId and title are required.' });
    }
    const slug = `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const [created] = await db
      .insert(courses)
      .values({
        programmeId: Number(programmeId),
        slug,
        title,
        description: description || 'Custom course',
        cefrLevel: cefrLevel || 'A1',
        topic: topic || 'Everyday English',
        skillFocus: skillFocus || 'Speaking',
        estimatedMinutes: Number(estimatedMinutes || 25),
      })
      .returning();
    return res.status(201).json({ course: created });
  } catch {
    return res.status(500).json({ error: 'Unable to create course.' });
  }
});

export default router;
