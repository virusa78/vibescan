/**
 * Webhook Signer Service
 * Generates HMAC-SHA256 signatures for webhook payloads
 * Uses the webhook's encrypted signing secret for verification
 */
export interface SignatureResult {
    signature: string;
    algorithm: string;
}
/**
 * Generate an HMAC-SHA256 signature for a webhook payload
 * @param payload The webhook payload to sign (as JSON string)
 * @param signingSecretEncrypted The encrypted signing secret from the Webhook model
 * @returns Signature result with algorithm and signature value
 * @throws Error if encryption key is not configured or decryption fails
 */
export declare function signWebhookPayload(payload: string, signingSecretEncrypted: Buffer): SignatureResult;
/**
 * Verify a webhook signature
 * @param payload The webhook payload (as JSON string)
 * @param signature The received signature to verify
 * @param signingSecretEncrypted The encrypted signing secret from the Webhook model
 * @returns true if signature is valid, false otherwise
 */
export declare function verifyWebhookSignature(payload: string, signature: string, signingSecretEncrypted: Buffer): boolean;
//# sourceMappingURL=webhookSigner.d.ts.map