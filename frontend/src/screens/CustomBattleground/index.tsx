import { useCallback, useEffect, useState } from 'react';
import { ApiStatus } from '../../components/shared/ApiStatus';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { Timer } from '../../components/shared/Timer';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';
import { useRealtimeContext, useRealtimeEvent, useSocket } from '../../providers/RealtimeProvider';
import { problemApi, submissionApi, executionApi, customMatchApi, type ProblemRecord, type LanguageRecord } from '../../lib/api';
import { CodeWorkspace } from '../../components/workspace/CodeWorkspace';
import { SplitLayout } from '../../components/shared/SplitLayout';

interface CustomBattlegroundProps { userId: string; lobbyId: string; problemId: string; onFinished: (result: any) => void; onLobby: () => void; }

export function CustomBattleground({ userId, lobbyId, problemId, onFinished, onLobby }: CustomBattlegroundProps) {
  const { subscribeToSubmission } = useRealtimeContext();
  const socket = useSocket();
  const [problem, setProblem] = useState<ProblemRecord | null>(null);
  const [languages, setLanguages] = useState<LanguageRecord[]>([]);
  
  const [activeTab, setActiveTab] = useState<'output' | 'tests' | 'opponent' | 'rankings'>('tests');
  const [verdict, setVerdict] = useState('Ready to submit');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimingOut, setIsTimingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(420);
  const [submissionModal, setSubmissionModal] = useState<any>(null);
  const [matchResultModal, setMatchResultModal] = useState<any[] | null>(null);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  useEffect(() => {
    void problemApi.getProblem(problemId).then(setProblem).catch((caughtError) => setError((caughtError as Error).message));
    void executionApi.getLanguages().then(setLanguages).catch(console.error);
    void customMatchApi.getMatch(lobbyId).then(match => {
        if (match && match.timeLimit) {
            if (match.startedAt) {
                const elapsedSeconds = Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000);
                setTimerSeconds(Math.max(1, match.timeLimit - elapsedSeconds));
            } else {
                setTimerSeconds(match.timeLimit);
            }
        }
        if (socket) {
            socket.emit('custom_lobby_join', { lobbyId });
        }
        if (match && match.participants) {
            setLeaderboard(match.participants.map((p: any) => ({
                userId: p.userId,
                username: p.username,
                score: p.score,
                status: p.status,
            })).sort((a: any, b: any) => (b.score || 0) - (a.score || 0)));
        }
    }).catch(console.error);
  }, [problemId, lobbyId, socket]);

  useEffect(() => { if (submissionId) subscribeToSubmission(submissionId); }, [submissionId, subscribeToSubmission]);

  useRealtimeEvent('evaluation_complete', (payload: any) => {
    if (payload.submissionId === submissionId) {
      setIsSubmitting(false);
      setVerdict(`${payload.status} · ${payload.passed}/${payload.total} tests`);
      if (payload.compileError) {
        setError(payload.compileError);
      }
      if (payload.status === 'Accepted') {
        setHasAccepted(true);
      }
      setActiveTab('output');
      setSubmissionModal(payload);
    }
  });

  const handleExitMatch = useCallback(() => {
    if (socket) socket.emit('custom_lobby_leave_match', { lobbyId });
    onLobby();
  }, [lobbyId, socket, onLobby]);

  useRealtimeEvent('custom_match_result', (payload: any) => {
    if (payload.lobbyId === lobbyId) {
        setMatchResultModal(payload.leaderboard || []);
    }
  });

  useRealtimeEvent('custom_lobby_submission', (payload: any) => {
    if (payload.lobbyId === lobbyId) {
      setLeaderboard((prev) => {
        const next = [...prev];
        const idx = next.findIndex(p => p.userId === payload.userId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], username: payload.username, status: payload.status, score: payload.score, passed: payload.passed, total: payload.total, compileError: payload.compileError };
        } else {
          next.push(payload);
        }
        return next.sort((a, b) => (b.score || 0) - (a.score || 0));
      });
    }
  });

  const handleTimeout = useCallback(() => {
    setIsTimingOut(true);
    setVerdict('Time expired · resolving match');
    if (socket) socket.emit('custom_lobby_timeout', { lobbyId });
  }, [lobbyId, socket]);

  const { remaining, pressureLevel } = useCountdownTimer(timerSeconds, handleTimeout);

  const submit = async (language: string, code: string) => {
    setIsSubmitting(true);
    setVerdict('Queued for evaluation');
    setError(null);
    setActiveTab('output');
    try {
      const submission = await submissionApi.submitCode({ userId, problemId, language, code, mode: 'custom', matchId: lobbyId });
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
        <div className="flex items-center gap-3"><Badge label="CUSTOM MATCH" tone="danger" /><span className="font-mono text-sm text-text-secondary">lobby/{lobbyId.slice(0, 8)}</span></div>
        <Timer value={remaining} pressure={pressureLevel} className="text-4xl" />
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowLeaderboardModal(true)}
            className="rounded border border-border-hairline bg-bg-surface px-4 py-2 text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:border-accent-primary hover:text-accent-primary"
          >
            Live Rankings
          </button>
          
          {hasAccepted ? (
            <button 
              onClick={handleExitMatch}
              className="rounded bg-accent-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-accent-primary transition-colors hover:bg-accent-primary hover:text-white"
            >
              Exit to Lobby
            </button>
          ) : (
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to forfeit this match?")) {
                  handleExitMatch();
                }
              }}
              className="rounded bg-accent-danger/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-accent-danger transition-colors hover:bg-accent-danger hover:text-white"
            >
              Forfeit Match
            </button>
          )}
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
            verdict={verdict}
            setVerdict={setVerdict}
            error={error}
            setError={setError}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            showOpponentTab={false}
          />
        }
      />
      
      {submissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlowPanel className="max-w-md w-full p-6 text-center">
            <h2 className="text-xl font-mono uppercase tracking-widest text-text-primary mb-4">Submission Result</h2>
            <div className={`text-2xl font-bold mb-2 ${submissionModal.status === 'Accepted' ? 'text-accent-primary' : 'text-accent-danger'}`}>
              {submissionModal.status}
            </div>
            <p className="text-sm text-text-secondary mb-8 uppercase tracking-widest">{submissionModal.passed}/{submissionModal.total} tests passed</p>
            
            {submissionModal.status === 'Accepted' ? (
              <div className="flex flex-col gap-4">
                <Button variant="primary" onClick={() => setSubmissionModal(null)}>Continue Match</Button>
                <Button variant="ghost" onClick={handleExitMatch}>Exit to Lobby</Button>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button variant="ghost" onClick={() => setSubmissionModal(null)}>Dismiss</Button>
              </div>
            )}
          </GlowPanel>
        </div>
      )}

      {showLeaderboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlowPanel className="max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-mono uppercase tracking-[0.2em] text-accent-primary">Live Rankings</h2>
              <button onClick={() => setShowLeaderboardModal(false)} className="text-text-secondary hover:text-text-primary text-xl">✕</button>
            </div>
            
            <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-4 pr-2">
              {leaderboard.map((user: any, idx: number) => {
                 const isWinner = idx === 0 && user.score > 0;
                 return (
                   <div key={user.userId} className={`flex justify-between items-center rounded-lg border p-4 ${isWinner ? 'border-accent-primary bg-accent-primary/5' : 'border-border-subtle bg-bg-surface'}`}>
                     <div className="flex items-center gap-4">
                       <span className={`font-mono text-xl ${isWinner ? 'text-accent-primary' : 'text-text-secondary'} w-6 text-center`}>{idx + 1}</span>
                       <div className="flex flex-col">
                         <span className="font-mono text-lg text-text-primary">{user.username || user.userId.slice(0, 8)}</span>
                         <span className={`text-[10px] uppercase font-bold tracking-widest ${
                           user.status === 'ACCEPTED' ? 'text-accent-primary' : 
                           user.status === 'LEFT' ? 'text-text-secondary' :
                           user.status === 'WRONG_ANSWER' ? 'text-accent-danger' : 
                           'text-text-secondary'
                         }`}>{user.status} {user.status !== 'LEFT' && user.status !== 'JOINED' && `(${user.passed}/${user.total})`}</span>
                       </div>
                     </div>
                     <div className="font-mono text-xl text-accent-primary font-bold">{user.score || 0} <span className="text-sm font-normal text-text-secondary uppercase tracking-widest">pts</span></div>
                   </div>
                 );
              })}
              {leaderboard.length === 0 && (
                <div className="text-center text-text-secondary font-mono py-8">No participants.</div>
              )}
            </div>
          </GlowPanel>
        </div>
      )}

      {matchResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlowPanel className="max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-mono uppercase tracking-[0.2em] text-accent-primary">Match Concluded</h2>
              <button onClick={() => setMatchResultModal(null)} className="text-text-secondary hover:text-text-primary">✕</button>
            </div>
            
            <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-8 pr-2">
              {matchResultModal.map((user: any, idx: number) => {
                 const isWinner = idx === 0 && user.score > 0;
                 return (
                   <div key={user.userId} className={`flex justify-between items-center rounded-lg border p-4 ${isWinner ? 'border-accent-primary bg-accent-primary/5' : 'border-border-subtle bg-bg-surface'}`}>
                     <div className="flex items-center gap-4">
                       <span className={`font-mono text-xl ${isWinner ? 'text-accent-primary' : 'text-text-secondary'} w-6 text-center`}>{idx + 1}</span>
                       <span className="font-mono text-lg text-text-primary">{user.username || user.userId.slice(0, 8)}</span>
                     </div>
                     <div className="font-mono text-xl text-accent-primary font-bold">{user.score} <span className="text-sm font-normal text-text-secondary uppercase tracking-widest">pts</span></div>
                   </div>
                 );
              })}
              {matchResultModal.length === 0 && (
                <div className="text-center text-text-secondary font-mono py-8">No participants submitted anything.</div>
              )}
            </div>
            
            <div className="flex justify-center">
              <Button className="px-8 py-3 text-sm" onClick={onLobby}>Return to Dashboard</Button>
            </div>
          </GlowPanel>
        </div>
      )}
    </main>
  );
}
