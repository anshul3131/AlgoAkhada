import { useEffect, useState } from 'react';
import { dashboardApi, type DashboardStats } from '../../lib/api';
import { Button } from '../../components/shared/Button';
import { SubmissionsPieChart } from './components/SubmissionsPieChart';
import { MatchesPieChart } from './components/MatchesPieChart';
import { TopicsPieChart } from './components/TopicsPieChart';
import { EloLineChart } from './components/EloLineChart';
import { GlowPanel } from '../../components/shared/GlowPanel';

interface Props {
  onBack: () => void;
  username: string;
}

export function DashboardScreen({ onBack, username }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    dashboardApi.getStats()
      .then(res => {
        if (!mounted) return;
        setStats(res);
        setIsLoading(false);
      })
      .catch(err => {
        if (!mounted) return;
        console.error(err);
        setError('Failed to load dashboard statistics.');
        setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-blue-500">
              {username}'s
            </span> Dashboard
          </h1>
          <p className="mt-2 text-sm text-text-secondary">Track your competitive programming journey and statistics.</p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          Return to Lobby
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      ) : error || !stats ? (
        <GlowPanel className="text-center text-accent-danger p-8">
          {error}
        </GlowPanel>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
          <SubmissionsPieChart stats={stats.submissionStats} />
          <MatchesPieChart stats={stats.matchStats} />
          <div className="md:col-span-2 xl:col-span-1">
            <TopicsPieChart stats={stats.topicsStats} />
          </div>
          <div className="md:col-span-2 xl:col-span-1">
            <EloLineChart history={stats.eloHistory} />
          </div>
        </div>
      )}
    </div>
  );
}
