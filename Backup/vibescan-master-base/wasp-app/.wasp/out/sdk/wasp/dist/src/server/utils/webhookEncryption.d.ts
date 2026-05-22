/**
 * Decrypt a webhook signing secret that was encrypted with AES-256-GCM
 * Expected format: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export declare function decryptWebhookSecret(encryptedBuffer: Buffer): string;
/**
 * Encrypt a webhook signing secret using AES-256-GCM
 * Returns buffer with format: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export declare function encryptWebhookSecret(signingSecret: string): Buffer;
//# sourceMappingURL=webhookEncryption.d.ts.map