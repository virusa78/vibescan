import { randomBytes } from 'crypto';

/**
 * Generate a random API key in the format: sk_live_<random>
 * This generates a 24-character random key similar to Stripe API keys.
 */
export function generateRandomKey(): string {
  // Generate 18 random bytes and convert to base64
  const randomPart = randomBytes(18).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `sk_live_${randomPart}`;
}
