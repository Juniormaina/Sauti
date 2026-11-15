import { AgeRange, CefrLevel, LearningEnvironment } from '../types/sauti';

import { photo, type PhotoKey } from './photos';

/** Generated placeholder scenes (see src/assets/images/photo). Swap for real photography later. */
export const SAUTI_IMAGES = {
  heroVoices: photo('hero').src,
  littleVoices: photo('little-voices').src,
  teenAdult: photo('teens').src,
  professionalLifelong: photo('professional').src,
};

export interface EnvironmentMeta {
  id: LearningEnvironment;
  title: string;
  ageRange: AgeRange;
  tagline: string;
  description: string;
  layoutGroup: 'kids' | 'teen' | 'adult';
  accentHex: string;
  surfaceHex: string;
  image: string;
  photoKey: PhotoKey;
  highlights: string[];
}

export const ENVIRONMENTS: EnvironmentMeta[] = [
  {
    id: 'little_voices',
    title: 'Little Voices',
    ageRange: '3-5',
    tagline: 'Playful sounds, picture stories & first words',
    description:
      'Audio-led discovery with friendly visuals, oversized touch targets, and gentle letter-sound songs.',
    layoutGroup: 'kids',
    accentHex: '#F28B75',
    surfaceHex: '#FFF1E6',
    image: photo('little-voices').src,
    photoKey: 'little-voices',
    highlights: ['Picture-led lessons', 'Zero reading pressure', 'Parent-guided safety'],
  },
  {
    id: 'young_explorers',
    title: 'Young Explorers',
    ageRange: '6-10',
    tagline: 'Interactive stories, spelling quests & everyday speech',
    description:
      'Adventurous story lessons, sentence-building games, and encouraging speaking challenges.',
    layoutGroup: 'kids',
    accentHex: '#F6C96B',
    surfaceHex: '#FEF8E6',
    image: photo('young-explorers').src,
    photoKey: 'young-explorers',
    highlights: ['Story comprehension', 'Sentence builders', 'Gentle voice practice'],
  },
  {
    id: 'teen_voices',
    title: 'Teen Voices',
    ageRange: '11-17',
    tagline: 'Expressive speaking, debates & creative storytelling',
    description:
      'Contemporary communication for school discussions, opinion framing, and social confidence.',
    layoutGroup: 'teen',
    accentHex: '#245C45',
    surfaceHex: '#EBF4EF',
    image: photo('teens').src,
    photoKey: 'teens',
    highlights: ['Opinion & debate studio', 'Podcast-style speaking', 'All CEFR levels A1–C2'],
  },
  {
    id: 'young_adults',
    title: 'Young Adults',
    ageRange: '18-25',
    tagline: 'University fluency, daily life & career readiness',
    description:
      'Practical English for seminars, international friendships, presentations, and first interviews.',
    layoutGroup: 'teen',
    accentHex: '#245C45',
    surfaceHex: '#EEF7FA',
    image: photo('young-adults').src,
    photoKey: 'young-adults',
    highlights: ['Seminar turn-taking', 'Interview simulations', 'Real-world fluency'],
  },
  {
    id: 'professional_english',
    title: 'Professional English',
    ageRange: '26-45',
    tagline: 'Workplace leadership, briefings & business writing',
    description:
      'Refined editorial learning for meetings, stakeholder presentations, negotiations, and clear emails.',
    layoutGroup: 'adult',
    accentHex: '#245C45',
    surfaceHex: '#F4EFE6',
    image: photo('professional').src,
    photoKey: 'professional',
    highlights: ['Executive meetings', 'Client communication', 'Concise writing'],
  },
  {
    id: 'lifelong_english',
    title: 'Lifelong English',
    ageRange: '46+',
    tagline: 'Calm, welcoming pace for travel & everyday life',
    description:
      'Readable typography, clear navigation, and relaxed spoken practice for travel, family, and community.',
    layoutGroup: 'adult',
    accentHex: '#245C45',
    surfaceHex: '#F6F1E7',
    image: photo('lifelong').src,
    photoKey: 'lifelong',
    highlights: ['Unhurried pacing', 'Travel & hospitality', 'Large readable type'],
  },
];

export const CEFR_DESCRIPTIONS: Record<CefrLevel, { label: string; summary: string }> = {
  A1: { label: 'A1 — Beginner', summary: 'Everyday greetings, familiar objects, and simple spoken phrases.' },
  A2: { label: 'A2 — Elementary', summary: 'Routine conversations, polite requests, and short descriptions.' },
  B1: { label: 'B1 — Intermediate', summary: 'Expressing opinions, telling stories, and handling travel or school.' },
  B2: { label: 'B2 — Upper Intermediate', summary: 'Fluid discussions, clear arguments, and workplace or academic detail.' },
  C1: { label: 'C1 — Advanced', summary: 'Persuasive briefings, nuanced debates, and spontaneous fluency.' },
  C2: { label: 'C2 — Proficient', summary: 'Expressive precision, idiomatic nuance, and complex synthesis.' },
};

export function getEnvironmentMeta(env?: string): EnvironmentMeta {
  return ENVIRONMENTS.find((e) => e.id === env) || ENVIRONMENTS[3];
}
