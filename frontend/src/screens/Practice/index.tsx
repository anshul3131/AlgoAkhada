import { useEffect, useState } from 'react';
import { ApiStatus } from '../../components/shared/ApiStatus';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { useRealtimeContext, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { problemApi, submissionApi, type ProblemRecord } from '../../lib/api';

const initialCode = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // solve the problem here
    return 0;
}`;

export function PracticeScreen({
  userId,
  problemId,
  mode,
  onBack,
}: {
  userId: string;
  problemId: string;
  mode: 'upsolve';
  onBack: () => void;
}) {
  const { subscribeToSubmission } = useRealtimeContext();
  const [problem, setProblem] = useState<ProblemRecord | null>(null);
  const [language, setLanguage] = useState('C++');
  const [code, setCode] = useState(initialCode);
  const [verdict, setVerdict] = useState('Ready to submit');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void problemApi.getProblem(problemId)
      .then(setProblem)
      .catch((caughtError) => setError((caughtError as Error).message));
  }, [problemId]);

  useEffect(() => {
    if (submissionId) {
      subscribeToSubmission(submissionId);
    }
  }, [submissionId, subscribeToSubmission]);

  useRealtimeEvent('evaluation_complete', (payload) => {
    if (payload.submissionId === submissionId) {
      setIsSubmitting(false);
      const nextVerdict = `${payload.status} · ${payload.passed}/${payload.total} tests`;
      setVerdict(nextVerdict);
      if (payload.status === 'Accepted') {
        setShowSuccess(true);
      }
    }
  });

  const submit = async () => {
    setShowSuccess(false);
    setIsSubmitting(true);
    setVerdict('Queued for upsolve');
    setError(null);

    try {
      const submission = await submissionApi.submitCode({ userId, problemId, language, code }, mode);
      setSubmissionId(submission.id);
      setVerdict('Running against hidden tests');
    } catch (caughtError) {
      setIsSubmitting(false);
      setError((caughtError as Error).message);
      setVerdict('Failed to submit');
    }
  };

  return (
    <main className="mx-auto max-w-[1500px] p-4 md:p-6">
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-void/85 backdrop-blur-sm">
          <GlowPanel className="w-full max-w-xl space-y-6 p-8 text-center shadow-[0_0_20px_rgba(76,255,190,0.18)]">
            <div className="text-5xl font-black uppercase tracking-[0.18em] text-accent-primary">Well Done!</div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-text-secondary">Upsolve completed successfully</p>
            <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-4 py-3 text-sm text-text-primary">
              <span className="font-mono text-accent-primary">Accepted</span> · {problem?.title ?? 'Problem solved'}
            </div>
            <Button onClick={onBack}>Return to Lobby</Button>
          </GlowPanel>
        </div>
      )}

      <GlowPanel className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Badge label={mode.toUpperCase()} tone="electric" />
          <span className="font-mono text-sm text-text-secondary">problem/{problemId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack}>Back to lobby</Button>
        </div>
      </GlowPanel>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <GlowPanel className="space-y-5 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-text-secondary">Practice problem</span>
            <Badge label={problem?.difficulty ?? 'MEDIUM'} tone="electric" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold">{problem?.title ?? 'Loading problem...'}</h1>
            <p className="mt-4 text-sm leading-7 text-text-secondary">{problem?.description ?? 'Fetching the upsolve problem details.'}</p>
          </div>

          <div className="border-t border-border-hairline pt-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-text-secondary">Problem brief</p>
            <div className="grid grid-cols-2 gap-2">
              <ApiStatus label="Time" value={`${problem?.timeLimit ?? 2}s`} />
              <ApiStatus label="Memory" value={`${problem?.memoryLimit ?? 256}MB`} />
            </div>
          </div>
        </GlowPanel>

        <div className="space-y-4">
          <GlowPanel className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 font-mono text-sm text-text-primary"
              >
                <option>C++</option>
                <option>PYTHON</option>
              </select>
              <Badge label="Practice mode" tone="primary" />
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setVerdict('Sample tests queued')}>Run samples</Button>
              <Button variant="primary" onClick={submit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit solution'}
              </Button>
            </div>
          </GlowPanel>

          <GlowPanel className="p-2">
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              spellCheck={false}
              className="min-h-[390px] w-full resize-y rounded-lg bg-black p-5 font-mono text-sm leading-7 text-text-mono outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </GlowPanel>

          <GlowPanel>
            <div className="space-y-2 font-mono text-sm text-text-secondary">
              <div className="rounded-lg border border-border-hairline p-3">
                <span className={verdict.includes('Accepted') || verdict.includes('Queued') || verdict.includes('Running') ? 'text-accent-primary' : 'text-text-secondary'}>{verdict}</span>
                {error && <p className="mt-2 text-accent-danger">{error}</p>}
              </div>
            </div>
          </GlowPanel>
        </div>
      </div>
    </main>
  );
}
