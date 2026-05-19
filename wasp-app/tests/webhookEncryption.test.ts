import { encryptWebhookSecret, decryptWebhookSecret } from '../src/server/utils/webhookEncryption';
import * as crypto from 'crypto';

describe('Webhook Encryption Utils', () => {
  const originalEnv = process.env;
  const mockEncryptionKey = crypto.randomBytes(32).toString('hex'); // 64 characters

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Happy Path', () => {
    it('should correctly encrypt and decrypt a webhook secret', () => {
      process.env.ENCRYPTION_KEY = mockEncryptionKey;

      const originalSecret = 'whsec_test_secret_1234567890';
      const encryptedBuffer = encryptWebhookSecret(originalSecret);

      expect(Buffer.isBuffer(encryptedBuffer)).toBe(true);
      expect(encryptedBuffer.length).toBeGreaterThan(32); // 16 (IV) + 16 (AuthTag) + Ciphertext

      const decryptedSecret = decryptWebhookSecret(encryptedBuffer);
      expect(decryptedSecret).toBe(originalSecret);
    });
  });

  describe('Configuration Errors', () => {
    it('should throw an error when ENCRYPTION_KEY is not set during encryption', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptWebhookSecret('secret')).toThrow('Encryption key not configured properly');
    });

    it('should throw an error when ENCRYPTION_KEY is not set during decryption', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => decryptWebhookSecret(Buffer.from('dummy'))).toThrow('Encryption key not configured properly');
    });

    it('should throw an error when ENCRYPTION_KEY length is invalid', () => {
      process.env.ENCRYPTION_KEY = 'invalid-length'; // not 64 chars
      expect(() => encryptWebhookSecret('secret')).toThrow('Encryption key not configured properly');
      expect(() => decryptWebhookSecret(Buffer.from('dummy'))).toThrow('Encryption key not configured properly');
    });
  });

  describe('Tampered Payload Errors', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = mockEncryptionKey;
    });

    it('should fail to decrypt if auth tag is modified', () => {
      const originalSecret = 'whsec_test_secret_1234567890';
      const encryptedBuffer = encryptWebhookSecret(originalSecret);

      // Tamper with the auth tag (bytes 16 to 31)
      encryptedBuffer[16] ^= 1;

      expect(() => decryptWebhookSecret(encryptedBuffer)).toThrow();
    });

    it('should fail to decrypt if IV is modified', () => {
      const originalSecret = 'whsec_test_secret_1234567890';
      const encryptedBuffer = encryptWebhookSecret(originalSecret);

      // Tamper with the IV (bytes 0 to 15)
      encryptedBuffer[0] ^= 1;

      expect(() => decryptWebhookSecret(encryptedBuffer)).toThrow();
    });

    it('should fail to decrypt if ciphertext is modified', () => {
      const originalSecret = 'whsec_test_secret_1234567890';
      const encryptedBuffer = encryptWebhookSecret(originalSecret);

      // Tamper with the ciphertext (bytes 32 onwards)
      encryptedBuffer[32] ^= 1;

      expect(() => decryptWebhookSecret(encryptedBuffer)).toThrow();
    });
  });
});
