import { Component } from '../types/index.js';
import { ScenarioInput } from '../types/remoteScanner.js';

export type WorkerSource = 'free' | 'enterprise';

export interface ScanWorkerJobData {
    scanId: string;
    components: Component[];
    scenarioInput?: ScenarioInput | null;
}

export interface WorkerQueueEnvelope<TData> {
    data: TData;
}

export function createFreeScanJobData(
    scanId: string,
    components: Component[],
    scenarioInput?: ScenarioInput | null,
): ScanWorkerJobData {
    return {
        scanId,
        components,
        scenarioInput: scenarioInput || null,
    };
}

export function createEnterpriseScanJobData(
    scanId: string,
    components: Component[],
): ScanWorkerJobData {
    return {
        scanId,
        components,
        scenarioInput: null,
    };
}

export function parseScanWorkerJob(job: WorkerQueueEnvelope<ScanWorkerJobData>): ScanWorkerJobData {
    const data = job?.data;
    if (!data?.scanId || !Array.isArray(data?.components)) {
        throw new Error('Invalid scan worker job payload');
    }
    return data;
}
