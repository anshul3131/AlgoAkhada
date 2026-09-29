import { Badge } from './Badge';

interface Props {
  username?: string;
  avatarUrl?: string | null;
  onDashboard: () => void;
  onProblems?: () => void;
  onHome: () => void;
  onLogout?: () => void;
}

export function TopNav({ username, avatarUrl, onDashboard, onHome, onProblems, onLogout }: Props) {
  const displayAvatar = avatarUrl || (username ? `https://api.dicebear.com/7.x/bottts/svg?seed=${username}` : null);
  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 pb-0 md:p-6 md:pb-0">
      <div className="flex items-center justify-between rounded-xl border border-border-hairline bg-bg-panel p-3 shadow-sm">
        
        {/* Left Side: Avatar + Username + Branding */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onHome}>
            <img src="/AlgoAkhada_logo.png" alt="AlgoAkhada Logo" className="h-6 w-auto" />
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-text-primary mt-0.5 hidden sm:block">
              AlgoAkhada
            </p>
          </div>
          
          <div className="w-px h-4 bg-border-hairline mx-1 hidden sm:block"></div>
          
          <button onClick={onDashboard} className="flex items-center gap-3 hover:opacity-80 transition-opacity" title="View Profile">
            <div className="w-8 h-8 rounded bg-bg-void border-2 border-border-hairline p-0.5 shadow-sm">
              {displayAvatar ? (
                <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover rounded-sm" />
              ) : (
                <div className="w-full h-full bg-accent-primary/20 rounded-sm flex items-center justify-center text-[10px] font-bold text-accent-primary">
                  {username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary hover:text-accent-primary transition-colors hidden md:inline">{username}</span>
          </button>
        </div>

        {/* Right Side: Home, Problems, Logout */}
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={onHome}
            className="flex items-center justify-center h-8 px-3 rounded bg-bg-panel-raised border border-border-hairline hover:bg-bg-void hover:border-accent-primary transition-colors text-text-secondary hover:text-accent-primary font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Home
          </button>
          
          <button 
            onClick={onProblems}
            className="flex items-center justify-center h-8 px-3 rounded bg-bg-panel-raised border border-border-hairline hover:bg-bg-void hover:border-accent-primary transition-colors text-text-secondary hover:text-accent-primary font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Problems
          </button>
          <button 
            onClick={onDashboard}
            className="flex items-center justify-center h-8 px-3 rounded bg-bg-panel-raised border border-border-hairline hover:bg-bg-void hover:border-accent-primary transition-colors text-text-secondary hover:text-accent-primary font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Profile
          </button>
          
          {onLogout && (
            <>
              <div className="w-px h-4 bg-border-hairline hidden sm:block"></div>
              <button 
                onClick={onLogout} 
                className="flex items-center justify-center h-8 px-3 rounded border border-transparent hover:bg-accent-danger/10 hover:border-accent-danger/30 transition-colors text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary hover:text-accent-danger"
              >
                Logout
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
