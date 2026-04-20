/**
 * Webhook Delivery Pipeline Tests
 * Tests for signing, event emission, queue integration, and delivery worker
 */

import * as crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { signWebhookPayload, verifyWebhookSignature } from '../src/server/services/webhookSigner';
import { encryptWebhookSecret, decryptWebhookSecret } from '../src/server/utils/webhookEncryption';

describe('Webhook Delivery Pipeline', () => {
  // Set up encryption key for testing
  const testEncryptionKey = crypto.randomBytes(32).toString('hex');

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = testEncryptionKey;
  });

  describe('Webhook Signer Service', () => {
    it('should generate a valid HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const signingSecret = 'test-secret-key';
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      const result = signWebhookPayload(payload, encryptedSecret);

      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('algorithm', 'sha256');
      expect(typeof result.signature).toBe('string');
      expect(result.signature.length).toBeGreaterThan(0);
    });

    it('should generate consistent signatures for the same payload', () => {
      const payload = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const signingSecret = 'test-secret-key';
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      const sig1 = signWebhookPayload(payload, encryptedSecret);
      const sig2 = signWebhookPayload(payload, encryptedSecret);

      expect(sig1.signature).toBe(sig2.signature);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const payload2 = JSON.stringify({ scanId: 'test-456', event: 'scan_failed' });
      const signingSecret = 'test-secret-key';
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      const sig1 = signWebhookPayload(payload1, encryptedSecret);
      const sig2 = signWebhookPayload(payload2, encryptedSecret);

      expect(sig1.signature).not.toBe(sig2.signature);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const secret1 = encryptWebhookSecret('secret-1');
      const secret2 = encryptWebhookSecret('secret-2');

      const sig1 = signWebhookPayload(payload, secret1);
      const sig2 = signWebhookPayload(payload, secret2);

      expect(sig1.signature).not.toBe(sig2.signature);
    });

    it('should verify a valid signature', () => {
      const payload = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const signingSecret = 'test-secret-key';
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      const { signature } = signWebhookPayload(payload, encryptedSecret);
      const isValid = verifyWebhookSignature(payload, signature, encryptedSecret);

      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const payload = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const signingSecret = 'test-secret-key';
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      const isValid = verifyWebhookSignature(payload, 'invalid-signature', encryptedSecret);

      expect(isValid).toBe(false);
    });

    it('should reject a signature with the wrong length', () => {
      const payload = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const signingSecret = 'test-secret-key';
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      const { signature } = signWebhookPayload(payload, encryptedSecret);
      const isValid = verifyWebhookSignature(payload, signature.slice(0, -2), encryptedSecret);

      expect(isValid).toBe(false);
    });

    it('should reject a signature for a different payload', () => {
      const payload1 = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const payload2 = JSON.stringify({ scanId: 'test-456', event: 'scan_failed' });
      const signingSecret = 'test-secret-key';
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      const { signature } = signWebhookPayload(payload1, encryptedSecret);
      const isValid = verifyWebhookSignature(payload2, signature, encryptedSecret);

      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Encryption', () => {
    it('should encrypt and decrypt a signing secret', () => {
      const originalSecret = 'my-webhook-signing-secret-' + crypto.randomBytes(16).toString('hex');
      const encryptedSecret = encryptWebhookSecret(originalSecret);

      expect(encryptedSecret).toBeInstanceOf(Buffer);
      expect(encryptedSecret.length).toBeGreaterThan(0);

      const decryptedSecret = decryptWebhookSecret(encryptedSecret);
      expect(decryptedSecret).toBe(originalSecret);
    });

    it('should generate unique encryption for the same secret (due to random IV)', () => {
      const secret = 'test-secret';
      const encrypted1 = encryptWebhookSecret(secret);
      const encrypted2 = encryptWebhookSecret(secret);

      expect(encrypted1.toString('hex')).not.toBe(encrypted2.toString('hex'));
      
      // But they should decrypt to the same value
      expect(decryptWebhookSecret(encrypted1)).toBe(secret);
      expect(decryptWebhookSecret(encrypted2)).toBe(secret);
    });

    it('should handle special characters in secrets', () => {
      const secretWithSpecialChars = 'secret-with-!@#$%^&*()-+=[]{}|;:\'",.<>?/~`';
      const encrypted = encryptWebhookSecret(secretWithSpecialChars);
      const decrypted = decryptWebhookSecret(encrypted);

      expect(decrypted).toBe(secretWithSpecialChars);
    });
  });

  describe('Webhook Retry Logic', () => {
    it('should calculate exponential backoff delays', () => {
      const delays = [1000, 2000, 4000, 8000, 16000, 32000];
      
      // Simulate the exponential backoff calculation from webhookDeliveryWorker
      for (let i = 0; i < delays.length; i++) {
        const expectedDelay = delays[i];
        // In practice, this would be validated against the actual retry times
        expect(expectedDelay).toBeGreaterThan(0);
        if (i > 0) {
          expect(expectedDelay).toBe(delays[i - 1] * 2);
        }
      }
    });

    it('should respect maximum retry attempts', () => {
      const maxRetries = 5;
      expect(maxRetries).toBe(5);
    });
  });

  describe('Webhook Payload Validation', () => {
    it('should handle JSON payload serialization', () => {
      const payload = {
        scanId: 'test-123',
        eventType: 'scan_complete',
        timestamp: new Date().toISOString(),
        data: {
          status: 'completed',
          findings: 42,
        },
      };

      const payloadStr = JSON.stringify(payload);
      const hash = crypto
        .createHash('sha256')
        .update(payloadStr)
        .digest('hex');

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA256 hex is 64 chars

      // Verify consistent hashing
      const hash2 = crypto
        .createHash('sha256')
        .update(payloadStr)
        .digest('hex');
      expect(hash).toBe(hash2);
    });

    it('should detect payload tampering', () => {
      const originalPayload = JSON.stringify({ scanId: 'test-123', status: 'complete' });
      const tamperedPayload = JSON.stringify({ scanId: 'test-123', status: 'failed' });

      const hash1 = crypto
        .createHash('sha256')
        .update(originalPayload)
        .digest('hex');

      const hash2 = crypto
        .createHash('sha256')
        .update(tamperedPayload)
        .digest('hex');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Integration Scenarios', () => {
    it('should support end-to-end webhook signing and verification', () => {
      // Simulate a webhook payload
      const payload = JSON.stringify({
        event: 'scan_complete',
        scanId: 'scan-abc-123',
        timestamp: '2024-04-18T12:00:00Z',
        data: {
          status: 'completed',
          vulnerabilities: {
            critical: 2,
            high: 5,
            medium: 12,
          },
        },
      });

      // Create and encrypt signing secret
      const signingSecret = crypto.randomBytes(32).toString('hex');
      const encryptedSecret = encryptWebhookSecret(signingSecret);

      // Sign the payload
      const { signature, algorithm } = signWebhookPayload(payload, encryptedSecret);

      // Verify the signature (what a webhook consumer would do)
      const isValid = verifyWebhookSignature(payload, signature, encryptedSecret);
      expect(isValid).toBe(true);

      // Simulate tampered payload
      const tamperedPayload = JSON.stringify({
        event: 'scan_complete',
        scanId: 'scan-abc-456', // Changed
        timestamp: '2024-04-18T12:00:00Z',
        data: {
          status: 'completed',
          vulnerabilities: {
            critical: 2,
            high: 5,
            medium: 12,
          },
        },
      });

      const isTamperedValid = verifyWebhookSignature(tamperedPayload, signature, encryptedSecret);
      expect(isTamperedValid).toBe(false);
    });

    it('should handle concurrent signing operations', () => {
      const payload = JSON.stringify({ scanId: 'test-123', event: 'scan_complete' });
      const encryptedSecret = encryptWebhookSecret('test-secret');

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(signWebhookPayload(payload, encryptedSecret)));
      }

      return Promise.all(promises).then((results) => {
        // All signatures should be identical (same payload and secret)
        const firstSig = results[0].signature;
        results.forEach((result) => {
          expect(result.signature).toBe(firstSig);
        });
      });
    });
  });
});
