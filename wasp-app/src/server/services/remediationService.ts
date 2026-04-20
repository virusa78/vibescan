import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../validation';
import { normalizeRegionCode, resolveEffectivePolicy } from '../../shared/regionPolicy.js';
import {
  buildLocalRemediationDraft,
  buildRemediationPromptText,
  normalizeRemediationPromptType,
  type FindingRemediationContext,
  type RemediationDraft,
  type RemediationPromptRequest,
  type RemediationPromptType,
} from '../../shared/remediation.js';

const generateRemediationInputSchema = z.object({
  scanId: z.string().min(1),
  findingId: z.string().min(1),
  requestKey: z.string().min(8),
  promptType: z.string().optional(),
});

export interface GenerateCveRemediationInput {
  userId: string;
  scanId: string;
  findingId: string;
  requestKey: string;
  promptType?: string;
}

export interface GenerateCveRemediationResponse {
  [key: string]: unknown;
  usageId: string;
  aiFixPromptId: string;
  scanId: string;
  findingId: string;
  requestKey: string;
  promptType: RemediationPromptType;
  provider: 'local' | 'openai';
  modelName: string;
  quotaRemaining: number;
  promptText: string;
  responsePayload: RemediationDraft['responsePayload'];
}

interface PromptProvider {
  provider: 'local' | 'openai';
  modelName: string;
  generate(request: RemediationPromptRequest): Promise<RemediationDraft>;
}

function getMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function buildFindingContext(finding: {
  id: string;
  cveId: string;
  packageName: string;
  installedVersion: string;
  filePath: string | null;
  severity: string;
  description: string | null;
  cvssScore: number | null;
}): FindingRemediationContext {
  return {
    id: finding.id,
    cveId: finding.cveId,
    packageName: finding.packageName,
    installedVersion: finding.installedVersion,
    filePath: finding.filePath,
    severity: finding.severity,
    description: finding.description,
    cvssScore: finding.cvssScore,
  };
}

function resolveProvider(): PromptProvider {
  const providerName = (process.env.REMEDIATION_LLM_PROVIDER || 'local').toLowerCase();
  if (providerName === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'Remediation provider is not configured', {
        error: 'remediation_provider_unavailable',
      });
    }

    return {
      provider: 'openai',
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      generate: async (request) => generateOpenAiRemediationDraft(apiKey, process.env.OPENAI_MODEL || 'gpt-4o-mini', request),
    };
  }

  return {
    provider: 'local',
    modelName: 'local-remediation-v1',
    generate: async (request) => buildLocalRemediationDraft(request),
  };
}

async function generateOpenAiRemediationDraft(
  apiKey: string,
  modelName: string,
  request: RemediationPromptRequest,
): Promise<RemediationDraft> {
  const promptText = buildRemediationPromptText(request);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You produce compact remediation guidance for security findings. Return JSON only.',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new HttpError(502, 'Failed to generate remediation guidance', {
      error: 'remediation_provider_failed',
      provider: 'openai',
      status: response.status,
    });
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new HttpError(502, 'Failed to parse remediation guidance', {
      error: 'remediation_provider_invalid_response',
      provider: 'openai',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError(502, 'Failed to parse remediation guidance', {
      error: 'remediation_provider_invalid_response',
      provider: 'openai',
    });
  }

  const responsePayload = normalizeOpenAiResponsePayload(parsed, request);

  return {
    provider: 'openai',
    modelName,
    promptText,
    responsePayload,
  };
}

