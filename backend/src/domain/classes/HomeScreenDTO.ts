import { RecentMatchDTO } from "./RecentMatchDto";
import { LiveMatchDTO } from "./LiveMatchesDTO";
import { PublicLobbyDTO } from "./PublicLobbyDTO";

export class HomeScreenUserStatsDTO {
    wins: number;
    losses: number;
}

export class HomeScreenDTO {
    recentMatches: RecentMatchDTO[];
    stats: HomeScreenUserStatsDTO;
    tags: string[];
    liveMatches: LiveMatchDTO[];
    publicLobbies: PublicLobbyDTO[];
}
