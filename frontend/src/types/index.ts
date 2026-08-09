export type PressureLevel = 'normal' | 'warn' | 'danger';

export interface Player {
  id: string;
  handle: string;
  avatarUrl: string;
  elo: number;
  tier: string;
  country?: string;
}

export interface MatchState {
  mode: 'Ranked 1v1' | 'Casual' | 'Blitz';
  queueElapsedSeconds: number;
  searchRange: number;
  opponent?: Player;
  you: Player;
}

export interface Problem {
  id: string;
  title: string;
  statement: string;
  constraints: string[];
  sampleInput: string;
  sampleOutput: string;
}

export interface ProblemListItem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  timeLimit?: number;
  memoryLimit?: number;
}

export interface ProblemTagListResponse {
  tags: string[];
}

export interface ProblemListResponse {
  items: ProblemListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface RecentMatchRecord {
  matchId: string;
  opponentName: string;
  problemId: string;
  problemTitle: string;
  result: 'WIN' | 'LOSE';
  action: 'VIEW_SOLUTION' | 'UPSOLVE';
  submissionId: string | null;
  submittedAt: string | null;
}

export interface SubmissionDetailRecord {
  submissionId: string;
  problemId: string;
  language: string;
  code: string;
  status: string;
}

export interface TestCaseResult {
  id: string;
  name: string;
  status: 'Accepted' | 'Wrong Answer' | 'TLE' | 'Runtime Error';
  expected: string;
  actual: string;
}

export interface QueueState {
  isSearching: boolean;
  elapsedSeconds: number;
  searchRange: number;
  matchedPlayer?: Player;
}

export interface RealtimeEventMap {
  queue_status: { userId?: string; status: 'waiting' | 'matched'; position?: number; elapsedSeconds?: number };
  match_found: { matchId: string; user1Id: string; user2Id: string; problemId: string; startTime: string };
  opponent_status: { matchId: string; userId: string; status: { status: string; passed?: number; total?: number } };
  elo_update: { userId: string; newElo: number };
  match_result: { matchId: string; winnerId: string; loserId: string };
  evaluation_complete: { submissionId: string; status: string; passed: number; total: number };
}

export type RealtimeEventName = keyof RealtimeEventMap;
