/**
 * Pub/Sub for WebSocket notifications
 *
 * Enables real-time updates for scan status changes.
 */

import { getRedisClient } from './client.js';
import { createClient } from 'redis';

// Pub/Sub channels
const CHANNEL_SCAN_STATUS = 'vibescan:scan:status';
const CHANNEL_SCAN_COMPLETE = 'vibescan:scan:complete';
const CHANNEL_SCAN_ERROR = 'vibescan:scan:error';
const CHANNEL_REPORT_STATUS = 'vibescan:report:status';

/**
 * Publish a message to a channel
 * @param channel - Channel name
 * @param message - Message to publish (will be JSON stringified)
 */
export async function publish(
    channel: string,
    message: unknown
): Promise<void> {
    const redis = await getRedisClient();
    await redis.publish(channel, JSON.stringify(message));
}

/**
 * Publish scan status update
 * @param scanId - Scan ID
 * @param status - New status
 * @param details - Additional details
 */
export async function publishScanStatus(
    scanId: string,
    status: string,
    details?: Record<string, unknown>
): Promise<void> {
    await publish(CHANNEL_SCAN_STATUS, {
        scanId,
        status,
        details,
        timestamp: new Date().toISOString()
    });
}

/**
 * Publish scan completion
 * @param scanId - Scan ID
 * @param result - Scan result
 */
export async function publishScanComplete(
    scanId: string,
    result: Record<string, unknown>
): Promise<void> {
    await publish(CHANNEL_SCAN_COMPLETE, {
        scanId,
        result,
        timestamp: new Date().toISOString()
    });
}

/**
 * Publish scan error
 * @param scanId - Scan ID
 * @param error - Error message
 */
export async function publishScanError(
    scanId: string,
    error: string
): Promise<void> {
    await publish(CHANNEL_SCAN_ERROR, {
        scanId,
        error,
        timestamp: new Date().toISOString()
    });
}

/**
 * Publish report generation status update
 * @param jobId - Report job ID
 * @param status - Job status
 * @param details - Additional details
 */
export async function publishReportStatus(
    jobId: string,
    status: string,
    details?: Record<string, unknown>
): Promise<void> {
    await publish(CHANNEL_REPORT_STATUS, {
        jobId,
        status,
        details,
        timestamp: new Date().toISOString()
    });
}

/**
 * Subscribe to a channel
 * @param channel - Channel name
 * @param callback - Callback function for received messages
 * @returns Subscription ID
 */
export async function subscribe(
    channel: string,
    callback: (message: unknown) => void
): Promise<string> {
    const redis = await getRedisClient();
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create a dedicated client for subscription
    const subscriber = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    subscriber.on('error', (err: Error) => console.error('Subscriber error:', err));
    await subscriber.connect();

    await subscriber.subscribe(channel, (message: string) => {
        callback(JSON.parse(message));
    });

    // Store subscriber for later cleanup
    (global as any)[`redis_sub_${subscriptionId}`] = subscriber;

    return subscriptionId;
}

/**
 * Unsubscribe from a channel
 * @param subscriptionId - Subscription ID from subscribe()
 */
export async function unsubscribe(subscriptionId: string): Promise<void> {
    const subscriber = (global as any)[`redis_sub_${subscriptionId}`];
    if (subscriber) {
        await subscriber.quit();
        delete (global as any)[`redis_sub_${subscriptionId}`];
    }
}

/**
 * Subscribe to scan status updates
 * @param userId - User ID to filter by (optional)
 * @param callback - Callback function
 * @returns Subscription ID
 */
export async function subscribeScanStatus(
    userId?: string,
    callback?: (data: { scanId: string; status: string }) => void
): Promise<string> {
    return subscribe(CHANNEL_SCAN_STATUS, (message) => {
        if (callback) {
            callback(message as any);
        }
    });
}

/**
 * Subscribe to scan completion updates
 * @param userId - User ID to filter by (optional)
 * @param callback - Callback function
 * @returns Subscription ID
 */
export async function subscribeScanComplete(
    userId?: string,
    callback?: (data: { scanId: string; result: Record<string, unknown> }) => void
): Promise<string> {
    return subscribe(CHANNEL_SCAN_COMPLETE, (message) => {
        if (callback) {
            callback(message as any);
        }
    });
}

/**
 * Subscribe to scan error updates
 * @param userId - User ID to filter by (optional)
 * @param callback - Callback function
 * @returns Subscription ID
 */
export async function subscribeScanError(
    userId?: string,
    callback?: (data: { scanId: string; error: string }) => void
): Promise<string> {
    return subscribe(CHANNEL_SCAN_ERROR, (message) => {
        if (callback) {
            callback(message as any);
        }
    });
}

/**
 * Subscribe to report status updates
 * @param callback - Callback function
 * @returns Subscription ID
 */
export async function subscribeReportStatus(
    callback?: (data: { jobId: string; status: string; details?: Record<string, unknown> }) => void
): Promise<string> {
    return subscribe(CHANNEL_REPORT_STATUS, (message) => {
        if (callback) {
            callback(message as any);
        }
    });
}

export default {
    publish,
    publishScanStatus,
    publishScanComplete,
    publishScanError,
    publishReportStatus,
    subscribe,
    unsubscribe,
    subscribeScanStatus,
    subscribeScanComplete,
    subscribeScanError,
    subscribeReportStatus
};
