import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { encryptSecret, decryptSecret } from '../src/server/utils/secretEncryption';
import * as crypto from 'crypto';

describe('secretEncryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone process.env to avoid modifying the real one and test side effects
    process.env = { ...originalEnv };
    // Provide a valid 64-character hex string as the encryption key
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  afterEach(() => {
    // Restore the original environment variables
    process.env = originalEnv;
  });

  describe('encryptSecret', () => {
    it('encrypts a secret and returns a buffer with the expected layout', () => {
      const secret = 'my-super-secret-string';
      const encryptedBuffer = encryptSecret(secret);

      // Verify it returns a Buffer
      expect(Buffer.isBuffer(encryptedBuffer)).toBe(true);

      // Layout: IV (16) + Auth Tag (16) + Ciphertext (>0)
      expect(encryptedBuffer.length).toBeGreaterThanOrEqual(32);
    });

    it('encrypts an empty string', () => {
      const secret = '';
      const encryptedBuffer = encryptSecret(secret);

      // Ciphertext length for empty string might be 0, but total length should be at least 32
      expect(encryptedBuffer.length).toBeGreaterThanOrEqual(32);
      expect(decryptSecret(encryptedBuffer)).toBe(secret);
    });

    it('encrypts and decrypts a secret successfully', () => {
      const secret = 'another-secret-value-12345!@#$';
      const encryptedBuffer = encryptSecret(secret);
      const decrypted = decryptSecret(encryptedBuffer);

      expect(decrypted).toBe(secret);
    });

    it('produces different buffers for the same secret due to random IV', () => {
      const secret = 'consistent-secret';
      const encryptedBuffer1 = encryptSecret(secret);
      const encryptedBuffer2 = encryptSecret(secret);

      expect(encryptedBuffer1.equals(encryptedBuffer2)).toBe(false);
      expect(decryptSecret(encryptedBuffer1)).toBe(secret);
      expect(decryptSecret(encryptedBuffer2)).toBe(secret);
    });

    it('throws an error if ENCRYPTION_KEY is not defined', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptSecret('test')).toThrow('Encryption key not configured properly');
    });

    it('throws an error if ENCRYPTION_KEY length is invalid', () => {
      process.env.ENCRYPTION_KEY = 'invalid-length'; // not 64 chars
      expect(() => encryptSecret('test')).toThrow('Encryption key not configured properly');
    });
  });

  describe('decryptSecret', () => {
    it('throws an error if the buffer is tampered with', () => {
      const secret = 'secret-to-tamper';
      const encryptedBuffer = encryptSecret(secret);

      // Tamper with the ciphertext part (e.g., change the last byte)
      const tamperedBuffer = Buffer.from(encryptedBuffer);
      tamperedBuffer[tamperedBuffer.length - 1] ^= 1; // flip a bit

      expect(() => decryptSecret(tamperedBuffer)).toThrow(); // Should fail auth tag validation
    });

    it('throws an error if ENCRYPTION_KEY is different during decryption', () => {
      const secret = 'secret-with-key-change';
      const encryptedBuffer = encryptSecret(secret);

      // Change the encryption key before decrypting
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

      expect(() => decryptSecret(encryptedBuffer)).toThrow();
    });
  });
});
