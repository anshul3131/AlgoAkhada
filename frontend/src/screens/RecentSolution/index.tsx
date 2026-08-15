import { useEffect, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { submissionApi } from '../../lib/api';
import type { SubmissionDetailRecord } from '../../types';

export function RecentSolutionScreen({ submissionId, onBack }: { submissionId: string; onBack: () => void }) {
  const [submission, setSubmission] = useState<SubmissionDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSubmission = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextSubmission = await submissionApi.getSubmission(submissionId);
        setSubmission(nextSubmission);
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSubmission();
  }, [submissionId]);

  return (
    <main className="mx-auto max-w-[1400px] p-4 md:p-6">
      <GlowPanel className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Review submission</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Your submitted solution</h1>
        </div>
        <div className="flex items-center gap-2">
          {submission && <Badge label={submission.language} tone="electric" />}
          <Button variant="ghost" onClick={onBack}>Back to lobby</Button>
        </div>
      </GlowPanel>

      {isLoading ? (
        <GlowPanel className="p-6 text-sm text-text-secondary">Loading your solution...</GlowPanel>
      ) : error ? (
        <GlowPanel className="border border-accent-danger/60 bg-accent-danger/10 p-6 text-sm text-accent-danger">{error}</GlowPanel>
      ) : submission ? (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <GlowPanel className="space-y-4">
            <div className="rounded-lg border border-border-hairline bg-bg-panel-raised p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Problem ID</p>
              <p className="mt-2 font-mono text-sm text-text-primary">{submission.problemId}</p>
            </div>
            <div className="rounded-lg border border-border-hairline bg-bg-panel-raised p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Language</p>
              <p className="mt-2 font-mono text-sm text-text-primary">{submission.language}</p>
            </div>
            <div className="rounded-lg border border-border-hairline bg-bg-panel-raised p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Verdict</p>
              <p className="mt-2 text-sm font-semibold text-accent-primary">{submission.status}</p>
            </div>
          </GlowPanel>

          <GlowPanel className="overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Code</p>
              <Button
                variant="ghost"
                className="px-3 py-2 text-[10px]"
                onClick={() => navigator.clipboard?.writeText(submission.code).catch(() => undefined)}
              >
                Copy
              </Button>
            </div>
            <pre className="max-h-[70vh] overflow-auto rounded-xl border border-border-hairline bg-black p-4 font-mono text-sm leading-7 text-text-mono whitespace-pre-wrap">
              {submission.code}
            </pre>
          </GlowPanel>
        </div>
      ) : null}
    </main>
  );
}
