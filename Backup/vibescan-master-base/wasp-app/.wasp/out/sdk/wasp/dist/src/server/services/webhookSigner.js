/**
 * Webhook Signer Service
 * Generates HMAC-SHA256 signatures for webhook payloads
 * Uses the webhook's encrypted signing secret for verification
 */
import * as crypto from 'crypto';
import { decryptWebhookSecret } from '../utils/webhookEncryption.js';
/**
 * Generate an HMAC-SHA256 signature for a webhook payload
 * @param payload The webhook payload to sign (as JSON string)
 * @param signingSecretEncrypted The encrypted signing secret from the Webhook model
 * @returns Signature result with algorithm and signature value
 * @throws Error if encryption key is not configured or decryption fails
 */
export function signWebhookPayload(payload, signingSecretEncrypted) {
    try {
        // Decrypt the signing secret
        const signingSecret = decryptWebhookSecret(signingSecretEncrypted);
        // Generate HMAC-SHA256 signature
        const signature = crypto
            .createHmac('sha256', signingSecret)
            .update(payload)
            .digest('hex');
        return {
            signature,
            algorithm: 'sha256',
        };
    }
    catch (error) {
        throw new Error(`Failed to sign webhook payload: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Verify a webhook signature
 * @param payload The webhook payload (as JSON string)
 * @param signature The received signature to verify
 * @param signingSecretEncrypted The encrypted signing secret from the Webhook model
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(payload, signature, signingSecretEncrypted) {
    try {
        const { signature: computedSignature } = signWebhookPayload(payload, signingSecretEncrypted);
        const received = Buffer.from(signature, 'hex');
        const computed = Buffer.from(computedSignature, 'hex');
        if (received.length !== computed.length) {
            return false;
        }
        return crypto.timingSafeEqual(received, computed);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=webhookSigner.js.map