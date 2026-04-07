/**
 * EnterpriseScannerWorker (Codescoring/BlackDuck)
 *
 * Processes scan jobs from enterprise_scan_queue using Codescoring/BlackDuck API.
 * Implements distributed locking for max 3 concurrent requests.
 */

import { scanOrchestrator } from '../services/scanOrchestrator.js';
import { acquireLock, releaseLock, EnterpriseLockManager } from '../redis/lock.js';
import { generateUUID } from '../utils/index.js';
import config from '../config/index.js';

// Codescoring API configuration
const CODESCORING_API_URL = process.env.CODESCORING_API_URL || 'https://api.blackduck.com';
const CODESCORING_API_KEY = process.env.CODESCORING_API_KEY || '';
const CODESCORING_PROJECT_NAME_PREFIX = 'vibescan-scan-';

/**
 * BlackDuck API response types
 */
interface BlackDuckProjectResponse {
    id?: string;
    name?: string;
}

interface BlackDuckScanResponse {
    url?: string;
    scanUrl?: string;
    status?: string;
    vulnerabilitiesUrl?: string;
}

interface BlackDuckPagedResponse<T> {
    items?: T[];
    paging?: {
        nextPage?: string;
    };
}

interface BlackDuckVulnerability {
    id?: string;
    cveId?: string;
    severity?: string;
    cvssScore?: number;
    componentName?: string;
    componentVersion?: string;
    fixVersion?: string;
    purl?: string;
    exploitable?: boolean;
    description?: string;
    references?: string[];
    ecosystem?: string;
    durationMs?: number;
    scanId?: string;
}

/**
 * EnterpriseScannerWorker
 */
export class EnterpriseScannerWorker {
    private lockManager: EnterpriseLockManager;
    private maxConcurrent: number;
    private pollInterval: number; // in seconds
    private pollTimeout: number; // in seconds

    constructor() {
        this.lockManager = new EnterpriseLockManager(3);
        this.maxConcurrent = 3;
        this.pollInterval = 10; // 10 seconds
        this.pollTimeout = 600; // 10 minutes
    }

    /**
     * Process a scan job from the queue
     * @param job - Queue job data
     */
    async processJob(job: any): Promise<void> {
        const { scanId, components } = job.data;

        console.log(`EnterpriseScannerWorker: Processing scan ${scanId} with ${components.length} components`);

        // Acquire distributed lock
        const lockAcquired = await acquireLock('enterprise-scanner', scanId, {
            timeout: 300000 // 5 minutes
        });

        if (!lockAcquired) {
            console.log(`EnterpriseScannerWorker: Could not acquire lock for ${scanId}, retrying...`);
            throw {
                code: 'lock_timeout',
                message: 'Could not acquire enterprise scanner lock within 5 minutes',
                retryAfter: 60
            };
        }

        try {
            // Create temporary project in Codescoring
            const projectId = await this.createBDProject(scanId);

            try {
                // Upload SBOM
                const sbomUrl = await this.uploadSBOM(projectId, components);

                // Start async scan
                const scanUrl = await this.startScan(projectId, sbomUrl);

                // Poll for completion
                const scanResults = await this.pollScanCompletion(scanUrl);

                // Fetch vulnerabilities with pagination
                const vulnerabilities = await this.fetchVulnerabilities(scanResults.vulnerabilitiesUrl);

                // Normalize output
                const normalizedResult = this.normalizeBlackDuckOutput(vulnerabilities);

                // Save result
                await scanOrchestrator.handleWorkerResult(scanId, 'enterprise', normalizedResult);

                console.log(`EnterpriseScannerWorker: Completed scan ${scanId}`);
            } finally {
                // Cleanup temporary project
                await this.cleanupBDProject(projectId);
            }
        } catch (error: any) {
            console.error(`EnterpriseScannerWorker: Error processing scan ${scanId}:`, error);

            // Check if it's a timeout error
            if (error.code === 'bd_timeout') {
                await scanOrchestrator.handleWorkerResult(scanId, 'enterprise', {
                    scanId,
                    source: 'enterprise',
                    rawOutput: {},
                    vulnerabilities: [],
                    scannerVersion: 'blackduck',
                    cveDbTimestamp: new Date().toISOString(),
                    durationMs: this.pollTimeout * 1000,
                    errorCode: 'bd_timeout'
                });
            } else {
                await scanOrchestrator.handleWorkerError(scanId, 'enterprise', error);
            }
        } finally {
            // Release lock
            await releaseLock('enterprise-scanner', scanId);
        }
    }

