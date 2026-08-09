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
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
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
    throw new Error(errorMessage ?? `Request failed: ${response.status}`);
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    const wrapped = payload as ApiEnvelope<T>;
    if (wrapped.success === false) {
      throw new Error(wrapped.ERROR_MSG ?? 'Request failed');
    }
    return (wrapped.data ?? (undefined as T)) as T;
  }

  return payload as T;
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
};

export const userApi = {
  createUser: (username: string) =>
    request<UserRecord>('/users', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  getUser: (id: string) => request<UserRecord>(`/users/${id}`),
};

export const problemApi = {
  getTags: (token: string) => request<{ tags: string[] }>('/problems/tags', {
    headers: { Authorization: `Bearer ${token}` },
  }),

  getProblemsByTag: (token: string, tag: string, page = 1, limit = 20) => {
    const query = new URLSearchParams({ tag, page: String(page), limit: String(limit) });
    return request<{ items: ProblemListItem[]; page: number; limit: number; total: number }>(`/problems?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getProblem: (id: string, token: string) => request<ProblemRecord>(`/problems/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
};

export const matchApi = {
  getRecentMatches: (token: string, limit = 10) =>
    request<RecentMatchRecord[]>(`/matches/recent?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export const submissionApi = {
  getSubmission: (token: string, submissionId: string) =>
    request<SubmissionDetailRecord>(`/submissions/${submissionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  submitCode: (token: string, payload: {
    userId: string;
    problemId: string;
    language: string;
    code: string;
    mode?: 'match' | 'upsolve';
  }, mode: 'match' | 'upsolve' = 'match') => {
    const requestPayload = { ...payload, mode: payload.mode ?? mode };
    if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
      console.debug('[submission] POST /api/submissions', requestPayload);
    }

    return request<SubmissionRecord>('/submissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(requestPayload),
    });
  },
};
