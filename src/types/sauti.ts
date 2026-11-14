export type LearningEnvironment =
  | 'little_voices'
  | 'young_explorers'
  | 'teen_voices'
  | 'young_adults'
  | 'professional_english'
  | 'lifelong_english';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type AgeRange = '3-5' | '6-10' | '11-17' | '18-25' | '26-45' | '46+';

export type AccountType = 'individual' | 'parent' | 'teacher' | 'institution';

export type UserRole = 'LEARNER' | 'PARENT' | 'TEACHER' | 'ADMIN';

export type ActivityType =
  | 'multiple_choice'
  | 'word_matching'
  | 'picture_recognition'
  | 'sentence_building'
  | 'fill_blanks'
  | 'listen_select'
  | 'listen_repeat'
  | 'read_aloud'
  | 'voice_recording'
  | 'conversation_sim'
  | 'spelling'
  | 'writing'
  | 'story_comprehension'
  | 'grammar_correction'
  | 'role_play';

export interface SautiUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  accountType: AccountType;
}

export interface LearnerProfile {
  id: number;
  userId: number | null;
  parentId: number | null;
  displayName: string;
  ageRange: AgeRange;
  environment: LearningEnvironment;
  cefrLevel: CefrLevel;
  goals: string[];
  preferredActivities: string[];
  dailyGoalMinutes: number;
  xp: number;
  streakDays: number;
  lastPracticeDate: string | null;
  onboardingCompleted: boolean;
  voicePreferences: {
    voiceName: string;
    playbackSpeed: number;
    saveTranscripts: boolean;
  };
}

export interface ParentProfile {
  id: number;
  userId: number;
  consentAcceptedAt: string | null;
  consentVersion?: string | null;
  consentRevokedAt?: string | null;
  hasActiveConsent?: boolean;
  recordingRetentionDays: number;
  allowAiLiveForChildren: boolean;
}

export interface TeacherProfile {
  id: number;
  userId: number;
  institutionId: number | null;
  bio: string | null;
}

export interface Programme {
  id: number;
  slug: string;
  title: string;
  environment: LearningEnvironment;
  ageRange: string;
  description: string;
}

export interface Course {
  id: number;
  programmeId: number;
  slug: string;
  title: string;
  description: string;
  cefrLevel: CefrLevel;
  topic: string;
  skillFocus: string;
  estimatedMinutes: number;
  programme?: Programme | null;
}

export interface LessonContent {
  keyPhrases: { phrase: string; meaning: string; example: string }[];
  dialogue?: { speaker: string; line: string }[];
  culturalNote?: string;
  audioScript: string;
}

export interface Lesson {
  id: number;
  moduleId: number;
  title: string;
  objective: string;
  introduction: string;
  contentJson: LessonContent;
  cefrLevel: CefrLevel;
  skillType: string;
  durationMinutes: number;
  completed?: boolean;
}

export interface ModuleWithLessons {
  id: number;
  courseId: number;
  title: string;
  description: string;
  lessons: Lesson[];
}

export type Module = Omit<ModuleWithLessons, 'lessons'>;

export interface Activity {
  id: number;
  lessonId: number;
  type: ActivityType;
  prompt: string;
  instruction: string;
  payloadJson: Record<string, any>;
  points: number;
}

export interface AchievementItem {
  id: number;
  code: string;
  title: string;
  description: string;
  badgeType: string;
  xpReward: number;
  earned: boolean;
}

export interface VoicePracticeSession {
  id: number;
  mode: string;
  targetText: string | null;
  transcript: string | null;
  wordComparisonJson?: { word: string; status: 'matched' | 'missing' | 'substituted' }[] | null;
  feedback: string | null;
  durationSeconds: number;
  createdAt: string;
}

export interface ConversationSession {
  id: number;
  mode: string;
  cefrLevel: string;
  environment: string;
  isDemoMode: boolean;
  transcriptJson: { role: 'user' | 'assistant'; text: string; timestamp: string }[];
  vocabularyNotesJson: { term: string; explanation: string }[];
  summary: string | null;
  durationSeconds: number;
  createdAt: string;
}
