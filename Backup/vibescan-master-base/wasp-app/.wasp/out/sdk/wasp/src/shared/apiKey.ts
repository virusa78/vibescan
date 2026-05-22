export const API_KEY_PREFIX = 'vsk_';
export const LEGACY_API_KEY_PREFIX = 'sk_live_';
export const API_KEY_PREFIX_LENGTH = 12;

export function generateApiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, API_KEY_PREFIX_LENGTH);
}

export function isApiKeyToken(token: string): boolean {
  return (
    (token.startsWith(API_KEY_PREFIX) && token.length > API_KEY_PREFIX.length) ||
    (token.startsWith(LEGACY_API_KEY_PREFIX) && token.length > LEGACY_API_KEY_PREFIX.length)
  );
}
