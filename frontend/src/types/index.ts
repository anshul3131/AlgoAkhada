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
  problemTitle?: string;
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
  custom_lobby_invite_received: { lobbyId: string; inviterUsername: string; inviterId: string };
  custom_lobby_updated: { id: string; topic: string; timeLimit: number; maxParticipants: number; hostId: string; participants: any[] };
  custom_lobby_joined: { id: string; topic: string; timeLimit: number; maxParticipants: number; hostId: string; participants: any[] };
  custom_match_started: { id: string; problemId: string };
  custom_lobby_declined: { lobbyId: string; declinerId: string };
  custom_lobby_left: { lobbyId: string; userId: string };
  custom_match_result: { lobbyId: string; result: string };
  custom_lobby_submission: { lobbyId: string; userId: string; username: string; status: string; score: number; passed: number; total: number; compileError?: string };
  custom_lobby_chat_message: { userId: string; username: string; message: string; timestamp: string };
  custom_lobby_chat_typing: { userId: string; username: string; isTyping: boolean };
  public_lobbies_updated: any[];
  webrtc_offer: { senderId: string; offer: RTCSessionDescriptionInit };
  webrtc_answer: { senderId: string; answer: RTCSessionDescriptionInit };
  webrtc_ice_candidate: { senderId: string; candidate: RTCIceCandidateInit };
  rematch_requested: void;
  rematch_declined: void;
  spectator_count: number;
  spectator_code_update: { userId: string; username: string; code: string; language: string };
  error: { message: string };
}

export type RealtimeEventName = keyof RealtimeEventMap;
