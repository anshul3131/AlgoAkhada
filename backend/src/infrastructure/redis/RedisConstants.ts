export class RedisKeys {
    /**
     * Key for user session refresh tokens
     * Example: refresh_token:uuid
     */
    public static getRefreshTokenKey(userId: string): string {
        return `refresh_token:${userId}`;
    }

    /**
     * Key for cached recent completed matches of a user
     * Example: recent_matches:uuid
     */
    public static getRecentMatchesKey(userId: string): string {
        return `recent_matches:${userId}`;
    }

    /**
     * Key for sorted set matchmaking queue by tag (e.g. DP, Graphs, GENERIC)
     * Example: matchmaking_queue:GENERIC
     */
    public static getMatchmakingQueueKey(tag: string): string {
        return `matchmaking_queue:${tag}`;
    }

    /**
     * Pattern to find all matchmaking queues
     */
    public static getMatchmakingQueuePattern(): string {
        return `matchmaking_queue:*`;
    }

    /**
     * Hash key storing join timestamps of users in queue
     */
    public static getQueueJoinTimeKey(): string {
        return `queue_join_time`;
    }

    /**
     * Hash key mapping user ID to their active matchmaking queue key
     */
    public static getUserActiveQueueKey(): string {
        return `user_active_queue`;
    }

    /**
     * Key for rematch proposals between two players in a match
     * Example: rematch:match_uuid
     */
    public static getRematchKey(matchId: string): string {
        return `rematch:${matchId}`;
    }
}
