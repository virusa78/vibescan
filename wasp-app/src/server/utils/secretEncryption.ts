import * as crypto from 'crypto';

const DEFAULT_ENCRYPTION_KEY_LENGTH = 64;

function getEncryptionKeyBuffer(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== DEFAULT_ENCRYPTION_KEY_LENGTH) {
    throw new Error('Encryption key not configured properly');
  }

  return Buffer.from(encryptionKey, 'hex');
}

/**
 * Encrypt a secret using AES-256-GCM.
 * Buffer layout: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext.
 */
export function encryptSecret(secret: string): Buffer {
  const keyBuffer = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  const encrypted = cipher.update(secret, 'utf8');
  const finalPart = cipher.final();
  const ciphertext = Buffer.concat([encrypted, finalPart]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypt a secret previously encrypted with `encryptSecret`.
 */
export function decryptSecret(encryptedBuffer: Buffer): string {
  const keyBuffer = getEncryptionKeyBuffer();
  const iv = encryptedBuffer.subarray(0, 16);
  const authTag = encryptedBuffer.subarray(16, 32);
  const ciphertext = encryptedBuffer.subarray(32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = decipher.update(ciphertext);
  const finalPart = decipher.final();

  return Buffer.concat([decrypted, finalPart]).toString('utf8');
}
