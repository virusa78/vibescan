export type RemediationPromptType = 'quick_fix' | 'patch' | 'verification';

export interface FindingRemediationContext {
  id: string;
  cveId: string;
  packageName: string;
  installedVersion: string;
  filePath?: string | null;
  severity: string;
  description?: string | null;
  cvssScore?: number | null;
}

export interface RemediationPolicyContext {
  regionCode: string;
  monthlyRemediationPromptLimit: number;
  maxPromptsPerFinding: number;
}

export interface RemediationPromptRequest {
  finding: FindingRemediationContext;
  promptType: RemediationPromptType;
  policy: RemediationPolicyContext;
  requestKey: string;
}

export interface RemediationGuidance {
  summary: string;
  riskNotes: string[];
  patchGuidance: string[];
  verificationChecklist: string[];
}

export interface RemediationDraft {
  provider: 'local' | 'openai';
  modelName: string;
  promptText: string;
  responsePayload: RemediationGuidance & {
    promptType: RemediationPromptType;
    requestKey: string;
    findingId: string;
    policy: RemediationPolicyContext;
  };
}

export function normalizeRemediationPromptType(value?: string | null): RemediationPromptType {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case 'quick_fix':
    case 'quick-fix':
      return 'quick_fix';
    case 'verification':
      return 'verification';
    case 'patch':
    default:
      return 'patch';
  }
}

function formatCvssScore(cvssScore?: number | null): string {
  if (typeof cvssScore !== 'number' || !Number.isFinite(cvssScore)) {
    return 'unscored';
  }

  return cvssScore.toFixed(1);
}

export function buildRemediationPromptText(request: RemediationPromptRequest): string {
  const { finding, policy, promptType, requestKey } = request;
  const filePath = finding.filePath ? `File path: ${finding.filePath}` : 'File path: unavailable';
  const description = finding.description ? finding.description : 'No description available.';

  return [
    'You are generating a remediation plan for a software vulnerability.',
    `Request key: ${requestKey}`,
    `Region: ${policy.regionCode}`,
    `Prompt type: ${promptType}`,
    `CVE: ${finding.cveId}`,
    `Package: ${finding.packageName}`,
    `Installed version: ${finding.installedVersion}`,
    `Severity: ${finding.severity}`,
    `CVSS: ${formatCvssScore(finding.cvssScore)}`,
    filePath,
    `Description: ${description}`,
    `Policy: max ${policy.maxPromptsPerFinding} prompts per finding and ${policy.monthlyRemediationPromptLimit} prompts per month.`,
    'Return concise remediation guidance with summary, risk notes, patch guidance, and a verification checklist.',
    'Do not invent package names, CVEs, or file paths.',
  ].join('\n');
}

export function buildLocalRemediationDraft(request: RemediationPromptRequest): RemediationDraft {
  const { finding, promptType, policy, requestKey } = request;
  const promptText = buildRemediationPromptText(request);

  const summaryParts = [
    `${finding.cveId} affects ${finding.packageName} ${finding.installedVersion}.`,
    promptType === 'verification'
      ? 'Focus on validation steps and regression coverage.'
      : 'Focus on the smallest safe patch path.',
  ];

  return {
    provider: 'local',
    modelName: 'local-remediation-v1',
    promptText,
    responsePayload: {
      promptType,
      requestKey,
      findingId: finding.id,
      policy,
      summary: summaryParts.join(' '),
      riskNotes: [
        `Severity ${finding.severity.toUpperCase()} with CVSS ${formatCvssScore(finding.cvssScore)}.`,
        finding.filePath ? `Affected path: ${finding.filePath}.` : 'No file path was provided.',
      ],
      patchGuidance:
        promptType === 'verification'
          ? [
              'Reproduce the vulnerable path in a test or manual check.',
              'Verify the patched behavior prevents the vulnerable state.',
            ]
          : [
              'Prefer a minimal code change that preserves existing behavior.',
              'Add input validation or dependency updates before broader refactors.',
              'Keep the fix scoped to the affected package or call site.',
            ],
      verificationChecklist: [
        'Re-run the vulnerable flow after the change.',
        'Add or update regression tests for the affected code path.',
        'Confirm the vulnerability is no longer reachable in the patched build.',
      ],
    },
  };
}
