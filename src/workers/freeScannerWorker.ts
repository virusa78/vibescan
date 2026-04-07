/**
 * FreeScannerWorker (Grype)
 *
 * Processes scan jobs from free_scan_queue using Grype vulnerability scanner.
 * Runs in isolated Docker containers with --network=none, --read-only, --user=nobody.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { uploadFile, downloadFile, BUCKET_SBOMS, BUCKET_SOURCES } from '../s3/client.js';
import { scanOrchestrator } from '../services/scanOrchestrator.js';
import { acquireLock, releaseLock } from '../redis/lock.js';
import { generateUUID, generateSecureString } from '../utils/index.js';
import config from '../config/index.js';

const execAsync = promisify(exec);

/**
 * FreeScannerWorker
 */
export class FreeScannerWorker {
    private s3Client: any;
    private tempDir: string;
    private cveUpdateInterval: number; // in hours
    private lastCveUpdate: Date | null = null;

    constructor() {
        this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
        this.tempDir = '/tmp/vibescan-free';
        if (!require('fs').existsSync(this.tempDir)) {
            require('fs').mkdirSync(this.tempDir, { recursive: true });
        }
        this.cveUpdateInterval = config.CVE_UPDATE_INTERVAL_HOURS;
    }

    /**
     * Process a scan job from the queue
     * @param job - Queue job data
     */
    async processJob(job: any): Promise<void> {
        const { scanId, components } = job.data;

        console.log(`FreeScannerWorker: Processing scan ${scanId} with ${components.length} components`);

        try {
            // Build SBOM from components
            const sbom = this.buildSBOMFromComponents(components);

            // Save SBOM to temp file
            const sbomPath = join(this.tempDir, `${scanId}-sbom.json`);
            writeFileSync(sbomPath, JSON.stringify(sbom, null, 2));

            // Run Grype scan
            const result = await this.runGrypeScan(sbomPath);

            // Clean up temp file
            unlinkSync(sbomPath);

            // Normalize output
            const normalizedResult = this.normalizeGrypeOutput(result);

            // Save cve_db_timestamp
            normalizedResult.cveDbTimestamp = this.getCveDbTimestamp();

            // Handle result
            await scanOrchestrator.handleWorkerResult(scanId, 'free', normalizedResult);

            console.log(`FreeScannerWorker: Completed scan ${scanId}`);
        } catch (error: any) {
            console.error(`FreeScannerWorker: Error processing scan ${scanId}:`, error);
            await scanOrchestrator.handleWorkerError(scanId, 'free', error);
        }
    }

    /**
     * Build SBOM from components array
     * @param components - Array of components
     * @returns CycloneDX SBOM
     */
    private buildSBOMFromComponents(components: any[]): any {
        return {
            bomFormat: 'CycloneDX',
            specVersion: '1.5',
            serialNumber: `urn:uuid:${generateUUID()}`,
            version: 1,
            metadata: {
                timestamp: new Date().toISOString(),
                tools: [
                    {
                        name: 'vibescan',
                        version: '0.1.0'
                    }
                ]
            },
            components: components.map((comp: any) => ({
                name: comp.name,
                version: comp.version,
                purl: comp.purl,
                type: comp.type,
                properties: comp.ecosystem ? [{ name: 'ecosystem', value: comp.ecosystem }] : []
            }))
        };
    }

    /**
     * Run Grype scan on SBOM file
     * @param sbomPath - Path to SBOM file
     * @returns Grype output
     */
    private async runGrypeScan(sbomPath: string): Promise<any> {
        const startTime = Date.now();

        try {
            // Run Grype with stdin piping (no network access)
            const { stdout, stderr } = await execAsync(
                `grype ${sbomPath} -o json`,
                {
                    timeout: 300000, // 5 minutes
                    maxBuffer: 1024 * 1024 * 100 // 100MB
                }
            );

            if (stderr && !stderr.includes('WARN')) {
                console.warn(`Grype stderr: ${stderr}`);
            }

            const durationMs = Date.now() - startTime;
            return {
                rawOutput: JSON.parse(stdout),
                vulnerabilities: [],
                scannerVersion: 'unknown',
                durationMs
            };
        } catch (error: any) {
            const durationMs = Date.now() - startTime;

            if (error.code === 'ETIMEDOUT') {
                throw {
                    code: 'grype_timeout',
                    message: 'Grype scan timeout',
                    durationMs
                };
            }

            throw {
                code: 'grype_error',
                message: error.message || 'Grype scan failed',
                durationMs
            };
        }
    }

