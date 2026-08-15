import { useCallback, useEffect, useState } from 'react';
import { authApi, type AuthUser } from '../lib/api';

const USER_KEY = 'cp_arena_user';

function readUser(): AuthUser | null {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? (JSON.parse(stored) as AuthUser) : null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => readUser());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // try to refresh session on mount
    let mounted = true;
    (async () => {
      try {
        // Try to refresh tokens (server sets cookies). We don't expect user data from /refresh.
        await authApi.refresh();
        if (!mounted) return;
        // If refresh succeeded, fetch current user profile.
        try {
          const me = await (await import('../lib/api')).userApi.me();
          if (!mounted) return;
          localStorage.setItem(USER_KEY, JSON.stringify(me));
          setUser(me);
        } catch (meErr) {
          // can't fetch user -> treat as logged out
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      } catch (e) {
        localStorage.removeItem(USER_KEY);
        setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const finishAuth = useCallback((result: { user: AuthUser }) => {
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setUser(result.user);
    return result;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await authApi.login(email, password);
      return finishAuth({ user: resp.user });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to login';
      setError(message);
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [finishAuth]);

  const signup = useCallback(async (email: string, password: string, username: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await authApi.signup(email, password, username);
      return finishAuth({ user: resp.user });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to create account';
      setError(message);
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [finishAuth]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return { user, isLoading, error, login, signup, logout };
}

export { USER_KEY };
