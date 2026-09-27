const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, 'src', 'lib', 'api.ts');
let apiCode = fs.readFileSync(apiPath, 'utf-8');

const dashboardInterface = `
export interface DashboardStats {
  submissionStats: {
    accepted: number;
    wrongAnswer: number;
    timeLimitExceeded: number;
    runtimeError: number;
    other: number;
  };
  matchStats: {
    wins: number;
    losses: number;
  };
  topicsStats: Record<string, number>;
  eloHistory: Array<{ date: string; elo: number }>;
}
`;

const dashboardApi = `
export const dashboardApi = {
  getStats: () => request<DashboardStats>('/dashboard', { method: 'GET' }),
};
`;

if (!apiCode.includes('DashboardStats')) {
  apiCode += dashboardInterface + dashboardApi;
  fs.writeFileSync(apiPath, apiCode);
}
