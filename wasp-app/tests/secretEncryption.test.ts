import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as crypto from 'crypto';
import { decryptSecret, encryptSecret } from '../src/server/utils/secretEncryption';

describe('secretEncryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('encrypts and decrypts a secret successfully', () => {
    const secret = 'another-secret-value-12345!@#$';
    const encrypted = encryptSecret(secret);

    expect(typeof encrypted).toBe('string');
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it('produces different payloads for the same secret due to random IV', () => {
    const secret = 'consistent-secret';
    const encrypted1 = encryptSecret(secret);
    const encrypted2 = encryptSecret(secret);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptSecret(encrypted1)).toBe(secret);
    expect(decryptSecret(encrypted2)).toBe(secret);
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret('test')).toThrow('expected string, received undefined');
  });

  it('throws when payload is tampered with', () => {
    const encrypted = encryptSecret('secret-to-tamper');
    const tampered = Buffer.from(encrypted, 'base64');
    tampered[tampered.length - 1] ^= 1;

    expect(() => decryptSecret(tampered.toString('base64'))).toThrow();
  });
});
