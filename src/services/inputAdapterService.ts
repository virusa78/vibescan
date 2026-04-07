/**
 * InputAdapterService
 *
 * Adapts various input sources to normalized component format.
 * Handles source ZIP extraction, GitHub cloning, and SBOM validation.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { uploadFile, downloadFile, BUCKET_SOURCES, BUCKET_SBOMS } from '../s3/client.js';
import { generateUUID } from '../utils/index.js';

const execAsync = promisify(exec);

/**
 * Component structure
 */
export interface Component {
    name: string;
    version: string;
    purl: string;
    type: 'library' | 'application' | 'framework' | 'os' | 'container' | 'device' | 'firmware' | 'file';
    ecosystem?: string;
}

/**
 * Input adapter result
 */
export interface InputAdapterResult {
    components: Component[];
    sbomRaw?: any;
    sbomS3Key?: string;
}

/**
 * CycloneDX validation result
 */
export interface CycloneDXValidationResult {
    valid: boolean;
    errors: string[];
    specVersion?: string;
}

/**
 * InputAdapterService
 */
export class InputAdapterService {
    private s3Client: any;
    private tempDir: string;

    constructor() {
        this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
        this.tempDir = '/tmp/vibescan';
        // Use the imported fs functions
        try {
            readFileSync(this.tempDir, 'utf8');
        } catch {
            mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Process source ZIP file
     * @param s3Key - S3 key of the ZIP file
     * @returns Normalized components
     */
    async fromSourceZip(s3Key: string): Promise<InputAdapterResult> {
        const zipPath = join(this.tempDir, `${generateUUID()}.zip`);
        const extractDir = join(this.tempDir, generateUUID());

        try {
            // Download ZIP from S3
            const data = await this.s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_SOURCES,
                Key: s3Key
            }));

            // Save ZIP to temp location
            const stream = require('fs').createWriteStream(zipPath);
            await pipeline(data.Body as any, stream);

            // Extract ZIP
            mkdirSync(extractDir, { recursive: true });
            await execAsync(`unzip -q "${zipPath}" -d "${extractDir}"`);

            // Run Syft to generate SBOM
            const sbomPath = join(this.tempDir, `${generateUUID()}-sbom.json`);
            await execAsync(`syft "${extractDir}" -o json > "${sbomPath}"`);

            // Read and parse SBOM
            const sbomRaw = JSON.parse(readFileSync(sbomPath, 'utf8'));

            // Normalize components
            const components = this.normalizeComponents(sbomRaw);

            // Clean up
            unlinkSync(zipPath);
            this.cleanupDirectory(extractDir);

            // Upload SBOM to S3
            const sbomS3Key = `sboms/${generateUUID()}.json`;
            await uploadFile(BUCKET_SBOMS, sbomS3Key, JSON.stringify(sbomRaw), 'application/json');

            return {
                components,
                sbomRaw,
                sbomS3Key
            };
        } catch (error: any) {
            // Clean up on error
            try {
                if (require('fs').existsSync(zipPath)) {
                    require('fs').unlinkSync(zipPath);
                }
                if (require('fs').existsSync(extractDir)) {
                    this.cleanupDirectory(extractDir);
                }
            } catch (cleanupError: any) {
                // Ignore cleanup errors
            }
            throw error;
        }
    }

    /**
     * Process GitHub URL
     * @param repoUrl - GitHub repository URL
     * @param ref - Git reference (commit SHA, branch, tag)
     * @returns Normalized components
     */
    async fromGithubUrl(repoUrl: string, ref: string = 'HEAD'): Promise<InputAdapterResult> {
        const repoPath = join(this.tempDir, generateUUID());

        try {
            // Parse repo URL
            const repoMatch = repoUrl.match(/github\.com[:/]([^/]+)\/([^\.]+)(?:\.git)?/);
            if (!repoMatch) {
                throw { code: 'invalid_input', message: 'Invalid GitHub URL format' };
            }

            const owner = repoMatch[1];
            const repo = repoMatch[2];
            const cloneUrl = `https://github.com/${owner}/${repo}.git`;

            // Clone with --depth=1 for single commit
            await execAsync(`git clone --depth=1 --branch "${ref}" "${cloneUrl}" "${repoPath}"`);

            // Run Syft to generate SBOM
            const sbomPath = join(this.tempDir, `${generateUUID()}-sbom.json`);
            await execAsync(`syft "${repoPath}" -o json > "${sbomPath}"`);

            // Read and parse SBOM
            const sbomRaw = JSON.parse(readFileSync(sbomPath, 'utf8'));

            // Normalize components
            const components = this.normalizeComponents(sbomRaw);

            // Clean up local copy immediately
            this.cleanupDirectory(repoPath);

            // Upload SBOM to S3
            const sbomS3Key = `sboms/${generateUUID()}.json`;
            await uploadFile(BUCKET_SBOMS, sbomS3Key, JSON.stringify(sbomRaw), 'application/json');

            return {
                components,
                sbomRaw,
                sbomS3Key
            };
        } catch (error: any) {
            // Clean up on error
            try {
                if (require('fs').existsSync(repoPath)) {
                    this.cleanupDirectory(repoPath);
                }
            } catch (cleanupError: any) {
                // Ignore cleanup errors
            }
            throw error;
        }
    }

    /**
     * Process CycloneDX SBOM document
     * @param document - CycloneDX document
     * @returns Normalized components
     */
    async fromCycloneDX(document: any): Promise<InputAdapterResult> {
        // Validate SBOM
        const validation = this.validateCycloneDX(document);

        if (!validation.valid) {
            throw {
                code: 'invalid_sbom',
                message: 'SBOM validation failed',
                validation_errors: validation.errors
            };
        }

        // Normalize components
        const components = this.normalizeComponents(document);

        // Upload raw SBOM to S3
        const sbomS3Key = `sboms/${generateUUID()}.json`;
        await uploadFile(BUCKET_SBOMS, sbomS3Key, JSON.stringify(document), 'application/json');

        return {
            components,
            sbomRaw: document,
            sbomS3Key
        };
    }

    /**
     * Validate CycloneDX document against schema
     * @param document - CycloneDX document
     * @returns Validation result
     */
    validateCycloneDX(document: any): CycloneDXValidationResult {
        const errors: string[] = [];

        // Check required fields
        if (!document.specVersion) {
            errors.push('Missing specVersion');
        }

        if (!document.components || !Array.isArray(document.components)) {
            errors.push('Missing or invalid components array');
        } else {
            // Validate each component
            for (let i = 0; i < document.components.length; i++) {
                const component = document.components[i];
                if (!component.name) {
                    errors.push(`Component ${i}: missing name`);
                }
                if (!component.version) {
                    errors.push(`Component ${i}: missing version`);
                }
            }
        }

        // Determine spec version
        const specVersion = document.specVersion || 'unknown';

        return {
            valid: errors.length === 0,
            errors,
            specVersion
        };
    }

    /**
     * Normalize components from SBOM
     * @param rawSbom - Raw SBOM data
     * @returns Normalized components
     */
    normalizeComponents(rawSbom: any): Component[] {
        const components: Component[] = [];

        // Handle CycloneDX format
        if (rawSbom.components && Array.isArray(rawSbom.components)) {
            for (const comp of rawSbom.components) {
                const normalized = this.normalizeComponent(comp);
                if (normalized) {
                    components.push(normalized);
                }
            }
        }

        // Deduplicate by purl
        return this.deduplicateByPurl(components);
    }

    /**
     * Normalize a single component
     * @param component - Raw component
     * @returns Normalized component or null
     */
    private normalizeComponent(component: any): Component | null {
        // Skip components without version
        if (!component.version) {
            return null;
        }

        // Determine ecosystem from type
        const ecosystem = this.determineEcosystem(component);

        // Generate purl
        const purl = this.generatePurl(component, ecosystem);

        return {
            name: component.name,
            version: component.version,
            purl,
            type: this.determineComponentType(component),
            ecosystem
        };
    }

    /**
     * Determine ecosystem from component
     */
    private determineEcosystem(component: any): string | undefined {
        const type = component.type?.toLowerCase() || '';
        const name = component.name?.toLowerCase() || '';

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
     * Generate purl for component
     */
    private generatePurl(component: any, ecosystem?: string): string {
        const name = component.name || '';
        const version = component.version || '';

        if (ecosystem === 'npm') return `pkg:npm/${name}@${version}`;
        if (ecosystem === 'pypi') return `pkg:pypi/${name}@${version}`;
        if (ecosystem === 'maven') return `pkg:maven/${name}@${version}`;
        if (ecosystem === 'cargo') return `pkg:cargo/${name}@${version}`;
        if (ecosystem === 'gem') return `pkg:gem/${name}@${version}`;
        if (ecosystem === 'nuget') return `pkg:nuget/${name}@${version}`;
        if (ecosystem === 'go') return `pkg:golang/${name}@${version}`;

        return `pkg:generic/${name}@${version}`;
    }

    /**
     * Determine component type
     */
    private determineComponentType(component: any): Component['type'] {
        const type = component.type?.toLowerCase() || 'library';
        const name = component.name?.toLowerCase() || '';

        if (type === 'library' || type === 'framework') return 'library';
        if (type === 'application' || type === 'app') return 'application';
        if (type === 'os') return 'os';
        if (type === 'container') return 'container';
        if (type === 'device') return 'device';
        if (type === 'firmware') return 'firmware';
        if (type === 'file') return 'file';

        // Try to infer from name
        if (name.includes('kernel')) return 'os';
        if (name.includes('container')) return 'container';

        return 'library';
    }

    /**
     * Deduplicate components by purl
     */
    private deduplicateByPurl(components: Component[]): Component[] {
        const seen = new Set<string>();
        return components.filter(comp => {
            if (seen.has(comp.purl)) return false;
            seen.add(comp.purl);
            return true;
        });
    }

    /**
     * Recursively delete directory
     */
    private cleanupDirectory(dir: string): void {
        if (!require('fs').existsSync(dir)) return;

        const entries = require('fs').readdirSync(dir);

        for (const entry of entries) {
            const path = join(dir, entry);
            const stats = require('fs').statSync(path);

            if (stats.isDirectory()) {
                this.cleanupDirectory(path);
            } else {
                require('fs').unlinkSync(path);
            }
        }

        require('fs').rmdirSync(dir);
    }
}

export const inputAdapterService = new InputAdapterService();

export default inputAdapterService;
