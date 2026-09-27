import { useEffect, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { submissionApi } from '../../lib/api';
import type { SubmissionDetailRecord } from '../../types';
import Editor from '@monaco-editor/react';

export function RecentSolutionScreen({
  submissionId,
  onBack,
  onUpsolve
}: {
  submissionId: string;
  onBack: () => void;
  onUpsolve?: (problemId: string) => void;
}) {
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
    <main className="mx-auto max-w-[1400px] p-4 md:p-6 h-screen flex flex-col">
      <GlowPanel className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Review submission</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Your submitted solution</h1>
        </div>
        <div className="flex items-center gap-2">
          {submission && <Badge label={submission.language} tone="electric" />}
          {submission && onUpsolve && (
            <Button
              className="animate-pulse-glow"
              onClick={() => onUpsolve(submission.problemId)}
            >
              Make another submission
            </Button>
          )}
          <Button variant="ghost" onClick={onBack}>Back to lobby</Button>
        </div>
      </GlowPanel>

      {isLoading ? (
        <GlowPanel className="p-6 text-sm text-text-secondary grow flex items-center justify-center">Loading your solution...</GlowPanel>
      ) : error ? (
        <GlowPanel className="border border-accent-danger/60 bg-accent-danger/10 p-6 text-sm text-accent-danger shrink-0">{error}</GlowPanel>
      ) : submission ? (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)] grow min-h-0">
          <GlowPanel className="space-y-4 shrink-0 overflow-y-auto">
            <div className="rounded-lg border border-border-hairline bg-bg-panel-raised p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Problem</p>
              <p className="mt-2 text-sm text-text-primary font-medium">{submission.problemTitle || submission.problemId}</p>
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

          <GlowPanel className="flex flex-col min-h-0 relative h-[600px] xl:h-auto">
            <div className="mb-3 flex items-center justify-between shrink-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Code Editor</p>
              <Button
                variant="ghost"
                className="px-3 py-2 text-[10px]"
                onClick={() => navigator.clipboard?.writeText(submission.code).catch(() => undefined)}
              >
                Copy Code
              </Button>
            </div>
            <div className="grow border border-border-hairline rounded-xl overflow-hidden bg-[#1e1e1e] relative min-h-[400px]">
              <Editor
                height="100%"
                language={submission.language === 'python' ? 'python' : submission.language === 'cpp' ? 'cpp' : 'java'}
                theme="vs-dark"
                value={submission.code}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  padding: { top: 16, bottom: 16 },
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              />
            </div>
          </GlowPanel>
        </div>
      ) : null}
    </main>
  );
}
