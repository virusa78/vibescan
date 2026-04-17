import * as crypto from 'crypto';

/**
 * Decrypt a webhook signing secret that was encrypted with AES-256-GCM
 * Expected format: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export function decryptWebhookSecret(encryptedBuffer: Buffer): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Encryption key not configured properly');
  }

  // Convert hex string to Buffer (32 bytes)
  const keyBuffer = Buffer.from(encryptionKey, 'hex');

  // Extract components from buffer
  const iv = encryptedBuffer.subarray(0, 16);
  const authTag = encryptedBuffer.subarray(16, 32);
  const ciphertext = encryptedBuffer.subarray(32);

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt a webhook signing secret using AES-256-GCM
 * Returns buffer with format: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export function encryptWebhookSecret(signingSecret: string): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Encryption key not configured properly');
  }

  // Convert hex string to Buffer (32 bytes)
  const keyBuffer = Buffer.from(encryptionKey, 'hex');

  // Generate random IV (16 bytes)
  const iv = crypto.randomBytes(16);

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  // Encrypt the signing secret
  let encrypted = cipher.update(signingSecret, 'utf8', 'binary');
  encrypted += cipher.final('binary');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine IV + auth tag + ciphertext into single buffer
  return Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'binary'),
  ]);
}
