import { afterEach, describe, expect, it } from '@jest/globals';
import { resolvePlannedScannerExecutions } from '../../wasp-app/src/server/lib/scanners/providerSelection';

const trackedEnv = {
  VIBESCAN_ENABLE_SNYK_SCANNER: process.env.VIBESCAN_ENABLE_SNYK_SCANNER,
  VIBESCAN_SNYK_CREDENTIAL_MODE: process.env.VIBESCAN_SNYK_CREDENTIAL_MODE,
  SNYK_TOKEN: process.env.SNYK_TOKEN,
};

describe('providerSelection', () => {
  afterEach(() => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = trackedEnv.VIBESCAN_ENABLE_SNYK_SCANNER;
    process.env.VIBESCAN_SNYK_CREDENTIAL_MODE = trackedEnv.VIBESCAN_SNYK_CREDENTIAL_MODE;
    process.env.SNYK_TOKEN = trackedEnv.SNYK_TOKEN;
  });

  it('does not include snyk when the feature flag is disabled', () => {
    delete process.env.VIBESCAN_ENABLE_SNYK_SCANNER;
    process.env.SNYK_TOKEN = 'snyk-token';

    const executions = resolvePlannedScannerExecutions('enterprise', {
      userId: 'user-1',
    });

    expect(executions.map((execution) => execution.provider)).toEqual([
      'grype',
      'codescoring-johnny',
    ]);
  });

  it('includes snyk with environment credentials when enabled and token exists', () => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = 'true';
    delete process.env.VIBESCAN_SNYK_CREDENTIAL_MODE;
    process.env.SNYK_TOKEN = 'snyk-token';

    const executions = resolvePlannedScannerExecutions('enterprise', {
      userId: 'user-1',
      snykReadiness: {
        enabled: true,
        ready: true,
        credentialMode: 'auto',
        credentialSource: { mode: 'environment' },
        reason: null,
        hasEnvironmentToken: true,
        hasUserSecret: false,
      },
    });
    const snykExecution = executions.find((execution) => execution.provider === 'snyk');

    expect(executions.map((execution) => execution.provider)).toEqual([
      'grype',
      'snyk',
    ]);
    expect(snykExecution).toMatchObject({
      provider: 'snyk',
      queueTarget: 'enterprise',
      resultSource: 'snyk',
      credentialSource: { mode: 'environment' },
    });
  });

  it('includes snyk with user-secret credentials when explicitly configured', () => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = 'true';
    process.env.VIBESCAN_SNYK_CREDENTIAL_MODE = 'user-secret';
    delete process.env.SNYK_TOKEN;

    const executions = resolvePlannedScannerExecutions('enterprise', {
      userId: 'user-99',
      snykReadiness: {
        enabled: true,
        ready: true,
        credentialMode: 'user-secret',
        credentialSource: { mode: 'user-secret', userId: 'user-99' },
        reason: null,
        hasEnvironmentToken: false,
        hasUserSecret: true,
      },
    });
    const snykExecution = executions.find((execution) => execution.provider === 'snyk');

    expect(snykExecution?.credentialSource).toEqual({
      mode: 'user-secret',
      userId: 'user-99',
    });
  });
});
