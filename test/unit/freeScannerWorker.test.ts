import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const handleWorkerResult = jest.fn();
const handleWorkerError = jest.fn();
const executeScenario = jest.fn();
const parseScanWorkerJob = jest.fn();

jest.mock('../../src/services/scanOrchestrator.js', () => ({
    scanOrchestrator: {
        handleWorkerResult,
        handleWorkerError
    }
}));

jest.mock('../../src/services/remoteScannerAgent.js', () => ({
    remoteScannerAgent: {
        executeScenario
    }
}));

jest.mock('../../src/workers/jobContract.js', () => ({
    parseScanWorkerJob
}));

jest.mock('../../src/config/index.js', () => ({
    __esModule: true,
    default: {
        REMOTE_SCANNER_ENABLED: true,
        REMOTE_SCANNER_PROVIDER_ID: 'provider-1',
        CVE_UPDATE_INTERVAL_HOURS: 6
    }
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    unlinkSync: jest.fn()
}));

describe('FreeScannerWorker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('routes scanner execution failures to orchestrator worker error path', async () => {
        parseScanWorkerJob.mockReturnValue({
            scanId: 'scan-1',
            components: [],
            scenarioInput: null
        });
        (executeScenario as any).mockRejectedValue(new Error('remote unavailable'));

        const { FreeScannerWorker } = require('../../src/workers/freeScannerWorker');
        const worker = new FreeScannerWorker();
        await worker.processJob({ id: 'job-1' });

        expect(handleWorkerResult).not.toHaveBeenCalled();
        expect(handleWorkerError).toHaveBeenCalledTimes(1);
        expect(handleWorkerError).toHaveBeenCalledWith(
            'scan-1',
            'free',
            expect.objectContaining({ message: 'remote unavailable' })
        );
    });
});