function normalizeOpenAiResponsePayload(
  payload: unknown,
  request: RemediationPromptRequest,
): RemediationDraft['responsePayload'] {
  const value = payload as Partial<RemediationDraft['responsePayload']>;
  return {
    promptType: request.promptType,
    requestKey: request.requestKey,
    findingId: request.finding.id,
    policy: request.policy,
    summary: typeof value.summary === 'string' ? value.summary : 'Remediation guidance generated by LLM.',
    riskNotes: Array.isArray(value.riskNotes) ? value.riskNotes.filter((item): item is string => typeof item === 'string') : [],
    patchGuidance: Array.isArray(value.patchGuidance) ? value.patchGuidance.filter((item): item is string => typeof item === 'string') : [],
    verificationChecklist: Array.isArray(value.verificationChecklist)
      ? value.verificationChecklist.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

async function resolvePolicyForUser(tx: any, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { region: true },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const regionCode = normalizeRegionCode(user.region);
  const [globalPolicy, regionPolicy, userOverride] = await Promise.all([
    tx.regionPolicy.findUnique({ where: { regionCode: 'GLOBAL' } }),
    tx.regionPolicy.findUnique({ where: { regionCode } }),
    tx.userPolicyOverride.findUnique({ where: { userId } }),
  ]);

  return resolveEffectivePolicy({
    regionCode,
    globalPolicy: globalPolicy
      ? {
          monthlyScanLimit: globalPolicy.monthlyScanLimit,
          monthlyRemediationPromptLimit: globalPolicy.monthlyRemediationPromptLimit,
          maxPromptsPerFinding: globalPolicy.maxPromptsPerFinding,
        }
      : null,
    regionPolicy: regionPolicy
      ? {
          monthlyScanLimit: regionPolicy.monthlyScanLimit,
          monthlyRemediationPromptLimit: regionPolicy.monthlyRemediationPromptLimit,
          maxPromptsPerFinding: regionPolicy.maxPromptsPerFinding,
          isActive: regionPolicy.isActive,
        }
      : null,
    userOverride: userOverride
      ? {
          monthlyScanLimit: userOverride.monthlyScanLimit,
          monthlyRemediationPromptLimit: userOverride.monthlyRemediationPromptLimit,
          maxPromptsPerFinding: userOverride.maxPromptsPerFinding,
        }
      : null,
  });
}

function computeQuotaRemaining(limit: number, used: number): number {
  return Math.max(0, limit - used);
}

function sanitizePromptType(promptType?: string): RemediationPromptType {
  return normalizeRemediationPromptType(promptType);
}

export async function generateCveRemediation(input: GenerateCveRemediationInput): Promise<any> {
  const request = ensureArgsSchemaOrThrowHttpError(generateRemediationInputSchema, input);
  const promptType = sanitizePromptType(request.promptType);
  const provider = resolveProvider();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, region: true },
    });
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    const scan = await tx.scan.findUnique({
      where: { id: request.scanId },
      select: { id: true, userId: true },
    });
    if (!scan || scan.userId !== user.id) {
      throw new HttpError(404, 'Scan not found');
    }

    const finding = await tx.finding.findUnique({
      where: { id: request.findingId },
      select: {
        id: true,
        scanId: true,
        userId: true,
        cveId: true,
        packageName: true,
        installedVersion: true,
        filePath: true,
        severity: true,
        description: true,
        cvssScore: true,
      },
    });
    if (!finding || finding.userId !== user.id || finding.scanId !== scan.id) {
      throw new HttpError(404, 'Finding not found');
    }

    const existingUsage = await tx.remediationPromptUsage.findUnique({
      where: {
        userId_requestKey: {
          userId: user.id,
          requestKey: request.requestKey,
        },
      },
    });
    if (existingUsage) {
      if (existingUsage.status === 'rejected_quota') {
        throw new HttpError(429, 'Remediation prompt quota exceeded', {
          error: 'quota_exceeded',
          quota_limit:
            existingUsage.policySnapshot && typeof existingUsage.policySnapshot === 'object'
              ? Number((existingUsage.policySnapshot as any).monthlyRemediationPromptLimit ?? 0)
              : 0,
          quota_remaining: 0,
        });
      }

      const existingPrompt = await tx.aiFixPrompt.findUnique({
        where: {
          userId_requestKey: {
            userId: user.id,
            requestKey: request.requestKey,
          },
        },
      });
      if (existingPrompt && existingPrompt.responsePayload) {
        const payload = existingPrompt.responsePayload as unknown as GenerateCveRemediationResponse['responsePayload'];
        return {
          usageId: existingUsage.id,
          aiFixPromptId: existingPrompt.id,
          scanId: request.scanId,
          findingId: request.findingId,
          requestKey: request.requestKey,
          promptType: sanitizePromptType(existingPrompt.promptType),
          provider: existingPrompt.provider === 'openai' ? 'openai' : 'local',
          modelName: existingPrompt.modelName || 'local-remediation-v1',
          quotaRemaining: existingUsage.status === 'completed'
            ? computeQuotaRemaining(
                Number((existingUsage.policySnapshot as any)?.monthlyRemediationPromptLimit ?? 0),
                await tx.remediationPromptUsage.count({
                  where: {
                    userId: user.id,
                    createdAt: { gte: getMonthStart(new Date()) },
                    status: { in: ['accepted', 'completed'] },
                  },
                }),
              )
            : 0,
          promptText: existingPrompt.promptText,
          responsePayload: payload,
        };
      }
    }

    const effectivePolicy = await resolvePolicyForUser(tx, user.id);
    const monthStart = getMonthStart(new Date());

    const monthlyUsageCount = await tx.remediationPromptUsage.count({
      where: {
        userId: user.id,
        createdAt: { gte: monthStart },
        status: { in: ['accepted', 'completed'] },
      },
    });
    if (monthlyUsageCount >= effectivePolicy.monthlyRemediationPromptLimit) {
      await tx.remediationPromptUsage.create({
        data: {
          userId: user.id,
          scanId: scan.id,
          findingId: finding.id,
          regionAtCall: effectivePolicy.regionCode,
           policySnapshot: effectivePolicy as any,
          requestKey: request.requestKey,
          promptType,
          provider: provider.provider,
          status: 'rejected_quota',
        },
      });

      throw new HttpError(429, 'Remediation prompt quota exceeded', {
        error: 'quota_exceeded',
        quota_limit: effectivePolicy.monthlyRemediationPromptLimit,
        quota_used: monthlyUsageCount,
        quota_remaining: 0,
      });
    }

    const findingCount = await tx.aiFixPrompt.count({
      where: {
        userId: user.id,
        vulnerabilityId: finding.id,
      },
    });
    if (findingCount >= effectivePolicy.maxPromptsPerFinding) {
      await tx.remediationPromptUsage.create({
        data: {
          userId: user.id,
          scanId: scan.id,
          findingId: finding.id,
          regionAtCall: effectivePolicy.regionCode,
           policySnapshot: effectivePolicy as any,
          requestKey: request.requestKey,
          promptType,
          provider: provider.provider,
          status: 'rejected_quota',
        },
      });

      throw new HttpError(429, 'Per-finding remediation prompt quota exceeded', {
        error: 'quota_exceeded',
        quota_limit: effectivePolicy.maxPromptsPerFinding,
        quota_used: findingCount,
        quota_remaining: 0,
      });
    }

    const findingContext = buildFindingContext({
      ...finding,
      cvssScore: finding.cvssScore === null ? null : Number(finding.cvssScore),
    });
    const draftRequest: RemediationPromptRequest = {
      finding: findingContext,
      promptType,
      policy: effectivePolicy,
      requestKey: request.requestKey,
    };

    const draft = await provider.generate(draftRequest);
    const usage = await tx.remediationPromptUsage.create({
      data: {
        userId: user.id,
        scanId: scan.id,
        findingId: finding.id,
        regionAtCall: effectivePolicy.regionCode,
        policySnapshot: effectivePolicy as any,
        requestKey: request.requestKey,
        promptType,
        provider: draft.provider,
        status: 'accepted',
      },
    });

    const prompt = await tx.aiFixPrompt.create({
      data: {
        scanId: scan.id,
        userId: user.id,
        vulnerabilityId: finding.id,
        requestKey: request.requestKey,
        promptText: draft.promptText,
        promptType,
        provider: draft.provider,
        modelName: draft.modelName,
        responsePayload: draft.responsePayload as any,
        status: 'generated',
      },
    });

    await tx.remediationPromptUsage.update({
      where: { id: usage.id },
      data: {
        status: 'completed',
        tokensIn: 0,
        tokensOut: 0,
      },
    });

    return {
      usageId: usage.id,
      aiFixPromptId: prompt.id,
      scanId: scan.id,
      findingId: finding.id,
      requestKey: request.requestKey,
      promptType,
      provider: draft.provider,
      modelName: draft.modelName,
      quotaRemaining: computeQuotaRemaining(
        effectivePolicy.monthlyRemediationPromptLimit,
        monthlyUsageCount + 1,
      ),
      promptText: draft.promptText,
      responsePayload: draft.responsePayload,
    };
  }, { isolationLevel: 'Serializable' });
}
