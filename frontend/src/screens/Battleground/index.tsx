import { useCallback, useEffect, useState } from 'react';
import { ApiStatus } from '../../components/shared/ApiStatus';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { Timer } from '../../components/shared/Timer';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';
import { useRealtimeContext, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { problemApi, submissionApi, type ProblemRecord } from '../../lib/api';

interface BattlegroundProps { token: string; userId: string; matchId: string; problemId: string; onFinished: (winnerId: string) => void; }
const initialCode = `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your solution\n    return 0;\n}`;

export function Battleground({ token, userId, matchId, problemId, onFinished }: BattlegroundProps) {
  const { joinMatch, subscribeToSubmission, finishMatchOnTimeout } = useRealtimeContext();
  const [problem, setProblem] = useState<ProblemRecord | null>(null);
  const [language, setLanguage] = useState('C++');
  const [code, setCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState<'output' | 'tests' | 'opponent'>('output');
  const [opponentStatus, setOpponentStatus] = useState('Watching the arena');
  const [verdict, setVerdict] = useState('Ready to submit');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimingOut, setIsTimingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    joinMatch(matchId);
    void problemApi.getProblem(problemId, token).then(setProblem).catch((caughtError) => setError((caughtError as Error).message));
  }, [joinMatch, matchId, problemId, token]);

  useEffect(() => { if (submissionId) subscribeToSubmission(submissionId); }, [submissionId, subscribeToSubmission]);

  useRealtimeEvent('opponent_status', (payload) => {
    if (payload.matchId === matchId && payload.userId !== userId) setOpponentStatus(payload.status.status);
  });
  useRealtimeEvent('evaluation_complete', (payload) => {
    if (payload.submissionId === submissionId) {
      setIsSubmitting(false);
      setVerdict(`${payload.status} · ${payload.passed}/${payload.total} tests`);
    }
  });
  useRealtimeEvent('match_result', (payload) => {
    if (payload.matchId === matchId) onFinished(payload.winnerId);
  });

  const handleTimeout = useCallback(() => {
    setIsTimingOut(true);
    setVerdict('Time expired · resolving match');
    finishMatchOnTimeout(matchId);
  }, [finishMatchOnTimeout, matchId]);

  const { remaining, pressureLevel } = useCountdownTimer(420, handleTimeout);

  const submit = async () => {
    setIsSubmitting(true);
    setVerdict('Queued for evaluation');
    setError(null);
    try {
      const submission = await submissionApi.submitCode(token, { userId, problemId, language, code });
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
        <div className="flex items-center gap-3"><Badge label="LIVE MATCH" tone="danger" /><span className="font-mono text-sm text-text-secondary">match/{matchId.slice(0, 8)}</span></div>
        <Timer value={remaining} pressure={pressureLevel} className="text-4xl" />
        <Badge label={`Opponent: ${opponentStatus}`} tone="primary" />
      </GlowPanel>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <GlowPanel className="space-y-5 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[0.2em] text-text-secondary">Assigned problem</span><Badge label={problem?.difficulty ?? 'MEDIUM'} tone="electric" /></div>
          <div><h1 className="text-2xl font-semibold">{problem?.title ?? 'Loading problem...'}</h1><p className="mt-4 text-sm leading-7 text-text-secondary">{problem?.description ?? 'Fetching the problem assigned to this match.'}</p></div>
          <div className="border-t border-border-hairline pt-4"><p className="mb-3 text-xs uppercase tracking-[0.2em] text-text-secondary">Match brief</p><div className="grid grid-cols-2 gap-2"><ApiStatus label="Time" value={`${problem?.timeLimit ?? 2}s`} /><ApiStatus label="Memory" value={`${problem?.memoryLimit ?? 256}MB`} /></div></div>
        </GlowPanel>

        <div className="space-y-4">
          <GlowPanel className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 font-mono text-sm text-text-primary"><option>C++</option><option>PYTHON</option></select><Badge label={isSubmitting ? 'Evaluating' : 'Draft saved locally'} tone={isSubmitting ? 'warn' : 'primary'} /></div>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setVerdict('Sample tests queued')} disabled={isTimingOut}>Run Samples</Button><Button variant="danger" onClick={submit} disabled={isSubmitting || isTimingOut}>{isTimingOut ? 'Resolving...' : isSubmitting ? 'Submitting...' : 'Submit Solution'}</Button></div>
          </GlowPanel>
          <GlowPanel className="p-2"><textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} className="min-h-[390px] w-full resize-y rounded-lg bg-black p-5 font-mono text-sm leading-7 text-text-mono outline-none focus:ring-1 focus:ring-accent-primary" /></GlowPanel>
          <GlowPanel>
            <div className="mb-4 flex gap-2">{(['output', 'tests', 'opponent'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${activeTab === tab ? 'border-accent-primary text-accent-primary' : 'border-border-hairline text-text-secondary'}`}>{tab}</button>)}</div>
            {activeTab === 'output' && <div className="font-mono text-sm"><span className={verdict.includes('Accepted') ? 'text-accent-primary' : 'text-text-secondary'}>{verdict}</span>{error && <p className="mt-2 text-accent-danger">{error}</p>}</div>}
            {activeTab === 'tests' && <div className="space-y-2 font-mono text-sm text-text-secondary"><div className="rounded-lg border border-border-hairline p-3">Visible tests <span className="float-right text-accent-primary">Ready</span></div><div className="rounded-lg border border-border-hairline p-3">Hidden tests <span className="float-right text-accent-warn">Server-side</span></div></div>}
            {activeTab === 'opponent' && <div className="font-mono text-sm text-text-secondary">Opponent status: <span className="text-accent-primary">{opponentStatus}</span></div>}
          </GlowPanel>
        </div>
      </div>
    </main>
  );
}
