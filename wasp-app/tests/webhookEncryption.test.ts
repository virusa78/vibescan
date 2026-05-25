import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as crypto from 'crypto';
import { decryptWebhookSecret, encryptWebhookSecret } from '../src/server/utils/webhookEncryption';

describe('webhookEncryption', () => {
  const originalEnv = process.env;
  const mockKey = crypto.randomBytes(32).toString('hex');

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_KEY = mockKey;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts a webhook secret', () => {
    const original = 'whsec_test_secret_1234567890';
    const encrypted = encryptWebhookSecret(original);

    expect(Buffer.isBuffer(encrypted)).toBe(true);
    expect(decryptWebhookSecret(encrypted)).toBe(original);
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptWebhookSecret('secret')).toThrow('expected string, received undefined');
    expect(() => decryptWebhookSecret(Buffer.from('dummy').toString('base64'))).toThrow('expected string, received undefined');
  });

  it('fails when auth tag is modified', () => {
    const encrypted = encryptWebhookSecret('whsec_test_secret_1234567890');
    encrypted[16] ^= 1;

    expect(() => decryptWebhookSecret(encrypted.toString('base64'))).toThrow();
  });
});
