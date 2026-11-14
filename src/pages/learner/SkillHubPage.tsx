import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Flame, Headphones, Mic, PenTool, Sparkles, Volume2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { Course } from '../../types/sauti';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';
import { MotionCard, PageTransition, SAUTI_EASE } from '../../components/motion/SautiMotion';

interface SkillHubProps {
  skill: 'Listening' | 'Reading' | 'Writing' | 'Vocabulary' | 'Grammar' | 'Challenges';
}

export function SkillHubPage({ skill }: SkillHubProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const { speak } = useSpeechPlayback();
  const [vocabIndex, setVocabIndex] = useState(0);
  const reduced = useReducedMotion();

  const vocabCards = [
    {
      word: 'Resilient',
      definition: 'Able to recover and keep speaking with confidence.',
      example: 'Resilient learners practise a little every day.',
    },
    {
      word: 'Clarify',
      definition: 'To make an idea easier for listeners to understand.',
      example: 'Could you clarify the timeline for our project?',
    },
    {
      word: 'Hospitality',
      definition: 'Warm, generous welcome given to guests and travellers.',
      example: 'East African hospitality makes visitors feel right at home.',
    },
  ];

  useEffect(() => {
    apiFetch<{ courses: Course[] }>('/api/learning/courses')
      .then((res) => setCourses(res.courses || []))
      .catch(() => {});
  }, [skill]);

  const card = vocabCards[vocabIndex];

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-semibold text-[#245C45] mb-1">
            Focused Skill Practice
          </p>
          <h1 className="font-display text-3xl font-bold">{skill} Studio</h1>
        </div>
        <Link
          to="/learn/speaking"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231] transition-colors"
        >
          <Mic className="w-4 h-4" /> Open Voice Studio
        </Link>
      </div>

      {/* Interactive Flashcard / Quick Practice */}
      <div className="rounded-3xl sauti-surface p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#245C45]">
            {skill === 'Challenges' ? (
              <>
                <Flame className="w-4 h-4 inline mr-1" /> Daily Speaking Challenge
              </>
            ) : skill === 'Writing' ? (
              <>
                <PenTool className="w-4 h-4 inline mr-1" /> Expressive Prompt
              </>
            ) : skill === 'Listening' ? (
              <>
                <Headphones className="w-4 h-4 inline mr-1" /> Quick Audio Drill
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 inline mr-1" /> Active Word Card
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setVocabIndex((prev) => (prev + 1) % vocabCards.length)}
            className="text-xs font-semibold text-[#245C45] hover:underline"
          >
            Next card →
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={card.word}
            initial={reduced ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: SAUTI_EASE }}
            className="space-y-2"
          >
            <h2 className="font-display text-2xl font-bold">{card.word}</h2>
            <p className="text-sm text-[#4A5851]">{card.definition}</p>
            <p className="text-sm italic text-[#17201C]">&ldquo;{card.example}&rdquo;</p>
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          onClick={() => speak(`${card.word}. ${card.example}`)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FDF3E3] text-[#245C45] text-xs font-semibold hover:bg-[#F6C96B]/30 transition-colors"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Hear pronunciation &amp; example</span>
        </button>
      </div>

      {/* Matching Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map((course) => (
          <MotionCard key={course.id} className="h-full">
            <Link
              to={`/learn/courses/${course.id}`}
              className="h-full rounded-2xl sauti-surface p-6 hover:border-[#245C45] transition-colors flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-mono text-[#4A5851] mb-1">
                  {course.cefrLevel} · {course.skillFocus}
                </p>
                <h3 className="font-display text-lg font-bold mb-2">{course.title}</h3>
                <p className="text-sm text-[#4A5851] mb-4">{course.description}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#245C45]">
                Start lesson <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </MotionCard>
        ))}
      </div>
    </PageTransition>
  );
}
