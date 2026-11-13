import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('LEARNER'), // LEARNER | PARENT | TEACHER | ADMIN
  accountType: text('account_type').notNull().default('individual'), // individual | parent | teacher | institution
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const institutions = pgTable('institutions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city'),
  country: text('country'),
  adminUserId: integer('admin_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const parentProfiles = pgTable('parent_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  consentAcceptedAt: timestamp('consent_accepted_at'),
  recordingRetentionDays: integer('recording_retention_days').notNull().default(7),
  allowAiLiveForChildren: boolean('allow_ai_live_for_children').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teacherProfiles = pgTable('teacher_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  institutionId: integer('institution_id').references(() => institutions.id),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const learnerProfiles = pgTable('learner_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references(() => parentProfiles.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  ageRange: text('age_range').notNull().default('18-25'), // 3-5 | 6-10 | 11-17 | 18-25 | 26-45 | 46+
  environment: text('environment').notNull().default('young_adults'), // little_voices | young_explorers | teen_voices | young_adults | professional_english | lifelong_english
  cefrLevel: text('cefr_level').notNull().default('A1'), // A1 | A2 | B1 | B2 | C1 | C2
  goals: jsonb('goals').$type<string[]>().notNull().default([]),
  preferredActivities: jsonb('preferred_activities').$type<string[]>().notNull().default([]),
  dailyGoalMinutes: integer('daily_goal_minutes').notNull().default(15),
  xp: integer('xp').notNull().default(0),
  streakDays: integer('streak_days').notNull().default(0),
  lastPracticeDate: text('last_practice_date'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  voicePreferences: jsonb('voice_preferences')
    .$type<{ voiceName: string; playbackSpeed: number; saveTranscripts: boolean }>()
    .notNull()
    .default({ voiceName: 'Kore', playbackSpeed: 1, saveTranscripts: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const classrooms = pgTable('classrooms', {
  id: serial('id').primaryKey(),
  teacherId: integer('teacher_id')
    .references(() => teacherProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  institutionId: integer('institution_id').references(() => institutions.id),
  name: text('name').notNull(),
  environment: text('environment').notNull().default('teen_voices'),
  cefrLevel: text('cefr_level').notNull().default('A2'),
  joinCode: text('join_code').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classroomMemberships = pgTable('classroom_memberships', {
  id: serial('id').primaryKey(),
  classroomId: integer('classroom_id')
    .references(() => classrooms.id, { onDelete: 'cascade' })
    .notNull(),
  learnerId: integer('learner_id')
    .references(() => learnerProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  assignedCourseIds: jsonb('assigned_course_ids').$type<number[]>().notNull().default([]),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const programmes = pgTable('programmes', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  environment: text('environment').notNull(),
  ageRange: text('age_range').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  programmeId: integer('programme_id')
    .references(() => programmes.id, { onDelete: 'cascade' })
    .notNull(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  cefrLevel: text('cefr_level').notNull().default('A1'),
  topic: text('topic').notNull().default('Everyday English'),
  skillFocus: text('skill_focus').notNull().default('Speaking'),
  estimatedMinutes: integer('estimated_minutes').notNull().default(30),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const modules = pgTable('modules', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lessons = pgTable('lessons', {
  id: serial('id').primaryKey(),
  moduleId: integer('module_id')
    .references(() => modules.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  objective: text('objective').notNull(),
  introduction: text('introduction').notNull(),
  contentJson: jsonb('content_json')
    .$type<{
      keyPhrases: { phrase: string; meaning: string; example: string }[];
      dialogue?: { speaker: string; line: string }[];
      culturalNote?: string;
      audioScript: string;
    }>()
    .notNull(),
  cefrLevel: text('cefr_level').notNull().default('A1'),
  skillType: text('skill_type').notNull().default('Speaking'),
  durationMinutes: integer('duration_minutes').notNull().default(10),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id')
    .references(() => lessons.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(), // multiple_choice | word_matching | picture_recognition | sentence_building | fill_blanks | listen_select | listen_repeat | read_aloud | voice_recording | conversation_sim | spelling | writing | story_comprehension | grammar_correction | role_play
  prompt: text('prompt').notNull(),
  instruction: text('instruction').notNull(),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull(),
  points: integer('points').notNull().default(20),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  learnerId: integer('learner_id')
    .references(() => learnerProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  recommendedLevel: text('recommended_level').notNull(),
  answersJson: jsonb('answers_json').$type<Record<string, string>>().notNull(),
  score: integer('score').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const learningAttempts = pgTable('learning_attempts', {
  id: serial('id').primaryKey(),
  learnerId: integer('learner_id')
    .references(() => learnerProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  lessonId: integer('lesson_id')
    .references(() => lessons.id, { onDelete: 'cascade' })
    .notNull(),
  activityId: integer('activity_id').references(() => activities.id, { onDelete: 'set null' }),
  answerJson: jsonb('answer_json').$type<Record<string, unknown>>().notNull(),
  isCorrect: boolean('is_correct').notNull().default(false),
  score: integer('score').notNull().default(0),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const learnerProgress = pgTable(
  'learner_progress',
  {
    id: serial('id').primaryKey(),
    learnerId: integer('learner_id')
      .references(() => learnerProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    lessonId: integer('lesson_id')
      .references(() => lessons.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull().default('in_progress'), // not_started | in_progress | completed
    score: integer('score').notNull().default(0),
    minutesSpent: integer('minutes_spent').notNull().default(5),
    completedAt: timestamp('completed_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('learner_lesson_idx').on(table.learnerId, table.lessonId)]
);

export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  badgeType: text('badge_type').notNull().default('milestone'),
  xpReward: integer('xp_reward').notNull().default(50),
  threshold: integer('threshold').notNull().default(1),
});

export const learnerAchievements = pgTable(
  'learner_achievements',
  {
    id: serial('id').primaryKey(),
    learnerId: integer('learner_id')
      .references(() => learnerProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    achievementId: integer('achievement_id')
      .references(() => achievements.id, { onDelete: 'cascade' })
      .notNull(),
    earnedAt: timestamp('earned_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('learner_achievement_idx').on(table.learnerId, table.achievementId)]
);

export const voicePracticeSessions = pgTable('voice_practice_sessions', {
  id: serial('id').primaryKey(),
  learnerId: integer('learner_id')
    .references(() => learnerProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  mode: text('mode').notNull(), // listen | speak | pronunciation
  targetText: text('target_text'),
  transcript: text('transcript'),
  wordComparisonJson: jsonb('word_comparison_json').$type<
    { word: string; status: 'matched' | 'missing' | 'substituted' }[]
  >(),
  feedback: text('feedback'),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversationSessions = pgTable('conversation_sessions', {
  id: serial('id').primaryKey(),
  learnerId: integer('learner_id')
    .references(() => learnerProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  mode: text('mode').notNull(),
  cefrLevel: text('cefr_level').notNull(),
  environment: text('environment').notNull(),
  isDemoMode: boolean('is_demo_mode').notNull().default(false),
  transcriptJson: jsonb('transcript_json')
    .$type<{ role: 'user' | 'assistant'; text: string; timestamp: string }[]>()
    .notNull()
    .default([]),
  vocabularyNotesJson: jsonb('vocabulary_notes_json')
    .$type<{ term: string; explanation: string }[]>()
    .notNull()
    .default([]),
  summary: text('summary'),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const learningGoals = pgTable('learning_goals', {
  id: serial('id').primaryKey(),
  learnerId: integer('learner_id')
    .references(() => learnerProfiles.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  title: text('title').notNull().default('Build daily speaking confidence'),
  targetMinutesPerDay: integer('target_minutes_per_day').notNull().default(15),
  targetLessonsPerWeek: integer('target_lessons_per_week').notNull().default(4),
  focusSkills: jsonb('focus_skills').$type<string[]>().notNull().default(['Speaking', 'Listening']),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  learnerProfile: one(learnerProfiles, {
    fields: [users.id],
    references: [learnerProfiles.userId],
  }),
  parentProfile: one(parentProfiles, {
    fields: [users.id],
    references: [parentProfiles.userId],
  }),
  teacherProfile: one(teacherProfiles, {
    fields: [users.id],
    references: [teacherProfiles.userId],
  }),
}));

export const parentProfilesRelations = relations(parentProfiles, ({ one, many }) => ({
  user: one(users, { fields: [parentProfiles.userId], references: [users.id] }),
  children: many(learnerProfiles),
}));

export const programmesRelations = relations(programmes, ({ many }) => ({
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  programme: one(programmes, { fields: [courses.programmeId], references: [programmes.id] }),
  modules: many(modules),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, { fields: [modules.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  module: one(modules, { fields: [lessons.moduleId], references: [modules.id] }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  lesson: one(lessons, { fields: [activities.lessonId], references: [lessons.id] }),
}));