    /**
     * Create temporary project in Codescoring/BlackDuck
     * @param scanId - Scan ID
     * @returns Project ID
     */
    private async createBDProject(scanId: string): Promise<string> {
        const projectName = `${CODESCORING_PROJECT_NAME_PREFIX}${scanId}`;

        try {
            const response = await fetch(`${CODESCORING_API_URL}/projects`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CODESCORING_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: projectName,
                    description: `VibeScan scan ${scanId}`,
                    version: '1.0'
                })
            });

            if (!response.ok) {
                throw {
                    code: 'bd_create_project_error',
                    message: `Failed to create project: ${response.statusText}`
                };
            }

            const data = await response.json() as BlackDuckProjectResponse;
            return data.id || '';
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create BlackDuck project';
            throw {
                code: 'bd_create_project_error',
                message: errorMessage
            };
        }
    }

    /**
     * Upload SBOM to Codescoring project
     * @param projectId - Project ID
     * @param components - Components to upload
     * @returns SBOM URL
     */
    private async uploadSBOM(projectId: string, components: Array<{name: string, version: string, purl: string, type: string}>): Promise<string> {
        // Build SBOM
        const sbom = {
            bomFormat: 'CycloneDX',
            specVersion: '1.5',
            serialNumber: `urn:uuid:${generateUUID()}`,
            version: 1,
            components: components.map((comp) => ({
                name: comp.name,
                version: comp.version,
                purl: comp.purl,
                type: comp.type
            }))
        };

        try {
            const response = await fetch(`${CODESCORING_API_URL}/projects/${projectId}/versions/1.0/sbom`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CODESCORING_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sbom)
            });

            if (!response.ok) {
                throw {
                    code: 'bd_upload_error',
                    message: `Failed to upload SBOM: ${response.statusText}`
                };
            }

            const data = await response.json() as {url?: string};
            return data.url || '';
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to upload SBOM to BlackDuck';
            throw {
                code: 'bd_upload_error',
                message: errorMessage
            };
        }
    }

    /**
     * Start async scan on Codescoring project
     * @param projectId - Project ID
     * @param sbomUrl - SBOM URL
     * @returns Scan URL
     */
    private async startScan(projectId: string, sbomUrl: string): Promise<string> {
        try {
            const response = await fetch(`${CODESCORING_API_URL}/projects/${projectId}/versions/1.0/scan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CODESCORING_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sbomUrl,
                    scanType: 'full'
                })
            });

            if (!response.ok) {
                throw {
                    code: 'bd_scan_error',
                    message: `Failed to start scan: ${response.statusText}`
                };
            }

            const data = await response.json() as {scanUrl?: string};
            return data.scanUrl || '';
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start BlackDuck scan';
            throw {
                code: 'bd_scan_error',
                message: errorMessage
            };
        }
    }

    /**
     * Poll for scan completion
     * @param scanUrl - Scan URL to poll
     * @returns Scan results
     */
    private async pollScanCompletion(scanUrl: string): Promise<BlackDuckScanResponse> {
        const startTime = Date.now();

        while (Date.now() - startTime < this.pollTimeout * 1000) {
            try {
                const response = await fetch(scanUrl, {
                    headers: {
                        'Authorization': `Bearer ${CODESCORING_API_KEY}`
                    }
                });

                if (!response.ok) {
                    throw {
                        code: 'bd_poll_error',
                        message: `Failed to poll scan status: ${response.statusText}`
                    };
                }

                const data = await response.json() as BlackDuckScanResponse;

                if (data.status === 'COMPLETE') {
                    return data;
                }

                if (data.status === 'FAILED') {
                    throw {
                        code: 'bd_scan_failed',
                        message: 'BlackDuck scan failed'
                    };
                }

                // Wait before polling again
                await new Promise(resolve => setTimeout(resolve, this.pollInterval * 1000));

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : '';
                if (errorMessage.includes('bd_timeout')) {
                    throw error as {code: string, message: string, retryAfter: number};
                }
                throw {
                    code: 'bd_poll_error',
                    message: errorMessage || 'Failed to poll scan status'
                };
            }
        }

        // Timeout
        throw {
            code: 'bd_timeout',
            message: 'BlackDuck scan timed out after 10 minutes',
            retryAfter: 600
        };
    }

    /**
     * Fetch vulnerabilities with pagination
     * @param vulnerabilitiesUrl - Base URL for vulnerabilities
     * @returns All vulnerabilities
     */
    private async fetchVulnerabilities(vulnerabilitiesUrl: string): Promise<BlackDuckVulnerability[]> {
        const allVulnerabilities: BlackDuckVulnerability[] = [];

        let url = vulnerabilitiesUrl;
        let page = 0;

        while (url) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${CODESCORING_API_KEY}`
                    }
                });

                if (!response.ok) {
                    throw {
                        code: 'bd_fetch_error',
                        message: `Failed to fetch vulnerabilities: ${response.statusText}`
                    };
                }

                const data = await response.json() as BlackDuckPagedResponse<BlackDuckVulnerability>;

                // Add vulnerabilities from this page
                if (data.items && Array.isArray(data.items)) {
                    allVulnerabilities.push(...data.items);
                }

                // Check for next page
                if (data.paging && data.paging.nextPage) {
                    url = data.paging.nextPage;
                    page++;
                } else {
                    url = null;
                }

                // Safety limit on pages
                if (page > 100) {
                    console.warn('EnterpriseScannerWorker: Reached page limit, stopping pagination');
                    break;
                }

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vulnerabilities';
                throw {
                    code: 'bd_fetch_error',
                    message: errorMessage
                };
            }
        }

        return allVulnerabilities;
    }

    /**
     * Normalize BlackDuck output to Vulnerability[] format
     * @param rawItems - Raw BlackDuck items
     * @returns Normalized vulnerabilities
     */
    normalizeBlackDuckOutput(rawItems: BlackDuckVulnerability[]): any {
        const vulnerabilities: any[] = [];

        for (const item of rawItems) {
            const vuln: any = {
                cve_id: item.cveId || item.id,
                severity: this.mapSeverity(item.severity || ''),
                cvss_score: item.cvssScore || 0,
                package_name: item.componentName || '',
                package_ecosystem: item.ecosystem || 'other',
                installed_version: item.componentVersion || '',
                fixed_version: item.fixVersion || null,
                purl: item.purl || '',
                epss_score: null,
                is_exploitable: item.exploitable || false,
                description: item.description || '',
                references: item.references || [],
                source: 'enterprise' as const
            };

            vulnerabilities.push(vuln);
        }

        return {
            scanId: rawItems[0]?.scanId || generateUUID(),
            source: 'enterprise',
            rawOutput: { items: rawItems },
            vulnerabilities,
            scannerVersion: 'blackduck-api',
            cveDbTimestamp: new Date().toISOString(),
            durationMs: rawItems[0]?.durationMs || 0
        };
    }

    /**
     * Map BlackDuck severity to our format
     */
    private mapSeverity(severity: string): string {
        const map: Record<string, string> = {
            critical: 'CRITICAL',
            high: 'HIGH',
            medium: 'MEDIUM',
            low: 'LOW',
            info: 'LOW'
        };
        return map[severity?.toLowerCase()] || 'LOW';
    }

    /**
     * Cleanup temporary project in Codescoring
     * @param projectId - Project ID to delete
     */
    private async cleanupBDProject(projectId: string): Promise<void> {
        try {
            await fetch(`${CODESCORING_API_URL}/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${CODESCORING_API_KEY}`
                }
            });
            console.log(`EnterpriseScannerWorker: Cleaned up project ${projectId}`);
        } catch (error: unknown) {
            console.error(`EnterpriseScannerWorker: Failed to cleanup project ${projectId}:`, error);
        }
    }

    /**
     * Start the worker loop
     */
    async start(): Promise<void> {
        console.log('EnterpriseScannerWorker: Starting...');

        // In production, this would connect to BullMQ queue
        // For now, just log that it's ready
        console.log('EnterpriseScannerWorker: Ready to process jobs from enterprise_scan_queue');
    }
}

export const enterpriseScannerWorker = new EnterpriseScannerWorker();

export default enterpriseScannerWorker;