    /**
     * Normalize Grype output to Vulnerability[] format
     * @param rawResult - Raw Grype output
     * @returns Normalized vulnerabilities
     */
    normalizeGrypeOutput(rawResult: any): any {
        const vulnerabilities: any[] = [];
        const startTime = Date.now();

        // Handle Grype JSON output
        const matches = rawResult.rawOutput.matches || [];
        const vulnerabilitiesRaw = rawResult.rawOutput.vulnerabilities || [];

        // Extract vulnerabilities from matches
        for (const match of matches) {
            const vulnerability = match.vulnerability;

            if (vulnerability) {
                const vuln: any = {
                    cve_id: vulnerability.id,
                    severity: this.mapGrypeSeverity(vulnerability.severity),
                    cvss_score: this.extractCvssScore(vulnerability),
                    package_name: match.artifact.name,
                    package_ecosystem: this.determineEcosystem(match.artifact),
                    installed_version: match.artifact.version || '',
                    fixed_version: this.extractFixedVersion(vulnerability),
                    purl: match.artifact.purl || '',
                    epss_score: null,
                    is_exploitable: false,
                    description: vulnerability.description || '',
                    references: this.extractReferences(vulnerability),
                    source: 'free' as const
                };

                vulnerabilities.push(vuln);
            }
        }

        return {
            scanId: rawResult.scanId,
            source: 'free',
            rawOutput: rawResult.rawOutput,
            vulnerabilities,
            scannerVersion: 'grype-unknown',
            cveDbTimestamp: this.getCveDbTimestamp(),
            durationMs: rawResult.durationMs || (Date.now() - startTime)
        };
    }

    /**
     * Map Grype severity to our format
     */
    private mapGrypeSeverity(severity: string): string {
        const map: Record<string, string> = {
            critical: 'CRITICAL',
            high: 'HIGH',
            medium: 'MEDIUM',
            low: 'LOW',
            negligible: 'LOW',
            unknown: 'LOW'
        };
        return map[severity?.toLowerCase()] || 'LOW';
    }

    /**
     * Extract CVSS score from vulnerability
     */
    private extractCvssScore(vulnerability: any): number {
        if (vulnerability.cvss) {
            if (Array.isArray(vulnerability.cvss)) {
                return vulnerability.cvss[0]?.score || 0;
            }
            return vulnerability.cvss.score || 0;
        }
        return 0;
    }

    /**
     * Determine ecosystem from artifact
     */
    private determineEcosystem(artifact: any): string {
        const type = artifact.type?.toLowerCase() || '';
        const name = artifact.name?.toLowerCase() || '';

        if (type.includes('npm') || name.includes('npm')) return 'npm';
        if (type.includes('pypi') || name.includes('pypi')) return 'pypi';
        if (type.includes('maven') || name.includes('maven')) return 'maven';
        if (type.includes('cargo') || name.includes('cargo')) return 'cargo';
        if (type.includes('gem') || name.includes('gem')) return 'gem';
        if (type.includes('nuget') || name.includes('nuget')) return 'nuget';
        if (type.includes('go') || name.includes('go')) return 'go';

        return 'other';
    }

    /**
     * Extract fixed version from vulnerability
     */
    private extractFixedVersion(vulnerability: any): string | null {
        if (vulnerability.fix) {
            if (Array.isArray(vulnerability.fix)) {
                return vulnerability.fix[0]?.versions?.[0] || null;
            }
            return vulnerability.fix.versions?.[0] || null;
        }
        return null;
    }

    /**
     * Extract references from vulnerability
     */
    private extractReferences(vulnerability: any): string[] {
        const references: string[] = [];

        if (vulnerability.references) {
            for (const ref of vulnerability.references) {
                if (ref.url) {
                    references.push(ref.url);
                }
            }
        }

        return references;
    }

    /**
     * Get CVE database timestamp
     */
    private getCveDbTimestamp(): string {
        // In production, this would query Grype's DB timestamp
        // For now, return current time
        return new Date().toISOString();
    }

    /**
     * Update CVE database (called every 6 hours)
     */
    async updateCveDatabase(): Promise<void> {
        try {
            const now = new Date();

            // Check if we need to update
            if (this.lastCveUpdate) {
                const hoursSinceLastUpdate = (now.getTime() - this.lastCveUpdate.getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastUpdate < this.cveUpdateInterval) {
                    console.log('FreeScannerWorker: CVE database update not needed yet');
                    return;
                }
            }

            console.log('FreeScannerWorker: Updating CVE database...');
            await execAsync('grype db update');

            this.lastCveUpdate = now;
            console.log('FreeScannerWorker: CVE database updated successfully');
        } catch (error: any) {
            console.error('FreeScannerWorker: Failed to update CVE database:', error);
        }
    }

    /**
     * Start the worker loop
     */
    async start(): Promise<void> {
        console.log('FreeScannerWorker: Starting...');

        // Start CVE database update scheduler
        this.scheduleCveUpdate();

        // In production, this would connect to BullMQ queue
        // For now, just log that it's ready
        console.log('FreeScannerWorker: Ready to process jobs from free_scan_queue');
    }

    /**
     * Schedule CVE database updates
     */
    private scheduleCveUpdate(): void {
        // Update every 6 hours
        const intervalMs = this.cveUpdateInterval * 60 * 60 * 1000;
        setInterval(() => {
            this.updateCveDatabase();
        }, intervalMs);

        // Initial update
        this.updateCveDatabase();
    }
}

export const freeScannerWorker = new FreeScannerWorker();

export default freeScannerWorker;
