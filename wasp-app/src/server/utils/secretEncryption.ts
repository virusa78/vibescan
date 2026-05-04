import * as crypto from 'crypto';
import { getEncryptionKeyBuffer } from '../config/env.js';

/**
 * Encrypt a secret using AES-256-GCM.
 * Returns base64-encoded string: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext.
 */
export function encryptSecret(secret: string): string {
  const keyBuffer = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  const encrypted = cipher.update(secret, 'utf8');
  const finalPart = cipher.final();
  const ciphertext = Buffer.concat([encrypted, finalPart]);
  const authTag = cipher.getAuthTag();

  const encryptedBuffer = Buffer.concat([iv, authTag, ciphertext]);
  return encryptedBuffer.toString('base64');
}

/**
 * Decrypt a secret previously encrypted with `encryptSecret`.
 */
export function decryptSecret(encryptedBase64: string): string {
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
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
