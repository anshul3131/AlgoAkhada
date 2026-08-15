import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { problemApi } from '../../lib/api';
import type { ProblemListItem } from '../../types';

export function TagExplorerScreen({ onBackToLobby, onSolveProblem, onFindMatch }: {
  onBackToLobby: () => void;
  onSolveProblem: (problemId: string) => void;
  onFindMatch: (tag: string) => void;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('binary search');
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTags = async () => {
      setLoadingTags(true);
      setError(null);

      try {
        const response = await problemApi.getTags();
        const nextTags = response.tags ?? [];
        setTags(nextTags);
        if (!selectedTag && nextTags.length > 0) {
          setSelectedTag(nextTags[0]);
        }
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setLoadingTags(false);
      }
    };

    void loadTags();
  }, [selectedTag]);

  useEffect(() => {
    const loadProblems = async () => {
      if (!selectedTag) return;

      setLoadingProblems(true);
      setError(null);

      try {
        const response = await problemApi.getProblemsByTag(selectedTag, 1, 20);
        setProblems(response.items ?? []);
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setLoadingProblems(false);
      }
    };

    void loadProblems();
  }, [selectedTag]);

  const difficultyTone = useMemo(() => ({
    Easy: 'text-accent-primary',
    Medium: 'text-accent-warn',
    Hard: 'text-accent-danger',
  }), []);

  return (
    <main className="mx-auto max-w-[1500px] p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-text-secondary">Train by topic</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-text-primary">{selectedTag}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onFindMatch(selectedTag)}>Find Match</Button>
          <Button variant="ghost" onClick={onBackToLobby}>Back to Lobby</Button>
        </div>
      </div>

      <GlowPanel className="mb-6">
        <div className="flex flex-wrap gap-2">
          {loadingTags ? (
            <span className="text-sm text-text-secondary">Loading topics...</span>
          ) : (
            tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.2em] transition-all ${
                  selectedTag === tag
                    ? 'border-accent-primary bg-accent-primary/15 text-accent-primary shadow-[0_0_0_1px_rgba(76,255,190,0.2)]'
                    : 'border-border-hairline bg-bg-panel-raised text-text-secondary hover:border-accent-primary hover:text-accent-primary'
                }`}
              >
                {tag}
              </button>
            ))
          )}
        </div>
      </GlowPanel>

      {error && (
        <GlowPanel className="mb-6 border border-accent-danger/60 bg-accent-danger/10 p-4 text-sm text-accent-danger">{error}</GlowPanel>
      )}

      <div className="space-y-3">
        {loadingProblems ? (
          <GlowPanel className="p-6 text-text-secondary">Loading problems...</GlowPanel>
        ) : problems.length === 0 ? (
          <GlowPanel className="p-6 text-text-secondary">No problems are available for this tag yet.</GlowPanel>
        ) : (
          problems.map((problem) => (
            <GlowPanel key={problem.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-text-primary">{problem.title}</h2>
                  <Badge label={problem.difficulty} tone={problem.difficulty === 'Easy' ? 'primary' : problem.difficulty === 'Hard' ? 'danger' : 'electric'} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {problem.tags?.map((tag) => (
                    <span key={`${problem.id}-${tag}`} className="rounded-full border border-border-hairline bg-bg-panel-raised px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-2 hidden rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary md:block">
                  {problem.timeLimit ?? 2}s / {(problem.memoryLimit ?? 256)}MB
                </div>
                <Button variant="primary" onClick={() => onSolveProblem(problem.id)}>Solve</Button>
              </div>
            </GlowPanel>
          ))
        )}
      </div>
    </main>
  );
}
