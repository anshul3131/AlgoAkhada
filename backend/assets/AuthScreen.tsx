import { useState } from 'react';
import type { AuthUser } from '../../lib/api';

interface AuthScreenProps {
  onAuthenticated?: (user: AuthUser) => void;
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
    const authenticated = result as { user: AuthUser };
    onAuthenticated?.(authenticated.user);
  };

  const isSignup = mode === 'signup';

  const inputClass =
    'w-full rounded-lg border border-border-hairline bg-bg-void/70 px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/50 transition-colors focus:border-accent-primary/70 focus:outline-none focus:ring-2 focus:ring-accent-primary/30';

  return (
    <main className="relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-bg-void text-text-primary lg:flex-row">
      {/* ── Background: grid, colour washes, vignette ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%)',
          }}
        />
        <div className="absolute -left-40 top-1/4 h-[36rem] w-[36rem] rounded-full bg-accent-primary/20 blur-[140px] motion-safe:animate-pulse" />
        <div className="absolute -right-32 bottom-0 h-[30rem] w-[30rem] rounded-full bg-accent-electric/20 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#000_100%)]" />
      </div>

      {/* ── Brand side ── */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-12 text-center lg:px-12 lg:py-16">
        <div className="relative w-full max-w-[34rem]">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 scale-110 rounded-full bg-gradient-to-tr from-accent-primary/30 via-transparent to-accent-electric/30 blur-3xl"
          />
          <img
            src="/AlgoAkhada_logo.png"
            alt="AlgoAkhada"
            className="mx-auto w-[min(78vw,34rem)] drop-shadow-[0_0_48px_rgba(0,255,170,0.35)]"
            draggable={false}
          />
        </div>
        <p className="mt-6 max-w-md text-lg text-text-secondary lg:mt-10 lg:text-xl">
          Solve problems, enter live matches, and climb the ranks against coders worldwide.
        </p>
        <ul className="mt-8 hidden gap-3 text-sm text-text-secondary lg:flex">
          {['Ranked 1v1 duels', 'Live leaderboards', 'Hundreds of problems'].map((item) => (
            <li
              key={item}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Form side ── */}
      <section className="relative flex flex-1 items-center justify-center px-4 pb-12 pt-6 lg:px-12 lg:py-16">
        <div className="relative w-full max-w-md">
          {/* gradient edge */}
          <div
            aria-hidden
            className="absolute -inset-px rounded-2xl bg-gradient-to-br from-accent-primary/60 via-white/5 to-accent-electric/60 opacity-70"
          />
          <div className="relative rounded-2xl bg-bg-panel/80 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
            {/* Mode switch */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mb-8 grid grid-cols-2 gap-1 rounded-xl border border-border-hairline bg-bg-void/60 p-1"
            >
              {(['login', 'signup'] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${
                      active
                        ? 'bg-accent-primary/15 text-accent-primary shadow-[inset_0_0_0_1px_rgba(0,255,170,0.35)]'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {m === 'login' ? 'Log in' : 'Sign up'}
                  </button>
                );
              })}
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mb-6 mt-1 text-sm text-text-secondary">
              {isSignup
                ? 'Pick a username and get into your first match.'
                : 'Log in to pick up where you left off.'}
            </p>

            <form onSubmit={submit} className="space-y-4">
              {isSignup && (
                <div>
                  <label htmlFor="auth-username" className="mb-1.5 block text-sm text-text-secondary">
                    Username
                  </label>
                  <input
                    id="auth-username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_handle"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-sm text-text-secondary">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-sm text-text-secondary">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="group relative mt-2 w-full overflow-hidden rounded-lg bg-gradient-to-r from-accent-primary to-accent-electric px-4 py-3.5 text-base font-bold text-bg-void shadow-[0_0_32px_-4px] shadow-accent-primary/50 transition-all hover:brightness-110 hover:shadow-accent-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
                />
                <span className="relative">
                  {isLoading ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
                </span>
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              {isSignup ? 'Already have an account?' : 'New to AlgoAkhada?'}{' '}
              <button
                type="button"
                onClick={() => setMode(isSignup ? 'login' : 'signup')}
                className="rounded font-semibold text-accent-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
              >
                {isSignup ? 'Log in' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
