import { describe, expect, it } from './testGlobals';
import { isApiKeyToken, API_KEY_PREFIX, LEGACY_API_KEY_PREFIX } from '../src/shared/apiKey';

describe('api key tokens', () => {
  it('accepts the current api key prefix', () => {
    expect(isApiKeyToken(`${API_KEY_PREFIX}abcdef123456`)).toBe(true);
  });

  it('accepts the legacy api key prefix', () => {
    expect(isApiKeyToken(`${LEGACY_API_KEY_PREFIX}abcdef123456`)).toBe(true);
  });

  it('rejects unrelated tokens', () => {
    expect(isApiKeyToken('bearer token')).toBe(false);
  });
});
