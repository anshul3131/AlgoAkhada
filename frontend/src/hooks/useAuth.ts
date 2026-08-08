import { useCallback, useEffect, useState } from 'react';
import { authApi, type AuthUser } from '../lib/api';

const TOKEN_KEY = 'cp_arena_token';
const USER_KEY = 'cp_arena_user';

function readUser(): AuthUser | null {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? (JSON.parse(stored) as AuthUser) : null;
}

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  const finishAuth = useCallback((result: { user: AuthUser; token: string }) => {
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
    return result;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return finishAuth(await authApi.login(email, password));
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
      return finishAuth(await authApi.signup(email, password, username));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to create account';
      setError(message);
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [finishAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return { token, user, isLoading, error, login, signup, logout };
}

export { TOKEN_KEY };
