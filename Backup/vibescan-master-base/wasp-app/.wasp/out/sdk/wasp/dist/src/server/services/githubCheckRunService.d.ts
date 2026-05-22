import type { PrismaClient } from '@prisma/client';
type ScanGithubPrisma = Pick<PrismaClient, 'scan' | 'githubInstallation'>;
export declare function syncGitHubCheckRunForScan(input: {
    prisma: ScanGithubPrisma;
    scanId: string;
    status: 'queued' | 'in_progress' | 'completed';
    findingsCount?: number;
    errorMessage?: string;
}): Promise<void>;
export {};
//# sourceMappingURL=githubCheckRunService.d.ts.map