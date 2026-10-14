/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Centralized Redis cache client with namespacing, reconnect resilience, and typed read-through caching
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { createClient } from "redis";
import { logger } from "../../utils/LogglyClient";

export type RedisClientType = ReturnType<typeof createClient>;

export class RedisCache {
    public static KEY_PREFIX: string = "AlgoAkhada";
    private static instance: RedisCache;
    private client: RedisClientType;
    private static readonly CONNECTION_TIMEOUT_MS = 3000;
    private static readonly PING_TIMEOUT_MS = 2000;

    private constructor() {
        const url = process.env.REDIS_URL || "redis://localhost:6379";
        this.client = createClient({ url });

        this.client.on("error", (err) => logger.error(`[RedisCache Error]: ${err?.message || err}`));
    }

    public static getInstanceSync(): RedisCache {
        if (!RedisCache.instance) {
            RedisCache.instance = new RedisCache();
        }
        return RedisCache.instance;
    }

    public static async getInstance(): Promise<RedisCache> {
        if (!RedisCache.instance) {
            RedisCache.instance = new RedisCache();
        }
        await RedisCache.instance.connect();
        redisCache = RedisCache.instance;
        return RedisCache.instance;
    }

    public async connect(): Promise<void> {
        if (this.client.isOpen) return;

        let timeoutId: NodeJS.Timeout | undefined;
        const connectionPromise = this.client.connect();
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("Redis connection timed out")), RedisCache.CONNECTION_TIMEOUT_MS);
        });

        try {
            await Promise.race([connectionPromise, timeoutPromise]);
            logger.info("✅ RedisCache connected successfully.");
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    public async disconnect(): Promise<void> {
        if (this.client.isOpen) {
            await this.client.disconnect();
            logger.info("✅ RedisCache disconnected.");
        }
    }

    public get rawClient(): RedisClientType {
        return this.client;
    }

    public prefixedKey(key: string): string {
        const prefix = `${RedisCache.KEY_PREFIX}:`;
        if (key.startsWith(prefix)) return key;
        return `${prefix}${key}`;
    }

    public async keys(pattern: string): Promise<string[]> {
        const rawKeys = await this.client.keys(this.prefixedKey(pattern));
        const prefix = `${RedisCache.KEY_PREFIX}:`;
        return rawKeys.map(k => k.startsWith(prefix) ? k.slice(prefix.length) : k);
    }

    // ─── STRING / KEY OPERATIONS ──────────────────────────────────────────────

    public async get<T = any>(key: string): Promise<T | null> {
        const value = await this.client.get(this.prefixedKey(key));
        if (value === null || value === undefined) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return value as unknown as T;
        }
    }

    public async set(key: string, value: any, options: { EX?: number; PX?: number; NX?: boolean } = {}): Promise<string | null> {
        const stringValue = typeof value === "string" ? value : JSON.stringify(value);
        const setOptions: any = {};
        if (options.EX) setOptions.EX = options.EX;
        if (options.PX) setOptions.PX = options.PX;
        if (options.NX) setOptions.NX = options.NX;

        return await this.client.set(this.prefixedKey(key), stringValue, setOptions);
    }

    public async setEx(key: string, seconds: number, value: any): Promise<string | null> {
        return await this.set(key, value, { EX: seconds });
    }

    public async del(key: string): Promise<number> {
        return await this.client.del(this.prefixedKey(key));
    }

    public async delMultiple(keys: string[]): Promise<number> {
        if (!keys || keys.length === 0) return 0;
        const prefixedKeys = keys.map(k => this.prefixedKey(k));
        return await this.client.del(prefixedKeys);
    }

    public async expire(key: string, ttlSeconds: number): Promise<boolean> {
        const result = await this.client.expire(this.prefixedKey(key), ttlSeconds);
        return Boolean(result);
    }

    public async incr(key: string): Promise<number> {
        return await this.client.incr(this.prefixedKey(key));
    }

    public async decr(key: string): Promise<number> {
        return await this.client.decr(this.prefixedKey(key));
    }

    public async exists(key: string): Promise<number> {
        return await this.client.exists(this.prefixedKey(key));
    }

    // ─── LIST OPERATIONS ──────────────────────────────────────────────────────

    public async lpush(key: string, ...values: string[]): Promise<number> {
        return await this.client.lPush(this.prefixedKey(key), values);
    }

    public async rpush(key: string, ...values: string[]): Promise<number> {
        return await this.client.rPush(this.prefixedKey(key), values);
    }

    public async rpushAll(key: string, values: string[]): Promise<number> {
        if (!values || values.length === 0) return 0;
        return await this.client.rPush(this.prefixedKey(key), values);
    }

    public async lpop(key: string): Promise<string | null> {
        return await this.client.lPop(this.prefixedKey(key));
    }

    public async rpop(key: string): Promise<string | null> {
        return await this.client.rPop(this.prefixedKey(key));
    }

    public async lrange(key: string, start: number, end: number): Promise<string[]> {
        return await this.client.lRange(this.prefixedKey(key), start, end);
    }

    public async lrem(key: string, value: string, count: number = 0): Promise<number> {
        return await this.client.lRem(this.prefixedKey(key), count, value);
    }

    public async llen(key: string): Promise<number> {
        return await this.client.lLen(this.prefixedKey(key));
    }

    public async lindex(key: string, index: number): Promise<string | null> {
        return await this.client.lIndex(this.prefixedKey(key), index);
    }

    // ─── SET OPERATIONS ───────────────────────────────────────────────────────

    public async sadd(key: string, members: string[]): Promise<number> {
        if (!members || members.length === 0) return 0;
        return await this.client.sAdd(this.prefixedKey(key), members);
    }

    public async smembers(key: string): Promise<string[]> {
        return await this.client.sMembers(this.prefixedKey(key));
    }

    public async srem(key: string, members: string[]): Promise<number> {
        if (!members || members.length === 0) return 0;
        return await this.client.sRem(this.prefixedKey(key), members);
    }

    public async scard(key: string): Promise<number> {
        return await this.client.sCard(this.prefixedKey(key));
    }

    public async sismember(key: string, member: string): Promise<boolean> {
        const result = await this.client.sIsMember(this.prefixedKey(key), member);
        return Boolean(result);
    }

    // ─── SORTED SET OPERATIONS ────────────────────────────────────────────────

    public async zadd(key: string, score: number, member: string): Promise<number> {
        return await this.client.zAdd(this.prefixedKey(key), { score, value: member });
    }

    public async zrem(key: string, ...members: string[]): Promise<number> {
        if (!members || members.length === 0) return 0;
        return await this.client.zRem(this.prefixedKey(key), members);
    }

    public async zcard(key: string): Promise<number> {
        return await this.client.zCard(this.prefixedKey(key));
    }

    public async zrange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.client.zRange(this.prefixedKey(key), start, stop);
    }

    public async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.client.zRange(this.prefixedKey(key), start, stop, { REV: true });
    }

    public async zrangeWithScores(key: string, start: number, stop: number): Promise<Array<{ value: string; score: number }>> {
        return await this.client.zRangeWithScores(this.prefixedKey(key), start, stop);
    }

    public async zrevrangeWithScores(key: string, start: number, stop: number): Promise<Array<{ member: string; score: number }>> {
        const raw = await this.client.zRangeWithScores(this.prefixedKey(key), start, stop, { REV: true });
        return raw.map(item => ({ member: item.value, score: item.score }));
    }

    public async zrangeByScoreWithScores(key: string, min: number, max: number): Promise<Array<{ value: string; score: number }>> {
        return await this.client.zRangeByScoreWithScores(this.prefixedKey(key), min, max);
    }

    // ─── HASH OPERATIONS ──────────────────────────────────────────────────────

    public async hset(key: string, field: string, value: string): Promise<number> {
        return await this.client.hSet(this.prefixedKey(key), field, value);
    }

    public async hget(key: string, field: string): Promise<string | null> {
        return await this.client.hGet(this.prefixedKey(key), field);
    }

    public async hgetall(key: string): Promise<Record<string, string>> {
        return await this.client.hGetAll(this.prefixedKey(key));
    }

    public async hdel(key: string, ...fields: string[]): Promise<number> {
        if (!fields || fields.length === 0) return 0;
        return await this.client.hDel(this.prefixedKey(key), fields);
    }

    public async hlen(key: string): Promise<number> {
        return await this.client.hLen(this.prefixedKey(key));
    }

    public async hmset(key: string, data: Record<string, string>): Promise<number> {
        return await this.client.hSet(this.prefixedKey(key), data);
    }

    public async hmget(key: string, fields: string[]): Promise<(string | null)[]> {
        if (!fields || fields.length === 0) return [];
        return await this.client.hmGet(this.prefixedKey(key), fields);
    }

    // ─── MULTI-KEY / BATCH OPERATIONS ─────────────────────────────────────────

    public async mget(keys: string[]): Promise<(string | null)[]> {
        if (!keys || keys.length === 0) return [];
        const prefixed = keys.map(k => this.prefixedKey(k));
        return await this.client.mGet(prefixed);
    }

    public async execMulti(callback: (multi: ReturnType<RedisClientType["multi"]>) => void): Promise<any[]> {
        const multi = this.client.multi();
        callback(multi);
        return await multi.exec();
    }

    // ─── HEALTH / PING ────────────────────────────────────────────────────────

    public async ping(): Promise<boolean> {
        if (!this.client.isOpen) return false;

        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("Redis PING timed out")), RedisCache.PING_TIMEOUT_MS);
        });

        try {
            const result = await Promise.race([this.client.ping(), timeoutPromise]);
            return result === "PONG";
        } catch {
            return false;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }
}

export let redisCache: RedisCache = RedisCache.getInstanceSync();

export async function createRedisCacheClient(): Promise<RedisCache> {
    redisCache = await RedisCache.getInstance();
    return redisCache;
}
