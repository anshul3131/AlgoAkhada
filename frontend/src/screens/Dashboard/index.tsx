import { useEffect, useState } from 'react';
import { dashboardApi, type DashboardStats } from '../../lib/api';
import { Button } from '../../components/shared/Button';
import { MatchesPieChart } from './components/MatchesPieChart';
import { TopicsPieChart } from './components/TopicsPieChart';
import { EloLineChart } from './components/EloLineChart';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { Badge } from '../../components/shared/Badge';

interface Props {
  onBack: () => void;
  username: string;
  onUpsolve: (problemId: string) => void;
}

function getRankInfo(elo: number) {
  if (elo >= 2400) return { title: 'Grandmaster', color: 'text-red-500', shadow: 'shadow-red-500/20' };
  if (elo >= 2100) return { title: 'Master', color: 'text-orange-500', shadow: 'shadow-orange-500/20' };
  if (elo >= 1900) return { title: 'Candidate Master', color: 'text-purple-500', shadow: 'shadow-purple-500/20' };
  if (elo >= 1600) return { title: 'Expert', color: 'text-blue-500', shadow: 'shadow-blue-500/20' };
  if (elo >= 1400) return { title: 'Specialist', color: 'text-cyan-500', shadow: 'shadow-cyan-500/20' };
  if (elo >= 1200) return { title: 'Pupil', color: 'text-green-500', shadow: 'shadow-green-500/20' };
  return { title: 'Newbie', color: 'text-gray-400', shadow: 'shadow-gray-400/20' };
}

export function DashboardScreen({ onBack, username, onUpsolve }: Props) {
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">Back</Button>
        <GlowPanel className="text-center text-accent-danger p-8">{error}</GlowPanel>
      </div>
    );
  }

  const profile = stats.userProfile;
  const displayAvatar = profile?.avatar_url || (username ? `https://api.dicebear.com/7.x/bottts/svg?seed=${username}` : null);
  const currentElo = profile?.elo_rating || 1200;
  const maxElo = profile?.max_elo_rating || currentElo;
  
  const rankInfo = getRankInfo(currentElo);
  const maxRankInfo = getRankInfo(maxElo);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700 h-screen overflow-y-auto">
      
      {/* Top Navbar */}
      <div className="mb-8 flex items-center justify-between border-b border-border-hairline pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex gap-2 items-baseline">
            Profile <span className="text-sm font-normal text-text-secondary">/ {username}</span>
          </h1>
        </div>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 xl:grid-cols-4">
        
        {/* Left Sidebar (Identity & Stats) */}
        <div className="md:col-span-1 xl:col-span-1 space-y-6">
          <GlowPanel className="flex flex-col items-center p-6 text-center">
            <div className={`w-32 h-32 rounded bg-bg-void border-2 border-border-hairline mb-4 shadow-lg p-2 ${rankInfo.shadow}`}>
              {displayAvatar ? (
                <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-accent-primary/20 flex items-center justify-center text-4xl font-bold text-accent-primary">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="mb-1 text-sm font-bold uppercase tracking-wider text-text-secondary">
              {rankInfo.title}
            </div>
            <h2 className={`text-2xl font-bold mb-4 ${rankInfo.color}`}>
              {username}
            </h2>

            <div className="w-full text-left space-y-2 border-t border-border-hairline pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Contest rating:</span>
                <span className={`font-bold ${rankInfo.color}`}>{currentElo}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Max rating:</span>
                <span>
                  <span className={`${maxRankInfo.color}`}>{maxRankInfo.title}</span> <span className="text-text-primary font-bold">{maxElo}</span>
                </span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-border-hairline border-dashed">
                <span className="text-text-secondary">Matches played:</span>
                <span className="text-text-primary font-bold">{stats.matchStats.wins + stats.matchStats.losses}</span>
              </div>
            </div>
          </GlowPanel>

          <MatchesPieChart stats={stats.matchStats} />
          <TopicsPieChart stats={stats.topicsStats} />
        </div>

        {/* Right Main Content */}
        <div className="md:col-span-2 xl:col-span-3 space-y-6">
          
          {/* Rating Graph */}
          <GlowPanel className="p-4 relative">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <Badge label="RATING HISTORY" tone="primary" />
            </div>
            <div className="pt-8">
               <EloLineChart history={stats.eloHistory} />
            </div>
          </GlowPanel>

          {/* Match History Table */}
          <GlowPanel className="p-4">
             <div className="mb-4">
               <Badge label="RECENT BATTLES" tone="electric" />
             </div>
             
             {stats.recentMatches && stats.recentMatches.length > 0 ? (
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="text-[10px] uppercase tracking-wider text-text-secondary border-b border-border-hairline">
                     <tr>
                       <th className="py-3 px-2 font-medium">Date</th>
                       <th className="py-3 px-2 font-medium">Opponent</th>
                       <th className="py-3 px-2 font-medium">Problem</th>
                       <th className="py-3 px-2 font-medium">Result</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border-hairline/50">
                     {stats.recentMatches.map(m => {
                       const oppRank = getRankInfo(m.opponent.elo_rating);
                       return (
                         <tr key={m.matchId} className="hover:bg-bg-void/50 transition-colors">
                           <td className="py-3 px-2 text-text-secondary whitespace-nowrap">
                             {new Date(m.date).toLocaleDateString()}
                           </td>
                           <td className="py-3 px-2 font-medium">
                             <span className={oppRank.color}>{m.opponent.username}</span>
                             <span className="text-xs text-text-secondary ml-1">({m.opponent.elo_rating})</span>
                           </td>
                           <td className="py-3 px-2 truncate max-w-[200px]" title={m.problem.title}>
                             <button 
                               onClick={() => onUpsolve(m.problem.id)} 
                               className="text-accent-primary hover:text-white hover:underline transition-colors text-left truncate w-full"
                             >
                               {m.problem.title}
                             </button>
                           </td>
                           <td className="py-3 px-2 font-bold">
                             {m.isWin ? (
                               <span className="text-green-500">WIN</span>
                             ) : (
                               <span className="text-red-500">LOSS</span>
                             )}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             ) : (
               <div className="text-center py-8 text-text-secondary italic text-sm">
                 No matches played yet. Jump into the arena!
               </div>
             )}
          </GlowPanel>
          
        </div>
      </div>
    </div>
  );
}
