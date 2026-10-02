import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { problemApi } from '../../lib/api';
import type { ProblemListItem } from '../../types';

const ChevronStack = ({ up }: { up?: boolean }) => (
  <div className="flex flex-col items-center justify-center -space-y-[3px]">
    {[0, 1, 2].map(i => (
      <svg key={i} width="14" height="6" viewBox="0 0 24 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={up ? "M2 8l10-6 10 6" : "M2 2l10 6 10-6"} />
      </svg>
    ))}
  </div>
);

export function TagExplorerScreen({ onBackToLobby, onSolveProblem, onFindMatch, initialTag }: {
  onBackToLobby: () => void;
  onSolveProblem: (problemId: string) => void;
  onFindMatch: (tag: string) => void;
  initialTag?: string;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>(initialTag || 'binary search');
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

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

  // Reset page when tag changes
  useEffect(() => {
    setPage(1);
  }, [selectedTag]);

  useEffect(() => {
    const loadProblems = async () => {
      if (!selectedTag) return;

      setLoadingProblems(true);
      setError(null);

      try {
        const response = await problemApi.getProblemsByTag(selectedTag, page, limit);
        setProblems(response.items ?? []);
        setTotalPages(Math.ceil((response.total || 0) / limit) || 1);
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setLoadingProblems(false);
      }
    };

    void loadProblems();
  }, [selectedTag, page]);

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
          <Button variant="ghost" onClick={onBackToLobby}>Back</Button>
        </div>
      </div>

      <GlowPanel className="mb-6 relative p-4 pr-16">
        <div className={`${topicsExpanded ? 'max-h-[200px] overflow-y-auto' : 'max-h-[34px] overflow-hidden'} transition-all duration-300 ease-in-out`}>
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
        </div>
        <button 
          onClick={() => setTopicsExpanded(!topicsExpanded)}
          className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary hover:text-text-primary transition-colors rounded-full px-3 py-2 border border-border-hairline bg-bg-void shadow-lg z-10 flex items-center gap-2"
        >
          <ChevronStack up={topicsExpanded} />
          {topicsExpanded ? 'Collapse' : 'Expand'}
        </button>
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
            <button 
              key={problem.id} 
              onClick={() => onSolveProblem(problem.id)}
              className="flex w-full flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur text-left transition-all hover:border-accent-primary/50 hover:bg-accent-primary/5 group"
            >
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-text-primary group-hover:text-accent-primary transition-colors flex items-center gap-2">
                    {problem.title}
                    {problem.isSolved && (
                      <svg className="w-5 h-5 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </h2>
                  <Badge label={problem.difficulty} tone={problem.difficulty === 'Easy' ? 'primary' : problem.difficulty === 'Hard' ? 'danger' : 'electric'} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {problem.tags?.map((tag) => (
                    <span key={`${problem.id}-${tag}`} className="rounded-full border border-border-hairline bg-bg-panel-raised px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary group-hover:border-accent-primary/30 transition-colors">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-2 hidden rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary md:block group-hover:border-accent-primary/30 group-hover:text-text-primary transition-colors">
                  {problem.timeLimit ?? 2}s / {(problem.memoryLimit ?? 256)}MB
                </div>
              </div>
            </button>
          ))
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="font-mono text-xs text-text-secondary">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
