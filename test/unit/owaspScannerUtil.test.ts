import { describe, expect, it } from '@jest/globals';
import { getOwaspCommand } from '../../wasp-app/src/server/lib/scanners/owaspScannerUtil';

describe('owaspScannerUtil', () => {
  it('uses OWASP_COMMAND when provided', () => {
    expect(getOwaspCommand({
      OWASP_COMMAND: '/opt/dependency-check/bin/dependency-check.sh',
    } as NodeJS.ProcessEnv)).toBe('/opt/dependency-check/bin/dependency-check.sh');
  });

  it('defaults to dependency-check', () => {
    expect(getOwaspCommand({} as NodeJS.ProcessEnv)).toBe('dependency-check');
  });
});

