import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, Headphones, Mic, PenTool, Sparkles } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { Course } from '../../types/sauti';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';

interface SkillHubProps {
  skill: 'Listening' | 'Reading' | 'Writing' | 'Vocabulary' | 'Grammar' | 'Challenges';
}

export function SkillHubPage({ skill }: SkillHubProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const { speak } = useSpeechPlayback();
  const [vocabIndex, setVocabIndex] = useState(0);

  const vocabCards = [
    { word: 'Resilient', definition: 'Able to recover and keep speaking with confidence.', example: 'Resilient learners practise a little every day.' },
    { word: 'Clarify', definition: 'To make an idea easier for listeners to understand.', example: 'Could you clarify the timeline for our project?' },
    { word: 'Hospitality', definition: 'Warm, generous welcome given to guests and travellers.', example: 'East African hospitality makes visitors feel right at home.' },
  ];

  useEffect(() => {
    apiFetch<{ courses: Course[] }>('/api/learning/courses')
      .then((res) => setCourses(res.courses || []))
      .catch(() => {});
  }, [skill]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#245C45] mb-1">Focused Skill Practice</p>
          <h1 className="font-display text-3xl font-bold">{skill} Studio</h1>
        </div>
        <Link
          to="/learn/speaking"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
        >
          <Mic className="w-4 h-4" /> Open Voice Studio
        </Link>
      </div>

      {/* Interactive Flashcard / Quick Practice */}
      <div className="rounded-3xl bg-white border border-[#245C45]/12 p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#245C45]">
            {skill === 'Challenges' ? (
              <><Flame className="w-4 h-4 inline mr-1" /> Daily Speaking Challenge</>
            ) : skill === 'Writing' ? (
              <><PenTool className="w-4 h-4 inline mr-1" /> Expressive Prompt</>
            ) : skill === 'Listening' ? (
              <><Headphones className="w-4 h-4 inline mr-1" /> Quick Audio Drill</>
            ) : (
              <><Sparkles className="w-4 h-4 inline mr-1" /> Active Word Card</>
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

        <h2 className="font-display text-2xl font-bold">{vocabCards[vocabIndex].word}</h2>
        <p className="text-sm text-[#4A5851]">{vocabCards[vocabIndex].definition}</p>
        <p className="text-sm italic text-[#17201C]">&ldquo;{vocabCards[vocabIndex].example}&rdquo;</p>
        <button
          type="button"
          onClick={() => speak(`${vocabCards[vocabIndex].word}. ${vocabCards[vocabIndex].example}`)}
          className="px-4 py-2 rounded-xl bg-[#FDF3E3] text-[#245C45] text-xs font-semibold"
        >
          Hear pronunciation &amp; example
        </button>
      </div>

      {/* Matching Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map((course) => (
          <Link
            key={course.id}
            to={`/learn/courses/${course.id}`}
            className="rounded-2xl bg-white border border-[#245C45]/12 p-6 hover:border-[#245C45] transition-colors flex flex-col justify-between"
          >
            <div>
              <p className="text-xs text-[#4A5851] mb-1">
                {course.cefrLevel} · {course.skillFocus}
              </p>
              <h3 className="font-display text-lg font-bold mb-2">{course.title}</h3>
              <p className="text-sm text-[#4A5851] mb-4">{course.description}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#245C45]">
              Start lesson <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
