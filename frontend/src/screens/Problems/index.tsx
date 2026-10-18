import { useEffect, useMemo, useState } from 'react';
import { problemApi } from '../../lib/api';
import type { ProblemListItem } from '../../types';
// Adjust this path to wherever your shared Badge lives.
import { Badge } from '../../components/shared/Badge';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';



interface ProblemsScreenProps {
  onSolveProblem: (problemId: string) => void;
}

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

const DIFFICULTY_DOT: Record<Difficulty, string> = {
  Easy: 'bg-easy',
  Medium: 'bg-medium',
  Hard: 'bg-hard',
};

export function ProblemsScreen({ onSolveProblem }: ProblemsScreenProps) {
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMatched, setTotalMatched] = useState(0);
  const [totalCatalog, setTotalCatalog] = useState(0);
  const [difficultyCounts, setDifficultyCounts] = useState<Record<Difficulty, number>>({
    Easy: 0,
    Medium: 0,
    Hard: 0,
  });
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [hideTags, setHideTags] = useState(false);
  const [hideSolved, setHideSolved] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Fetch static problem metadata (total, difficulty counts, topic counts) once on mount
  useEffect(() => {
    problemApi
      .getMetadata()
      .then((res) => {
        setTotalCatalog(res.total ?? 0);
        setDifficultyCounts({
          Easy: res.difficultyCounts?.Easy ?? 0,
          Medium: res.difficultyCounts?.Medium ?? 0,
          Hard: res.difficultyCounts?.Hard ?? 0,
        });
        setTopicCounts(res.topicCounts ?? {});
      })
      .catch(() => undefined);
  }, []);

  // Debounce title search input and reset page to 1
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Reset page to 1 whenever non-search filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [difficulties, topics, hideSolved]);

  // Fetch current page of problems from server using indexed filters
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    problemApi
      .getProblems({
        page: currentPage,
        limit: pageSize,
        difficulty: difficulties.length > 0 ? difficulties.join(',') : undefined,
        search: debouncedQuery || undefined,
        tag: topics.length > 0 ? topics.join(',') : undefined,
        hideSolved: hideSolved || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setProblems(res.items || []);
        setTotalMatched(res.total ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, pageSize, difficulties, debouncedQuery, topics, hideSolved]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  // Topic list with counts, most common first (from metadata endpoint).
  const allTopics = useMemo(() => {
    return Object.entries(topicCounts).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [topicCounts]);

  const visibleTopics = allTopics.filter(([t]) =>
    t.toLowerCase().includes(topicSearch.trim().toLowerCase()),
  );

  const hasFilters =
    query !== '' ||
    difficulties.length > 0 ||
    topics.length > 0 ||
    hideTags ||
    hideSolved;

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const paginated = problems;

  const clearAll = () => {
    setQuery('');
    setDebouncedQuery('');
    setDifficulties([]);
    setTopics([]);
    setTopicSearch('');
    setCurrentPage(1);
  };

  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Problems</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Pick a problem, then submit a solution.
          </p>
        </div>
        <p className="text-sm text-text-secondary" aria-live="polite">
          <span className="font-semibold text-text-primary">{totalMatched}</span> of{' '}
          {totalCatalog || totalMatched} problems
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Filters (left sidebar, sticky on desktop) ── */}
        <aside
          aria-label="Filters"
          className="w-full shrink-0 space-y-6 rounded-xl border border-border-subtle bg-bg-panel p-4 shadow-panel backdrop-blur lg:sticky lg:top-6 lg:w-72"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Filters</h2>
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasFilters}
              className={`rounded text-xs text-accent-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
            >
              Clear all
            </button>
          </div>

          <div>
            <label htmlFor="problem-search" className="mb-2 block text-xs text-text-secondary">
              Search by title
            </label>
            <input
              id="problem-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Two Sum"
              className={`w-full rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 ${focusRing}`}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-xs text-text-secondary">Difficulty</legend>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => {
                const active = difficulties.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDifficulties((prev) => toggle(prev, d))}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-sm transition-colors ${focusRing} ${
                      active
                        ? 'border-accent-primary/60 bg-accent-primary/10 text-text-primary'
                        : 'border-border-hairline bg-bg-panel-raised text-text-secondary hover:border-border-strong hover:text-text-primary'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${DIFFICULTY_DOT[d]}`} />
                      {d}
                    </span>
                    <span className="font-mono text-[10px] text-text-secondary">
                      {difficultyCounts[d]}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-3 flex items-center justify-between rounded-lg border border-border-hairline bg-bg-panel-raised p-3">
              <div>
                <div className="text-sm font-medium text-text-primary">Hide Tags</div>
                <div className="text-xs text-text-secondary">Hide topics on problems</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={hideTags} onChange={e => setHideTags(e.target.checked)} />
                <div className="peer h-6 w-11 rounded-full bg-border-hairline after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>
            
            <div className="mb-6 flex items-center justify-between rounded-lg border border-border-hairline bg-bg-panel-raised p-3">
              <div>
                <div className="text-sm font-medium text-text-primary">Hide Solved</div>
                <div className="text-xs text-text-secondary">Hide problems you've completed</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={hideSolved} onChange={e => setHideSolved(e.target.checked)} />
                <div className="peer h-6 w-11 rounded-full bg-border-hairline after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-2 flex items-center justify-between">
              <legend className="text-xs text-text-secondary">
                Topics{topics.length > 0 && ` (${topics.length} selected)`}
              </legend>
              {topics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTopics([])}
                  className={`rounded text-xs text-text-secondary hover:text-text-primary ${focusRing}`}
                >
                  Reset
                </button>
              )}
            </div>
            <input
              type="search"
              aria-label="Search topics"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              placeholder="Find a topic"
              className={`mb-3 w-full rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 ${focusRing}`}
            />
            <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1">
              {visibleTopics.map(([topic, count]) => {
                const active = topics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTopics((prev) => toggle(prev, topic))}
                    className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${focusRing} ${
                      active
                        ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                        : 'border-border-hairline bg-bg-panel-raised text-text-secondary hover:border-accent-primary/40 hover:text-text-primary'
                    }`}
                  >
                    {topic}
                    <span className="ml-1.5 opacity-60">{count}</span>
                  </button>
                );
              })}
              {visibleTopics.length === 0 && (
                <p className="text-xs text-text-secondary">No topics match “{topicSearch}”.</p>
              )}
            </div>
            {topics.length > 1 && (
              <p className="mt-3 text-xs text-text-secondary">
                Showing problems that have all selected topics.
              </p>
            )}
          </fieldset>
        </aside>

        {/* ── Problem list ── */}
        <main className="min-w-0 flex-1">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border-hairline bg-bg-panel/40 px-6 py-16 text-center text-text-secondary">Loading problems...</div>
          ) : paginated.length > 0 ? (
            <>
            <div className="flex flex-col gap-3">
              {paginated.map((problem) => (
                <button
                  key={problem.id}
                  onClick={() => onSolveProblem(problem.id)}
                  className="flex w-full flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between rounded-xl border border-border-subtle bg-bg-panel shadow-sm text-left transition-all hover:border-accent-primary/50 hover:bg-bg-hover group"
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
                      <Badge label={problem.difficulty} tone={problem.difficulty === 'Easy' ? 'easy' : problem.difficulty === 'Hard' ? 'danger' : 'warn'} />
                    </div>
                    {!hideTags && (
                    <div className="flex flex-wrap gap-2">
                      {problem.tags?.map((tag) => (
                        <span key={tag} className="rounded-full border border-border-hairline bg-bg-panel-raised px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary group-hover:border-accent-primary/30 transition-colors">
                          {tag}
                        </span>
                      ))}
                    </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-2 hidden rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary md:block group-hover:border-accent-primary/30 group-hover:text-text-primary transition-colors">
                      {problem.timeLimit ?? 2}s / {(problem.memoryLimit ?? 256)}MB
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {true && (
                <div className="mt-6 flex items-center justify-between rounded-xl border border-border-subtle bg-bg-panel-raised px-4 py-3">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded border border-border-hairline px-3 py-1 text-xs text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-hover transition"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono text-text-secondary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded border border-border-hairline px-3 py-1 text-xs text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-hover transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border-subtle bg-bg-panel/40 px-6 py-16 text-center">
              <p className="text-lg font-semibold text-text-primary">No problems match these filters</p>
              <p className="mt-1 text-sm text-text-secondary">
                Remove a topic or difficulty to see more.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className={`mt-4 rounded-lg border border-accent-primary/50 px-4 py-2 text-sm text-accent-primary transition-colors hover:bg-accent-primary/10 ${focusRing}`}
              >
                Clear all filters
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
