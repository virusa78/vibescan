import * as crypto from 'crypto';
import { getEncryptionKeyBuffer } from '../config/env.js';
/**
 * Decrypt a webhook signing secret that was encrypted with AES-256-GCM
 * Expected format: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export function decryptWebhookSecret(encryptedBuffer) {
    const keyBuffer = getEncryptionKeyBuffer();
    // Extract components from buffer
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const ciphertext = encryptedBuffer.subarray(32);
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    // Decrypt
    const decrypted = decipher.update(ciphertext);
    const finalPart = decipher.final();
    return Buffer.concat([decrypted, finalPart]).toString('utf8');
}
/**
 * Encrypt a webhook signing secret using AES-256-GCM
 * Returns buffer with format: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export function encryptWebhookSecret(signingSecret) {
    const keyBuffer = getEncryptionKeyBuffer();
    // Generate random IV (16 bytes)
    const iv = crypto.randomBytes(16);
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    // Encrypt the signing secret
    const encrypted = cipher.update(signingSecret, 'utf8');
    const finalPart = cipher.final();
    const ciphertext = Buffer.concat([encrypted, finalPart]);
    // Get auth tag
    const authTag = cipher.getAuthTag();
    // Combine IV + auth tag + ciphertext into single buffer
    return Buffer.concat([
        iv,
        authTag,
        ciphertext,
    ]);
}
//# sourceMappingURL=webhookEncryption.js.map