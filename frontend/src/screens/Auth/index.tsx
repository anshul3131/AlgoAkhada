import { useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import type { AuthUser } from '../../lib/api';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser, token: string) => void;
  login: (email: string, password: string) => Promise<unknown>;
  signup: (email: string, password: string, username: string) => Promise<unknown>;
  isLoading: boolean;
  error: string | null;
}

export function AuthScreen({ onAuthenticated, login, signup, isLoading, error }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = mode === 'login'
      ? await login(email, password)
      : await signup(email, password, username);
    const authenticated = result as { user: AuthUser; token: string };
    onAuthenticated(authenticated.user, authenticated.token);
  };

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-bg-void px-4 py-8 text-text-primary">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(42,42,56,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(42,42,56,0.25)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative m-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="hidden space-y-6 lg:block">
          <Badge label="Competitive matchmaking network" tone="primary" />
          <h1 className="max-w-xl font-mono text-6xl font-bold leading-[0.95] tracking-[-0.04em] text-text-primary">
            Think fast.<br /><span className="text-accent-primary">Climb faster.</span>
          </h1>
          <p className="max-w-md text-sm leading-7 text-text-secondary">A live coding arena where every accepted submission changes the board.</p>
          <div className="flex gap-8 font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            <span><strong className="text-text-primary">01</strong> queue</span>
            <span><strong className="text-text-primary">02</strong> solve</span>
            <span><strong className="text-text-primary">03</strong> rank</span>
          </div>
        </section>

        <GlowPanel className="relative overflow-hidden p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-accent-electric/10 blur-3xl" />
          <div className="relative mb-8 flex items-start justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-text-secondary">CP MatchMaker</p>
              <h2 className="mt-3 text-2xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            </div>
            <Badge label="Secure" tone="electric" />
          </div>

          <div className="mb-6 grid grid-cols-2 border-b border-border-hairline">
            {(['login', 'signup'] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setMode(tab)} className={`border-b-2 pb-3 text-xs font-semibold uppercase tracking-[0.2em] transition ${mode === tab ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary'}`}>
                {tab}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && <label className="block text-xs uppercase tracking-[0.16em] text-text-secondary">Username<input required value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-lg border border-border-hairline bg-black px-3 py-3 font-mono text-sm text-text-primary outline-none focus:border-accent-primary" placeholder="ghost-01" /></label>}
            <label className="block text-xs uppercase tracking-[0.16em] text-text-secondary">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-border-hairline bg-black px-3 py-3 font-mono text-sm text-text-primary outline-none focus:border-accent-primary" placeholder="you@arena.dev" /></label>
            <label className="block text-xs uppercase tracking-[0.16em] text-text-secondary">Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-border-hairline bg-black px-3 py-3 font-mono text-sm text-text-primary outline-none focus:border-accent-primary" placeholder="••••••••" /></label>
            {error && <p className="rounded-lg border border-accent-danger/40 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger">{error}</p>}
            <Button type="submit" disabled={isLoading} className="mt-2 w-full">{isLoading ? 'Authenticating...' : mode === 'login' ? 'Enter Arena' : 'Create Account'}</Button>
          </form>
        </GlowPanel>
      </div>
    </main>
  );
}
