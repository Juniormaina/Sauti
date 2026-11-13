import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PublicHeader } from '../../components/navigation/PublicHeader';
import { apiFetch } from '../../services/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatusMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Unable to submit reset request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C]">
      <PublicHeader />
      <main className="max-w-md mx-auto px-4 py-14">
        <div className="rounded-3xl bg-white border border-[#245C45]/12 p-7 sm:p-9">
          <h1 className="font-display text-2xl font-bold mb-2">Reset your password</h1>
          <p className="text-sm text-[#4A5851] mb-6">
            Enter the email address associated with your SAUTI account.
          </p>

          {statusMessage && (
            <div className="mb-5 rounded-xl bg-[#245C45]/10 border border-[#245C45]/25 p-4 text-sm text-[#17201C] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#245C45] shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl bg-[#F28B75]/15 border border-[#F28B75] p-3.5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold text-sm hover:bg-[#194231]"
            >
              {submitting ? 'Submitting...' : 'Send reset instructions'}
            </button>
          </form>

          <p className="text-center text-xs text-[#4A5851] mt-6">
            <Link to="/login" className="font-semibold text-[#245C45] hover:underline">
              Back to Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
