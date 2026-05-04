import { createGitHubCheckRun, updateGitHubCheckRun } from './githubAppService';
import { getFrontendBaseUrl } from '../config/runtime';
function toGitHubContext(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function buildScanDetailsUrl(scanId) {
    return `${getFrontendBaseUrl()}/scans/${scanId}`;
}
function buildCheckRunSummary(input) {
    if (input.status === 'queued') {
        return {
            title: 'VibeScan queued',
            summary: 'VibeScan has accepted the repository event and queued a scan for processing.',
        };
    }
    if (input.status === 'in_progress') {
        return {
            title: 'VibeScan in progress',
            summary: 'VibeScan is currently scanning the repository and preparing findings.',
        };
    }
    if (input.errorMessage) {
        return {
            title: 'VibeScan failed',
            summary: `The scan finished with an error: ${input.errorMessage}`,
            conclusion: 'failure',
        };
    }
    return {
        title: 'VibeScan completed',
        summary: typeof input.findingsCount === 'number'
            ? `The scan completed successfully. Active findings detected: ${input.findingsCount}.`
            : 'The scan completed successfully.',
        conclusion: 'success',
    };
}
async function loadScanWithGitHubContext(prisma, scanId) {
    return prisma.scan.findUnique({
        where: { id: scanId },
        select: {
            id: true,
            status: true,
            githubContext: true,
        },
    });
}
async function persistGithubContext(prisma, scanId, githubContext) {
    await prisma.scan.update({
        where: { id: scanId },
        data: {
            githubContext: githubContext,
        },
    });
}
export async function syncGitHubCheckRunForScan(input) {
    const scan = await loadScanWithGitHubContext(input.prisma, input.scanId);
    if (!scan) {
        return;
    }
    const githubContext = toGitHubContext(scan.githubContext);
    if (!githubContext?.installationId
        || !githubContext.repositoryFullName
        || !githubContext.commitSha) {
        return;
    }
    const summary = buildCheckRunSummary({
        status: input.status,
        findingsCount: input.findingsCount,
        errorMessage: input.errorMessage,
    });
    if (githubContext.checkRunId) {
        const updated = await updateGitHubCheckRun(githubContext.installationId, githubContext.repositoryFullName, githubContext.checkRunId, {
            status: input.status,
            ...(input.status === 'completed'
                ? { conclusion: summary.conclusion ?? 'success' }
                : {}),
            details_url: buildScanDetailsUrl(scan.id),
            output: {
                title: summary.title,
                summary: summary.summary,
            },
        });
        await persistGithubContext(input.prisma, scan.id, {
            ...githubContext,
            checkRunUrl: updated.html_url ?? githubContext.checkRunUrl ?? null,
        });
        return;
    }
    const created = await createGitHubCheckRun(githubContext.installationId, githubContext.repositoryFullName, {
        name: 'VibeScan',
        head_sha: githubContext.commitSha,
        status: input.status,
        ...(input.status === 'completed'
            ? { conclusion: summary.conclusion ?? 'success' }
            : {}),
        details_url: buildScanDetailsUrl(scan.id),
        output: {
            title: summary.title,
            summary: summary.summary,
        },
    });
    await persistGithubContext(input.prisma, scan.id, {
        ...githubContext,
        checkRunId: created.id,
        checkRunUrl: created.html_url ?? null,
    });
}
//# sourceMappingURL=githubCheckRunService.js.map