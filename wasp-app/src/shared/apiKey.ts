export const API_KEY_PREFIX = 'vsk_';
export const API_KEY_PREFIX_LENGTH = 12;

export function generateApiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, API_KEY_PREFIX_LENGTH);
}

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX) && token.length > API_KEY_PREFIX_LENGTH;
}
