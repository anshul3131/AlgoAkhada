import type { ProblemListItem, RecentMatchRecord, SubmissionDetailRecord } from '../types';

const API_BASE = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? '/api';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  elo_rating: number;
  created_at: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  ERROR_CODE?: string;
  ERROR_MSG?: string;
}

interface UserRecord {
  id: string;
  username: string;
  elo_rating: number;
  created_at: string;
}

export interface SubmissionRecord {
  id: string;
  userId?: string;
  problemId?: string;
  language?: string;
  status?: string;
}

export interface ProblemRecord {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  tags?: string[];
  timeLimit?: number;
  memoryLimit?: number;
  samples?: { id: string; input: string; output: string; explanation?: string; }[];
  lastSubmission?: {
    code: string;
    language: string;
  };
}

async function request<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const doFetch = async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as ApiEnvelope<T> | T) : null;

    if (!response.ok) {
      const errorMessage = typeof payload === 'object' && payload && 'ERROR_MSG' in payload
        ? (payload as ApiEnvelope<T>).ERROR_MSG
        : (typeof payload === 'object' && payload && 'message' in payload ? (payload as { message?: string }).message : undefined);
      const err = new Error(errorMessage ?? `Request failed: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }

    if (payload && typeof payload === 'object' && 'success' in payload) {
      const wrapped = payload as ApiEnvelope<T>;
      if (wrapped.success === false) {
        throw new Error(wrapped.ERROR_MSG ?? 'Request failed');
      }
      return (wrapped.data ?? (undefined as T)) as T;
    }

    return payload as T;
  };

  try {
    return await doFetch();
  } catch (err) {
    const e = err as any;
    if (allowRefresh && (e?.status === 401 || e?.message?.toLowerCase().includes('unauthorized'))) {
      try {
        const refreshResp = await fetch(`${API_BASE}/users/refresh`, { method: 'POST', credentials: 'include' });
        if (!refreshResp.ok) {
          await fetch(`${API_BASE}/users/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
          throw new Error('Session expired');
        }

        return await request<T>(path, init, false);
      } catch (refreshErr) {
        throw refreshErr;
      }
    }

    throw err;
  }
}

export const authApi = {
  signup: (email: string, password: string, username: string) =>
    request<AuthResponse>('/users/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  refresh: () => request<void>('/users/refresh', { method: 'POST' }),
  logout: async () => {
    await fetch(`${API_BASE}/users/logout`, { method: 'POST', credentials: 'include' });
  },
};

export const userApi = {
  createUser: (username: string) =>
    request<UserRecord>('/users', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  getUser: (id: string) => request<UserRecord>(`/users/${id}`),
  me: () => request<AuthUser>('/users/me'),
  searchUsers: (prefix: string) => request<any>(`/users/search?prefix=${encodeURIComponent(prefix)}`),
};

export const problemApi = {
  getTags: () => request<{ tags: string[] }>('/problems/tags'),

  getProblemsByTag: (tag: string, page = 1, limit = 20) => {
    const query = new URLSearchParams({ tag, page: String(page), limit: String(limit) });
    return request<{ items: ProblemListItem[]; page: number; limit: number; total: number }>(`/problems?${query.toString()}`);
  },

  getProblem: (id: string) => request<ProblemRecord>(`/problems/${id}`),
};

export const matchApi = {
  getRecentMatches: (limit = 10) => request<RecentMatchRecord[]>(`/matches/recent?limit=${limit}`),
  getUserStats: () => request<{ wins: number, losses: number }>('/matches/stats'),
};

export const submissionApi = {
  getSubmission: (submissionId: string) => request<SubmissionDetailRecord>(`/submissions/${submissionId}`),

  submitCode: (payload: {
    userId: string;
    problemId: string;
    language: string;
    code: string;
    mode?: 'match' | 'upsolve' | 'custom';
    matchId?: string;
  }, mode: 'match' | 'upsolve' | 'custom' = 'match') => {
    const requestPayload = { ...payload, mode: payload.mode ?? mode };
    if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
      console.debug('[submission] POST /api/submissions', requestPayload);
    }

    return request<SubmissionRecord>('/submissions', {
      method: 'POST',
      body: JSON.stringify(requestPayload),
    });
  },
};

export interface LanguageRecord {
  id: string;
  name: string;
  fileExtension: string;
}

export interface ExecutionResponse {
  status: string;
  compileError?: string;
  aggregated: { passed: number; total: number; };
  testCaseResults?: {
    testCaseId: string;
    input: string;
    output: string;
    expectedOutput: string;
    status: string;
    executionTimeMs: number;
  }[];
}

export const executionApi = {
  getLanguages: () => request<LanguageRecord[]>('/languages'),
  executeCode: (payload: {
    problemId?: string;
    language: string;
    code: string;
    runMode: 'samples' | 'custom';
    sampleIds?: string[];
    inputs?: string[];
    timeoutMs?: number;
  }) => request<ExecutionResponse>('/execute', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

export const customMatchApi = {
  getMatch: (id: string) => request<any>(`/custom-matches/${id}`),
};


