import { useEffect, useState } from 'react';
import { ApiStatus } from '../../components/shared/ApiStatus';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { useRealtimeContext, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { problemApi, submissionApi, executionApi, type ProblemRecord, type LanguageRecord } from '../../lib/api';
import { CodeWorkspace } from '../../components/workspace/CodeWorkspace';
import { SplitLayout } from '../../components/shared/SplitLayout';

export function PracticeScreen({
  userId,
  problemId,
  mode,
  onReviewSubmission,
  onBack,
}: {
  userId: string;
  problemId: string;
  mode: 'upsolve';
  onBack: () => void;
  onReviewSubmission?: (submissionId: string) => void;
}) {
  const { subscribeToSubmission } = useRealtimeContext();
  const [problem, setProblem] = useState<ProblemRecord | null>(null);
  const [languages, setLanguages] = useState<LanguageRecord[]>([]);
  
  const [activeTab, setActiveTab] = useState<'output' | 'tests' | 'opponent' | 'rankings'>('tests');
  const [verdict, setVerdict] = useState('Ready to submit');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);

  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [initialLanguage, setInitialLanguage] = useState<string | null>(null);

  useEffect(() => {
    void problemApi.getProblem(problemId).then((res) => {
        setProblem(res);
        if (res.lastSubmission) {
            setInitialCode(res.lastSubmission.code);
            setInitialLanguage(res.lastSubmission.language);
        }
    }).catch((caughtError) => setError((caughtError as Error).message));
    void executionApi.getLanguages().then(setLanguages).catch(console.error);
  }, [problemId]);

  useEffect(() => {
    if (submissionId) subscribeToSubmission(submissionId);
  }, [submissionId, subscribeToSubmission]);

  useRealtimeEvent('evaluation_complete', (payload: any) => {
    if (payload.submissionId === submissionId) {
      setIsSubmitting(false);
      setVerdict(`${payload.status} · ${payload.passed}/${payload.total} tests`);
      if (payload.compileError) {
        setError(payload.compileError);
      }
      setActiveTab('output');
      setSubmissionResult(payload);
    }
  });

  const submit = async (language: string, code: string) => {
    setSubmissionResult(null);
    setIsSubmitting(true);
    setVerdict('Queued for upsolve');
    setError(null);
    setActiveTab('output');

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
      {submissionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <GlowPanel className={`w-full max-w-xl space-y-6 p-8 text-center shadow-[0_0_20px_rgba(76,255,190,0.18)] ${submissionResult.status === 'Accepted' ? 'shadow-[0_0_20px_rgba(76,255,190,0.18)] border-accent-primary/50' : 'shadow-[0_0_20px_rgba(255,92,92,0.18)] border-accent-danger/50'}`}>
            <div className={`text-4xl font-black uppercase tracking-[0.1em] ${submissionResult.status === 'Accepted' ? 'text-accent-primary' : 'text-accent-danger'}`}>
              {submissionResult.status === 'Accepted' ? 'Well Done!' : submissionResult.status}
            </div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-text-secondary">
              {submissionResult.status === 'Accepted' ? 'Upsolve completed successfully' : 'Tests failed'}
            </p>
            <div className="rounded-lg border border-border-hairline bg-bg-panel-raised p-4 text-sm text-text-primary flex flex-col gap-2">
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-secondary">Problem:</span>
                <span className="font-medium">{problem?.title ?? 'Problem solved'}</span>
              </div>
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-secondary">Tests Passed:</span>
                <span className="font-mono">{submissionResult.passed} / {submissionResult.total}</span>
              </div>
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-secondary">Execution Time:</span>
                <span className="font-mono">{submissionResult.executionTimeMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Memory Used:</span>
                <span className="font-mono">{submissionResult.memoryUsedMb}MB</span>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Button variant="ghost" onClick={() => setSubmissionResult(null)}>Close</Button>
              
            </div>
          </GlowPanel>
        </div>
      )}

      <GlowPanel className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Badge label={mode.toUpperCase()} tone="electric" />
          {mode === 'upsolve' && problem?.pastSubmissions && problem.pastSubmissions.length > 0 && (
            <button 
              onClick={() => setShowSubmissionsModal(true)}
              className="text-[10px] uppercase tracking-[0.18em] text-accent-primary hover:text-white transition-colors border border-accent-primary/50 hover:border-accent-primary rounded px-3 py-1"
            >
              Past Submissions ({problem.pastSubmissions.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
        </div>
      </GlowPanel>

      {showSubmissionsModal && problem?.pastSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border-hairline bg-bg-panel p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-medium tracking-[0.1em] text-text-primary uppercase font-mono">
                Past Submissions
              </h2>
              <button onClick={() => setShowSubmissionsModal(false)} className="text-text-secondary hover:text-white font-bold text-xl">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {problem.pastSubmissions.map(sub => (
                <div 
                  key={sub.id} 
                  className="rounded-lg border border-border-hairline bg-bg-panel-raised p-4 flex justify-between items-center cursor-pointer hover:border-accent-primary/50 transition-colors"
                  onClick={() => {
                    if (onReviewSubmission) onReviewSubmission(sub.id);
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <span className={`font-bold uppercase tracking-wider text-sm ${sub.status === 'Accepted' ? 'text-accent-primary' : 'text-accent-danger'}`}>
                      {sub.status}
                    </span>
                    <span className="text-xs text-text-secondary font-mono">{sub.language}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-text-secondary">
                      {new Date(sub.submittedAt).toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-text-secondary">
                      {sub.executionTimeMs}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowSubmissionsModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <SplitLayout
        left={
          <GlowPanel className="space-y-5 h-full xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-text-secondary">Practice problem</span>
              <Badge label={problem?.difficulty ?? 'MEDIUM'} tone="electric" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-text-primary">{problem?.title ?? 'Loading problem...'}</h1>
              <div className="mt-4 text-sm leading-7 text-text-primary" dangerouslySetInnerHTML={{ __html: problem?.description ?? 'Fetching the upsolve problem details.' }}></div>
            </div>

            <div className="border-t border-border-hairline pt-4">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-text-secondary">Problem brief</p>
              <div className="grid grid-cols-2 gap-2">
                <ApiStatus label="Time" value={`${problem?.timeLimit ?? 2}s`} />
                <ApiStatus label="Memory" value={`${problem?.memoryLimit ?? 256}MB`} />
              </div>
            </div>
          </GlowPanel>
        }
        right={
          <CodeWorkspace 
            problemId={problemId}
            problem={problem}
            languages={languages}
            isSubmitting={isSubmitting}
            submitLabel="Submit solution"
            onSubmit={submit}
            verdict={verdict}
            setVerdict={setVerdict}
            error={error}
            setError={setError}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            showOpponentTab={false}
            initialCode={initialCode}
            initialLanguage={initialLanguage}
          />
        }
      />
    </main>
  );
}
