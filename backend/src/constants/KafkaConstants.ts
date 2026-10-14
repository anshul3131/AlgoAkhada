/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Kafka topic names, event definitions, and configuration constants
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { _SECOND_MS } from "./AppConstant";

export const KafkaTopics = {
    CODE_SUBMISSIONS: "code-submissions",
    TESTCASE_UPLOADS: "testcase-uploads",
    MATCHMAKING_EVENTS: "matchmaking-events",
    MATCH_EVENTS: "match-events",
    MATCHMAKING_REQUESTS: "matchmaking-requests"
} as const;

export const KafkaEvents = {
    QUEUE_STATUS: "queue_status",
    MATCH_FOUND: "match_found",
    OPPONENT_STATUS: "opponent_status",
    MATCH_RESULT: "match_result",
    ELO_UPDATE: "elo_update",
    SUBMISSION_GRADED: "submission_graded",
    CUSTOM_SUBMISSION_GRADED: "custom_submission_graded"
} as const;

export const KafkaConfig = {
    CLIENT_ID_CONSUMER: "cp-arena-consumer",
    CLIENT_ID_PRODUCER: "cp-arena-api",
    CONSUMER_GROUP_ID: "cp-arena-consumer",
    SESSION_TIMEOUT_MS: 30 * _SECOND_MS,
    HEARTBEAT_INTERVAL_MS: 10 * _SECOND_MS,
    CONCURRENT_PARTITIONS: 6,
    INITIAL_RETRY_TIME_MS: 100,
    MAX_RETRIES: 8
} as const;
