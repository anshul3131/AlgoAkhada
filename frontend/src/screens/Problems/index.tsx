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
  Easy: 'bg-accent-primary',
  Medium: 'bg-sky-400',
  Hard: 'bg-red-500',
};

export function ProblemsScreen({ onSolveProblem }: ProblemsScreenProps) {
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    problemApi.getProblems({ limit: 1000 })
      .then(res => setProblems(res.items || []))
      .finally(() => setLoading(false));
  }, []);
  const [query, setQuery] = useState('');
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState('');

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  // Topic list with counts, most common first.
  const allTopics = useMemo(() => {
    const counts = new Map<string, number>();
    problems.forEach((p) => p.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [problems]);

  const difficultyCounts = useMemo(() => {
    const counts: Record<Difficulty, number> = { Easy: 0, Medium: 0, Hard: 0 };
    problems.forEach((p) => {
      counts[p.difficulty] += 1;
    });
    return counts;
  }, [problems]);

  const visibleTopics = allTopics.filter(([t]) =>
    t.toLowerCase().includes(topicSearch.trim().toLowerCase()),
  );

  // Difficulty: match any selected. Topics: problem must have every selected topic (Codeforces behaviour).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (difficulties.length && !difficulties.includes(p.difficulty)) return false;
      if (topics.length && !topics.every((t) => p.tags?.includes(t))) return false;
      return true;
    });
  }, [problems, query, difficulties, topics]);

  const hasFilters = query !== '' || difficulties.length > 0 || topics.length > 0;

  const clearAll = () => {
    setQuery('');
    setDifficulties([]);
    setTopics([]);
    setTopicSearch('');
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
          <span className="font-semibold text-text-primary">{filtered.length}</span> of{' '}
          {problems.length} problems
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Filters (left sidebar, sticky on desktop) ── */}
        <aside
          aria-label="Filters"
          className="w-full shrink-0 space-y-6 rounded-xl border border-white/10 bg-zinc-900/60 p-4 backdrop-blur lg:sticky lg:top-6 lg:w-72"
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
                        : 'border-border-hairline bg-bg-panel-raised text-text-secondary hover:border-white/20 hover:text-text-primary'
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
            <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/40 px-6 py-16 text-center text-text-secondary">Loading problems...</div>
          ) : filtered.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filtered.map((problem) => (
                <button
                  key={problem.id}
                  onClick={() => onSolveProblem(problem.id)}
                  className="flex w-full flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur text-left transition-all hover:border-accent-primary/50 hover:bg-accent-primary/5 group"
                >
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-text-primary group-hover:text-accent-primary transition-colors">{problem.title}</h2>
                      <Badge label={problem.difficulty} tone={problem.difficulty === 'Easy' ? 'primary' : problem.difficulty === 'Hard' ? 'danger' : 'electric'} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {problem.tags?.map((tag) => (
                        <span key={tag} className="rounded-full border border-border-hairline bg-bg-panel-raised px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary group-hover:border-accent-primary/30 transition-colors">
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
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/40 px-6 py-16 text-center">
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
