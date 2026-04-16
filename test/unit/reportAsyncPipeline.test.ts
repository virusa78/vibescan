import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPool: any = { query: jest.fn() };
const addReportGenerationJob = jest.fn(async (jobId: string) => jobId);
const getPriorityForPlan = jest.fn(() => 2);
const uploadFile = jest.fn(async () => 'etag-1');
const generatePresignedUrl = jest.fn(async () => 'https://example.com/report.pdf');
const publishReportStatus = jest.fn(async () => undefined);

jest.mock('../../src/database/client.js', () => ({
    getPool: jest.fn(() => mockPool),
}));

jest.mock('../../src/queues/config.js', () => ({
    addReportGenerationJob,
    getPriorityForPlan,
}));

jest.mock('../../src/s3/client.js', () => ({
    BUCKET_PDFS: 'vibescan-pdfs',
    uploadFile,
    generatePresignedUrl,
}));

jest.mock('../../src/redis/pubsub.js', () => ({
    publishReportStatus,
}));

describe('report async pipeline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('queues a pdf job with persisted lifecycle state', async () => {
        const { ReportService } = require('../../src/services/reportService');

        (mockPool.query as any)
            .mockResolvedValueOnce({
                rows: [{ id: 'scan-1', user_id: 'user-1', status: 'done', plan_at_submission: 'pro' }]
            })
            .mockResolvedValueOnce({ rows: [] });

        const service = new ReportService();
        const result = await service.generatePdf('scan-1', 'user-1');

        expect(result.jobId).toBeDefined();
        expect(result.job_id).toEqual(result.jobId);
        expect(addReportGenerationJob).toHaveBeenCalledWith(
            result.jobId,
            'scan-1',
            'user-1',
            'pdf',
            { priority: 2 }
        );
        expect(publishReportStatus).toHaveBeenCalledWith(
            result.jobId,
            'queued',
            { scanId: 'scan-1', format: 'pdf' }
        );
    });

    it('processes queued job and stores completion artifact reference', async () => {
        const { ReportService } = require('../../src/services/reportService');
        const service = new ReportService();

        jest.spyOn(service, 'buildReportView').mockResolvedValue({
            scanId: 'scan-1',
            status: 'done',
            plan: 'pro',
            deltaCount: 1,
            locked: false
        });

        (mockPool.query as any)
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        await service.processReportGenerationJob({
            reportId: 'job-1',
            scanId: 'scan-1',
            userId: 'user-1',
            format: 'pdf'
        });

        expect(uploadFile).toHaveBeenCalledWith(
            'vibescan-pdfs',
            'reports/scan-1/job-1.pdf',
            expect.any(Buffer),
            'application/pdf'
        );
        expect(generatePresignedUrl).toHaveBeenCalledWith(
            'vibescan-pdfs',
            'reports/scan-1/job-1.pdf',
            86400
        );
        expect(publishReportStatus).toHaveBeenNthCalledWith(
            1,
            'job-1',
            'processing',
            { scanId: 'scan-1', format: 'pdf' }
        );
        expect(publishReportStatus).toHaveBeenNthCalledWith(
            2,
            'job-1',
            'completed',
            {
                scanId: 'scan-1',
                format: 'pdf',
                artifactUrl: 'https://example.com/report.pdf',
                s3Key: 'reports/scan-1/job-1.pdf'
            }
        );
    });
});
