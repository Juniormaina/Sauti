import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Building2, GraduationCap, ShieldCheck, User } from 'lucide-react';
import { PublicHeader } from '../../components/navigation/PublicHeader';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { ENVIRONMENTS } from '../../utils/environments';

export function GetStartedPage() {
  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C]">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="max-w-3xl mb-12">
          <p className="text-sm font-semibold text-[#245C45] mb-2">Choose your learning journey</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight headline-balance mb-4">
            Every age deserves its own space—and every level from A1 to C2.
          </h1>
          <p className="text-base text-[#4A5851] leading-relaxed">
            Select the learning environment that fits your stage of life, or choose a Parent,
            Teacher, or School entry point below. You will set your English proficiency level during
            onboarding.
          </p>
        </div>

        {/* Role Entry Points */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          <Link
            to="/register?accountType=individual"
            className="rounded-2xl bg-white border border-[#245C45]/15 p-5 hover:border-[#245C45] transition-colors flex flex-col justify-between"
          >
            <div>
              <User className="w-5 h-5 text-[#245C45] mb-3" />
              <h2 className="font-display font-bold text-lg mb-1">Individual Learner</h2>
              <p className="text-xs text-[#4A5851] leading-relaxed">
                For teens (with guidance) and adults building fluency at their own pace.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#245C45]">
              Register individually <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/register?accountType=parent"
            className="rounded-2xl bg-[#FFF1E6] border border-[#F28B75]/40 p-5 hover:border-[#F28B75] transition-colors flex flex-col justify-between"
          >
            <div>
              <ShieldCheck className="w-5 h-5 text-[#245C45] mb-3" />
              <h2 className="font-display font-bold text-lg mb-1">Parent &amp; Guardian</h2>
              <p className="text-xs text-[#4A5851] leading-relaxed">
                Register children safely with consent controls and calm progress visibility.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#245C45]">
              Register a child <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/register?accountType=teacher"
            className="rounded-2xl bg-white border border-[#245C45]/15 p-5 hover:border-[#245C45] transition-colors flex flex-col justify-between"
          >
            <div>
              <GraduationCap className="w-5 h-5 text-[#245C45] mb-3" />
              <h2 className="font-display font-bold text-lg mb-1">Teacher</h2>
              <p className="text-xs text-[#4A5851] leading-relaxed">
                Manage classrooms, invite learners with join codes, and assign courses.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#245C45]">
              Create teacher account <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/register?accountType=institution"
            className="rounded-2xl bg-white border border-[#245C45]/15 p-5 hover:border-[#245C45] transition-colors flex flex-col justify-between"
          >
            <div>
              <Building2 className="w-5 h-5 text-[#245C45] mb-3" />
              <h2 className="font-display font-bold text-lg mb-1">School &amp; Institution</h2>
              <p className="text-xs text-[#4A5851] leading-relaxed">
                Onboard school cohorts with structured CEFR speaking and listening pathways.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#245C45]">
              Institution entry <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>

        {/* Six Learning Environments */}
        <h2 className="font-display text-2xl font-bold mb-6">Six Age-Specific Environments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ENVIRONMENTS.map((env, idx) => {
            const isChild = env.id === 'little_voices' || env.id === 'young_explorers';
            const registerUrl = isChild
              ? `/register?accountType=parent&environment=${env.id}`
              : `/register?accountType=individual&environment=${env.id}`;

            return (
              <motion.div
                key={env.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-3xl border border-[#245C45]/12 overflow-hidden bg-white flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden" style={{ backgroundColor: env.surfaceHex }}>
                  <ResilientImage
                    src={env.image}
                    alt={env.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <p className="text-xs font-semibold text-[#4A5851] mb-1">
                    Ages {env.ageRange} · {env.layoutGroup === 'kids' ? 'Playful Studio' : env.layoutGroup === 'teen' ? 'Expressive Studio' : 'Editorial Workspace'}
                  </p>
                  <h3 className="font-display text-2xl font-bold mb-2">{env.title}</h3>
                  <p className="text-sm text-[#4A5851] leading-relaxed mb-4">{env.description}</p>
                  <ul className="space-y-1.5 text-xs text-[#245C45] font-medium mb-6 flex-1">
                    {env.highlights.map((h) => (
                      <li key={h}>· {h}</li>
                    ))}
                  </ul>
                  <Link
                    to={registerUrl}
                    className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231] transition-colors"
                  >
                    <span>{isChild ? `Start via Parent Setup` : `Choose ${env.title}`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
