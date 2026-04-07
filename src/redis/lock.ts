/**
 * Distributed lock implementation using Redis
 *
 * Provides atomic distributed locking for enterprise scanner concurrency control.
 * Max 3 concurrent enterprise scans via distributed lock.
 */

import { getRedisClient } from './client.js';

// Lock configuration
const LOCK_PREFIX = 'vibescan:lock:';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Distributed lock options
 */
interface LockOptions {
    timeout?: number;      // Maximum time to wait for lock (ms)
    retryInterval?: number; // Time between retry attempts (ms)
}

/**
 * Acquire a distributed lock
 * @param name - Lock name (e.g., 'enterprise-scanner')
 * @param identifier - Unique identifier for this lock request
 * @param options - Lock options
 * @returns true if lock acquired, false otherwise
 */
export async function acquireLock(
    name: string,
    identifier: string,
    options: LockOptions = {}
): Promise<boolean> {
    const redis = await getRedisClient();
    const lockKey = `${LOCK_PREFIX}${name}`;
    const timeout = options.timeout || LOCK_TTL_MS;
    const retryInterval = options.retryInterval || 100;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        // Try to set the lock using SET with NX (only if not exists)
        const result = await redis.set(lockKey, identifier, {
            NX: true,
            EX: Math.floor(LOCK_TTL_MS / 1000)
        });

        if (result === 'OK') {
            console.log(`Lock acquired: ${name} by ${identifier}`);
            return true;
        }

        // Lock is held by another process, wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    console.log(`Failed to acquire lock: ${name} after ${timeout}ms`);
    return false;
}

/**
 * Release a distributed lock
 * @param name - Lock name
 * @param identifier - Unique identifier that acquired the lock
 * @returns true if lock released, false if lock not held by this identifier
 */
export async function releaseLock(
    name: string,
    identifier: string
): Promise<boolean> {
    const redis = await getRedisClient();
    const lockKey = `${LOCK_PREFIX}${name}`;

    // Get current lock owner
    const currentOwner = await redis.get(lockKey);

    if (currentOwner === identifier) {
        // Only release if we own the lock
        await redis.del(lockKey);
        console.log(`Lock released: ${name} by ${identifier}`);
        return true;
    }

    // Lock is held by another process or doesn't exist
    console.log(`Lock release denied: ${name} is held by ${currentOwner || 'none'}`);
    return false;
}

/**
 * Check if a lock is currently held
 * @param name - Lock name
 * @returns true if lock is held
 */
export async function isLockHeld(name: string): Promise<boolean> {
    const redis = await getRedisClient();
    const lockKey = `${LOCK_PREFIX}${name}`;
    return await redis.exists(lockKey) > 0;
}

/**
 * Get lock owner
 * @param name - Lock name
 * @returns Current lock owner identifier or null
 */
export async function getLockOwner(name: string): Promise<string | null> {
    const redis = await getRedisClient();
    const lockKey = `${LOCK_PREFIX}${name}`;
    return await redis.get(lockKey);
}

/**
 * Extend lock TTL
 * @param name - Lock name
 * @param identifier - Lock owner identifier
 * @param additionalTtl - Additional TTL in milliseconds
 * @returns true if TTL extended, false otherwise
 */
export async function extendLock(
    name: string,
    identifier: string,
    additionalTtl: number = LOCK_TTL_MS
): Promise<boolean> {
    const redis = await getRedisClient();
    const lockKey = `${LOCK_PREFIX}${name}`;

    // Check if we own the lock
    const currentOwner = await redis.get(lockKey);
    if (currentOwner !== identifier) {
        return false;
    }

    // Extend TTL
    await redis.expire(lockKey, Math.floor(additionalTtl / 1000));
    return true;
}

/**
 * Distributed lock manager for enterprise scanner
 * Enforces max 3 concurrent enterprise scans
 */
export class EnterpriseLockManager {
    private lockName = 'enterprise-scanner';
    private maxConcurrent: number;
    private currentCount = 0;

    constructor(maxConcurrent: number = 3) {
        this.maxConcurrent = maxConcurrent;
    }

    /**
     * Try to acquire a scan slot
     * @returns true if slot acquired, false if at capacity
     */
    async acquireSlot(): Promise<boolean> {
        // First check current count using Redis INCR
        const redis = await getRedisClient();
        const countKey = `${LOCK_PREFIX}${this.lockName}:count`;

        // Increment counter atomically
        const newCount = await redis.incr(countKey);

        if (newCount <= this.maxConcurrent) {
            console.log(`Enterprise lock: slot acquired (${newCount}/${this.maxConcurrent})`);
            this.currentCount = newCount;
            return true;
        }

        // At capacity, decrement and return false
        await redis.decr(countKey);
        console.log(`Enterprise lock: at capacity (${newCount}/${this.maxConcurrent})`);
        return false;
    }

    /**
     * Release a scan slot
     */
    async releaseSlot(): Promise<void> {
        const redis = await getRedisClient();
        const countKey = `${LOCK_PREFIX}${this.lockName}:count`;

        const newCount = await redis.decr(countKey);
        this.currentCount = Math.max(0, newCount);

        console.log(`Enterprise lock: slot released (${this.currentCount}/${this.maxConcurrent})`);
    }

    /**
     * Get current usage count
     */
    async getCurrentCount(): Promise<number> {
        const redis = await getRedisClient();
        const countKey = `${LOCK_PREFIX}${this.lockName}:count`;
        const count = await redis.get(countKey);
        return parseInt(count || '0', 10);
    }
}

export default {
    acquireLock,
    releaseLock,
    isLockHeld,
    getLockOwner,
    extendLock,
    EnterpriseLockManager
};
