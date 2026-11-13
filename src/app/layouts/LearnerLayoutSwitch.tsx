import { ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getEnvironmentMeta } from '../../utils/environments';
import { KidsLayout } from './KidsLayout';
import { TeenLayout } from './TeenLayout';
import { AdultLayout } from './AdultLayout';

export function LearnerLayoutSwitch({ children }: { children: ReactNode }) {
  const { learnerProfile } = useAuthStore();
  const meta = getEnvironmentMeta(learnerProfile?.environment);

  if (meta.layoutGroup === 'kids') {
    return <KidsLayout>{children}</KidsLayout>;
  }
  if (meta.layoutGroup === 'teen') {
    return <TeenLayout>{children}</TeenLayout>;
  }
  return <AdultLayout>{children}</AdultLayout>;
}
