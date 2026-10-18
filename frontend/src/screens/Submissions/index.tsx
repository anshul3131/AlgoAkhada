import { useEffect, useMemo, useState } from 'react';
import { submissionApi } from '../../lib/api';
import type { SubmissionListItem } from '../../types';
import { Badge } from '../../components/shared/Badge';

export type StatusFilter = 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compilation Error';

interface SubmissionsScreenProps {
  onReviewSolution: (submissionId: string) => void;
}

const STATUSES: StatusFilter[] = ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error'];

const STATUS_DOT: Record<StatusFilter, string> = {
  'Accepted': 'bg-accent-primary',
  'Wrong Answer': 'bg-red-500',
  'Time Limit Exceeded': 'bg-accent-warn',
  'Runtime Error': 'bg-accent-warn',
  'Compilation Error': 'bg-yellow-500'
};

export function SubmissionsScreen({ onReviewSolution }: SubmissionsScreenProps) {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMatched, setTotalMatched] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    STATUSES.forEach((s) => {
      initial[s] = 0;
    });
    return initial;
  });
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statuses, setStatuses] = useState<StatusFilter[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [hideTags, setHideTags] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch user submission metadata (status counts and topic counts) once on mount
  useEffect(() => {
    submissionApi
      .getMetadata()
      .then((res) => {
        const nextCounts: Record<string, number> = {};
        STATUSES.forEach((s) => {
          nextCounts[s] = res.statusCounts?.[s] ?? 0;
        });
        setStatusCounts(nextCounts);
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
  }, [statuses, topics]);

  // Fetch current page of submissions from server using indexed filters
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    submissionApi
      .getSubmissions({
        page: currentPage,
        limit: pageSize,
        status: statuses.length > 0 ? statuses.join(',') : undefined,
        topic: topics.length > 0 ? topics.join(',') : undefined,
        search: debouncedQuery || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setSubmissions(res.items || []);
        setTotalMatched(res.total ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, pageSize, statuses, topics, debouncedQuery]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const allTopics = useMemo(() => {
    return Object.entries(topicCounts).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [topicCounts]);

  const hasFilters = query !== '' || statuses.length > 0 || topics.length > 0 || hideTags;

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const paginated = submissions;

  const clearAll = () => {
    setQuery('');
    setDebouncedQuery('');
    setStatuses([]);
    setTopics([]);
    setHideTags(false);
    setCurrentPage(1);
  };

  const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60";

  const visibleTopics = useMemo(() => {
    const term = topicSearch.trim().toLowerCase();
    return term ? allTopics.filter((t) => t[0].toLowerCase().includes(term)) : allTopics;
  }, [allTopics, topicSearch]);

  return (
    <div className="flex min-h-full flex-col bg-bg-void text-text-primary">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Submissions</h1>
            <p className="mt-1 text-sm text-text-secondary">
              View your past submissions, review code, and track your attempts.
            </p>
          </div>
          <div className="text-sm font-mono text-text-secondary">
            {totalMatched} {totalMatched === 1 ? 'submission' : 'submissions'} found
          </div>
        </header>

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          <aside
            className="w-full shrink-0 flex flex-col gap-6 md:w-64"
            aria-label="Filters"
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
              <legend className="mb-2 text-xs text-text-secondary">Result</legend>
              <div className="grid grid-cols-1 gap-2">
                {STATUSES.map((d) => {
                  const active = statuses.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatuses((prev) => toggle(prev, d))}
                      className={`flex items-center justify-between gap-1 rounded-lg border px-3 py-2 text-sm transition-colors ${focusRing} ${
                        active
                          ? 'border-accent-primary/60 bg-accent-primary/10 text-text-primary'
                          : 'border-border-hairline bg-bg-panel-raised text-text-secondary hover:border-border-strong hover:text-text-primary'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[d]}`} />
                        {d}
                      </span>
                      <span className="font-mono text-[10px] text-text-secondary">
                        {statusCounts[d]}
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
            </fieldset>
          </aside>

          {/* ── Submission list ── */}
          <main className="min-w-0 flex-1">
            {loading ? (
              <div className="rounded-xl border border-dashed border-border-hairline bg-bg-panel/40 px-6 py-16 text-center text-text-secondary">Loading submissions...</div>
            ) : paginated.length > 0 ? (
              <>
              <div className="flex flex-col gap-3">
                {paginated.map((submission) => {
                  const problem = submission.problem;
                  const isAccepted = submission.status === 'Accepted';
                  const statusColor = isAccepted ? 'text-accent-primary border-accent-primary/50 bg-accent-primary/10' : 'text-red-400 border-red-400/50 bg-red-400/10';
                  
                  return (
                  <button
                    key={submission.id}
                    onClick={() => onReviewSolution(submission.id)}
                    className="flex w-full flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between rounded-xl border border-border-subtle bg-bg-panel shadow-sm text-left transition-all hover:border-accent-primary/50 hover:bg-bg-hover group"
                  >
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-text-primary group-hover:text-accent-primary transition-colors flex items-center gap-2">
                          {problem?.title ?? 'Unknown Problem'}
                        </h2>
                        {problem && <Badge label={problem.difficulty} tone={problem.difficulty === 'Easy' ? 'easy' : problem.difficulty === 'Hard' ? 'danger' : 'warn'} />}
                      </div>
                      {!hideTags && (
                      <div className="flex flex-wrap gap-2">
                        {problem?.tags?.map((tag) => (
                          <span key={tag} className="rounded-full border border-border-hairline bg-bg-panel-raised px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary group-hover:border-accent-primary/30 transition-colors">
                            {tag}
                          </span>
                        ))}
                      </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                          {submission.status}
                        </span>
                        <span className="text-[10px] text-text-secondary uppercase tracking-widest font-mono">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </button>
                );
                })}
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
                <p className="text-lg font-semibold text-text-primary">No submissions match these filters</p>
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
    </div>
  );
}
