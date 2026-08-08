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

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.ERROR_MSG ?? `Request failed: ${response.status}`);
  }

  return payload.data as T;
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
  getProblem: (id: string, token: string) => request<ProblemRecord>(`/problems/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
};

export const submissionApi = {
  submitCode: (token: string, payload: {
    userId: string;
    problemId: string;
    language: string;
    code: string;
  }) => {
    const requestPayload = { ...payload };
    if (import.meta.env?.DEV) {
      console.debug('[submission] POST /api/submissions', requestPayload);
    }

    return request<SubmissionRecord>('/submissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(requestPayload),
    });
  },
};
