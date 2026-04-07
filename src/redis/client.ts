/**
 * Redis client configuration
 *
 * Provides singleton Redis connection with utilities for:
 * - Distributed locking
 * - Quota counters
 * - Session management
 * - Pub/Sub for WebSocket notifications
 */

import dotenv from 'dotenv';

dotenv.config();

// Redis configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Global Redis client instance
let redisClient: any | null = null;

/**
 * Get or create Redis client instance
 */
export async function getRedisClient(): Promise<any> {
    if (redisClient) {
        return redisClient;
    }

    // Import the redis npm package using explicit node_modules path
    // This bypasses the @/redis alias which points to local redis utilities
    const { createClient } = await import('redis/dist/index.js');

    // Build client config - use socket options if REDIS_HOST/PORT are set, otherwise use URL
    const clientConfig: any = {
        socket: {
            reconnectStrategy: (retries: number) => {
                // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1s, 2s, 4s, 8s, 16s, 32s
                const delay = Math.min(100 * Math.pow(2, retries), 32000);
                console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
                return delay;
            }
        }
    };

    // Use URL if available, otherwise use host/port
    if (redisUrl && !process.env.REDIS_HOST) {
        clientConfig.url = redisUrl;
    } else {
        clientConfig.socket.host = process.env.REDIS_HOST || 'localhost';
        clientConfig.socket.port = parseInt(process.env.REDIS_PORT || '6379');
    }

    redisClient = createClient(clientConfig);

    redisClient.on('error', (err: Error) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Redis: Connected'));
    redisClient.on('reconnecting', () => console.log('Redis: Reconnecting...'));
    redisClient.on('ready', () => console.log('Redis: Ready'));

    await redisClient.connect();
    return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

/**
 * Get Redis client instance (synchronous, throws if not connected)
 */
export function getRedisClientSync(): any {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call getRedisClient() first.');
    }
    return redisClient;
}

export default {
    getRedisClient,
    closeRedisConnection,
    getRedisClientSync
};
