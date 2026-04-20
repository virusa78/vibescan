import {
  buildLocalRemediationDraft,
  buildRemediationPromptText,
  normalizeRemediationPromptType,
} from '../src/shared/remediation';

describe('remediation prompt helpers', () => {
  const request = {
    finding: {
      id: 'finding-1',
      cveId: 'CVE-2026-1234',
      packageName: 'lodash',
      installedVersion: '4.17.20',
      filePath: 'package.json',
      severity: 'high',
      description: 'Prototype pollution risk',
      cvssScore: 7.5,
    },
    policy: {
      regionCode: 'PK',
      monthlyRemediationPromptLimit: 12,
      maxPromptsPerFinding: 3,
    },
    promptType: 'patch' as const,
    requestKey: 'req-12345678',
  };

  it('normalizes prompt types', () => {
    expect(normalizeRemediationPromptType('quick-fix')).toBe('quick_fix');
    expect(normalizeRemediationPromptType('verification')).toBe('verification');
    expect(normalizeRemediationPromptType('unknown')).toBe('patch');
  });

  it('builds a prompt text with finding and policy context', () => {
    const promptText = buildRemediationPromptText(request);

    expect(promptText).toContain('CVE-2026-1234');
    expect(promptText).toContain('lodash');
    expect(promptText).toContain('Region: PK');
    expect(promptText).toContain('Request key: req-12345678');
  });

  it('builds a deterministic local draft', () => {
    const draft = buildLocalRemediationDraft(request);

    expect(draft.provider).toBe('local');
    expect(draft.modelName).toBe('local-remediation-v1');
    expect(draft.responsePayload.findingId).toBe('finding-1');
    expect(draft.responsePayload.promptType).toBe('patch');
    expect(draft.responsePayload.requestKey).toBe('req-12345678');
    expect(draft.responsePayload.summary).toContain('CVE-2026-1234');
    expect(draft.responsePayload.verificationChecklist.length).toBeGreaterThan(0);
  });
});
