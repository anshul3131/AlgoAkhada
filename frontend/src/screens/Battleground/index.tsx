import { useCallback, useEffect, useState } from 'react';
import { ApiStatus } from '../../components/shared/ApiStatus';
import { Badge } from '../../components/shared/Badge';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { Timer } from '../../components/shared/Timer';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';
import { useRealtimeContext, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { problemApi, submissionApi, executionApi, type ProblemRecord, type LanguageRecord } from '../../lib/api';
import { CodeWorkspace } from '../../components/workspace/CodeWorkspace';
import { SplitLayout } from '../../components/shared/SplitLayout';

interface BattlegroundProps { userId: string; matchId: string; problemId: string; onFinished: (winnerId: string) => void; startTime?: string; }

export function Battleground({ userId, matchId, problemId, onFinished, startTime }: BattlegroundProps) {
  const { joinMatch, leaveMatch, updateMatchCode, subscribeToSubmission, finishMatchOnTimeout, forfeitMatch } = useRealtimeContext();
  const [problem, setProblem] = useState<ProblemRecord | null>(null);
  const [languages, setLanguages] = useState<LanguageRecord[]>([]);
  
  const [activeTab, setActiveTab] = useState<'output' | 'tests' | 'opponent' | 'rankings'>('tests');
  const [opponentStatus, setOpponentStatus] = useState('Watching the arena');
  const [verdict, setVerdict] = useState('Ready to submit');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimingOut, setIsTimingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    joinMatch(matchId);
    void problemApi.getProblem(problemId).then(setProblem).catch((caughtError) => setError((caughtError as Error).message));
    void executionApi.getLanguages().then(setLanguages).catch(console.error);

    return () => {
      leaveMatch(matchId);
    };
  }, [joinMatch, leaveMatch, matchId, problemId]);

  useEffect(() => { if (submissionId) subscribeToSubmission(submissionId); }, [submissionId, subscribeToSubmission]);

  useRealtimeEvent('opponent_status', (payload) => {
    if (payload.matchId === matchId && payload.userId !== userId) setOpponentStatus(payload.status.status);
  });
  useRealtimeEvent('evaluation_complete', (payload: any) => {
    if (payload.submissionId === submissionId) {
      setIsSubmitting(false);
      setVerdict(`${payload.status} · ${payload.passed}/${payload.total} tests`);
      if (payload.compileError) {
        setError(payload.compileError);
      }
      setActiveTab('output');
    }
  });
  useRealtimeEvent('match_result', (payload) => {
    if (payload.matchId === matchId) onFinished(payload.winnerId);
  });

  const [spectatorCount, setSpectatorCount] = useState(0);
  useRealtimeEvent('spectator_count', (count) => {
    setSpectatorCount(count);
  });

  const handleTimeout = useCallback(() => {
    setIsTimingOut(true);
    setVerdict('Time expired · resolving match');
    finishMatchOnTimeout(matchId);
  }, [finishMatchOnTimeout, matchId]);

  const [timerSeconds, setTimerSeconds] = useState(1800);

  useEffect(() => {
    if (startTime) {
      const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
      setTimerSeconds(Math.max(1, 1800 - Math.floor(elapsed)));
    } else {
      setTimerSeconds(1800);
    }
  }, [startTime]);

  const { remaining, pressureLevel } = useCountdownTimer(timerSeconds, handleTimeout);

  const submit = async (language: string, code: string) => {
    setIsSubmitting(true);
    setVerdict('Queued for evaluation');
    setError(null);
    setActiveTab('output');
    try {
      const submission = await submissionApi.submitCode({ userId, problemId, language, code });
      setSubmissionId(submission.id);
      setVerdict('Running against hidden tests');
    } catch (caughtError) {
      setIsSubmitting(false);
      setError((caughtError as Error).message);
    }
  };

  return (
    <main className="mx-auto max-w-[1500px] p-4 md:p-6">
      <GlowPanel className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Badge label="LIVE MATCH" tone="danger" />
          <span className="font-mono text-sm text-text-secondary">match/{matchId.slice(0, 8)}</span>
          {spectatorCount > 0 && <Badge label={`👁️ ${spectatorCount}`} tone="electric" />}
        </div>
        <Timer value={remaining} pressure={pressureLevel} className="text-4xl" />
        <div className="flex items-center gap-4">
          <Badge label={`Opponent: ${opponentStatus}`} tone="primary" />
          <button 
            onClick={() => {
              if (window.confirm("Are you sure you want to forfeit this match? Your opponent will win.")) {
                forfeitMatch(matchId);
              }
            }}
            className="rounded bg-accent-danger/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-accent-danger transition-colors hover:bg-accent-danger hover:text-white"
          >
            Forfeit Match
          </button>
        </div>
      </GlowPanel>

      <SplitLayout
        left={
          <GlowPanel className="space-y-5 h-full xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
            <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[0.2em] text-text-secondary">Assigned problem</span><Badge label={problem?.difficulty ?? 'MEDIUM'} tone="electric" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">{problem?.title ?? 'Loading problem...'}</h1>
              <div className="mt-4 text-sm leading-7 text-text-primary" dangerouslySetInnerHTML={{ __html: problem?.description ?? 'Fetching the problem assigned to this match.' }}></div>
            </div>
            <div className="border-t border-border-hairline pt-4"><p className="mb-3 text-xs uppercase tracking-[0.2em] text-text-secondary">Match brief</p><div className="grid grid-cols-2 gap-2"><ApiStatus label="Time" value={`${problem?.timeLimit ?? 2}s`} /><ApiStatus label="Memory" value={`${problem?.memoryLimit ?? 256}MB`} /></div></div>
          </GlowPanel>
        }
        right={
          <CodeWorkspace 
            problemId={problemId}
            problem={problem}
            languages={languages}
            isSubmitting={isSubmitting}
            isTimingOut={isTimingOut}
            submitLabel="Submit Solution"
            onSubmit={submit}
            onCodeChange={(c, l) => updateMatchCode(matchId, c, l)}
            verdict={verdict}
            setVerdict={setVerdict}
            error={error}
            setError={setError}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            showOpponentTab={true}
            opponentStatus={opponentStatus}
          />
        }
      />
    </main>
  );
}
