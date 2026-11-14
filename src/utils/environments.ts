import { AgeRange, CefrLevel, LearningEnvironment } from '../types/sauti';

import heroVoicesImg from '../assets/images/hero_sauti_voices_1794596039213.jpg';
import littleVoicesImg from '../assets/images/journey_little_voices_1794596040249.jpg';
import teenAdultImg from '../assets/images/journey_teen_adult_1794596040545.jpg';
import professionalLifelongImg from '../assets/images/journey_professional_lifelong_1794596041360.jpg';
import voiceCompanionImg from '../assets/images/voice_studio_companion_1794596041274.jpg';

export const SAUTI_IMAGES = {
  heroVoices: heroVoicesImg,
  littleVoices: littleVoicesImg,
  teenAdult: teenAdultImg,
  professionalLifelong: professionalLifelongImg,
  voiceCompanion: voiceCompanionImg,
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
  highlights: string[];
}

export const ENVIRONMENTS: EnvironmentMeta[] = [
  {
    id: 'little_voices',
    title: 'Little Voices',
    ageRange: '3-5',
    tagline: 'Playful sounds, picture stories & first words',
    description:
      'Audio-led discovery with friendly illustrations, oversized touch targets, and gentle letter-sound songs.',
    layoutGroup: 'kids',
    accentHex: '#F28B75',
    surfaceHex: '#FFF1E6',
    image: SAUTI_IMAGES.littleVoices,
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
    image: SAUTI_IMAGES.littleVoices,
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
    image: SAUTI_IMAGES.teenAdult,
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
    image: SAUTI_IMAGES.teenAdult,
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
    image: SAUTI_IMAGES.professionalLifelong,
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
    image: SAUTI_IMAGES.professionalLifelong,
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
