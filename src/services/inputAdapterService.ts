/**
 * InputAdapterService
 *
 * Adapts various input sources to normalized component format.
 * Handles source ZIP extraction, GitHub cloning, and SBOM validation.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, unlinkSync, mkdirSync, existsSync, createWriteStream, readdirSync, lstatSync, rmdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { pipeline } from 'stream/promises';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import AjvImport, { ErrorObject, ValidateFunction } from 'ajv';
import { uploadFile, BUCKET_SOURCES, BUCKET_SBOMS } from '../s3/client.js';
import { generateUUID } from '../utils/index.js';

const execAsync = promisify(exec);

const DEFAULT_SOURCE_ZIP_MAX_SIZE_BYTES = 50 * 1024 * 1024;
export const SOURCE_ZIP_MAX_SIZE_BYTES = DEFAULT_SOURCE_ZIP_MAX_SIZE_BYTES;
const DEFAULT_SYFT_IMAGE = process.env.SYFT_IMAGE || 'anchore/syft:latest';
const SUPPORTED_CYCLONEDX_VERSIONS = ['1.4', '1.5', '1.6'] as const;
const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const GITHUB_REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;

const cycloneDxBaseSchema = {
    type: 'object',
    required: ['bomFormat', 'specVersion', 'components'],
    properties: {
        bomFormat: { type: 'string', const: 'CycloneDX' },
        specVersion: { type: 'string' },
        components: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'version'],
                properties: {
                    type: { type: 'string' },
                    name: { type: 'string', minLength: 1 },
                    version: { type: 'string', minLength: 1 },
                    purl: { type: 'string' }
                },
                additionalProperties: true
            }
        },
        serialNumber: { type: 'string' },
        metadata: { type: 'object' }
    },
    additionalProperties: true
};

const cycloneDxSchemas = SUPPORTED_CYCLONEDX_VERSIONS.map(version => ({
    $id: `cyclonedx-${version}`,
    ...cycloneDxBaseSchema,
    properties: {
        ...cycloneDxBaseSchema.properties,
        specVersion: { type: 'string', const: version }
    }
}));

const Ajv = (AjvImport as any).default || AjvImport;
const ajv = new Ajv({ allErrors: true, strict: false });
const cycloneDxValidators = new Map<string, ValidateFunction>(
    cycloneDxSchemas.map(schema => [schema.properties.specVersion.const, ajv.compile(schema)])
);

function shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function enforceSourceZipSizeLimit(sizeBytes: number | undefined): void {
    if (!Number.isFinite(sizeBytes)) {
        throw {
            code: 'validation_error',
            message: 'Unable to validate source ZIP size',
            validation_errors: [{ field: 'sourceZipKey', message: 'Missing source ZIP size metadata' }]
        };
    }

    if ((sizeBytes as number) > SOURCE_ZIP_MAX_SIZE_BYTES) {
        throw {
            code: 'payload_too_large',
            message: `Source ZIP exceeds ${SOURCE_ZIP_MAX_SIZE_BYTES / (1024 * 1024)}MB limit`,
            maxSizeBytes: SOURCE_ZIP_MAX_SIZE_BYTES,
            actualSizeBytes: sizeBytes
        };
    }
}

export function buildIsolatedSyftCommand(params: {
    sourcePath: string;
    outputPath: string;
    syftImage?: string;
}): string {
    const sourcePath = params.sourcePath;
    const outputPath = params.outputPath;
    const outputDir = dirname(outputPath);
    const outputFile = basename(outputPath);
    const syftImage = params.syftImage || DEFAULT_SYFT_IMAGE;

    return [
        'docker run --rm',
        '--network=none',
        '--read-only',
        '--user 65534:65534',
        `-v ${shellEscape(sourcePath)}:/workspace/source:ro`,
        `-v ${shellEscape(outputDir)}:/workspace/output:rw`,
        shellEscape(syftImage),
        '/workspace/source',
        '-o',
        `json=/workspace/output/${outputFile}`
    ].join(' ');
}

export function normalizeGithubRepository(repoInput: string): { owner: string; repo: string; cloneUrl: string } {
    const raw = (repoInput || '').trim();
    if (!raw) {
        throw { code: 'invalid_input', message: 'Repository is required' };
    }

    if (/^https?:\/\//i.test(raw) || raw.includes('github.com/')) {
        throw {
            code: 'invalid_input',
            message: 'Repository must use owner/repo format'
        };
    }

    const ownerRepoMatch = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (!ownerRepoMatch) {
        throw {
            code: 'invalid_input',
            message: 'Repository must match owner/repo format'
        };
    }

    const owner = ownerRepoMatch[1];
    const repo = ownerRepoMatch[2];
    if (!GITHUB_OWNER_PATTERN.test(owner) || owner.endsWith('-')) {
        throw {
            code: 'invalid_input',
            message: 'Invalid repository owner. Use GitHub owner format.'
        };
    }

    if (!GITHUB_REPO_PATTERN.test(repo) || repo.endsWith('.')) {
        throw {
            code: 'invalid_input',
            message: 'Invalid repository name. Use GitHub repository format.'
        };
    }

    return { owner, repo, cloneUrl: `https://github.com/${owner}/${repo}.git` };
}

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
    errors: Array<{ field: string; message: string }>;
    specVersion?: string;
}

function formatAjvErrors(errors?: ErrorObject[] | null): Array<{ field: string; message: string }> {
    if (!errors || errors.length === 0) {
        return [];
    }

    return errors.map((error) => ({
        field: error.instancePath || 'document',
        message: error.message || 'Invalid value'
    }));
}

export function validateGithubRef(refInput: string): { valid: boolean; error?: string } {
    const ref = (refInput || '').trim();
    if (!ref) {
        return { valid: false, error: 'Reference is required' };
    }

    if (ref === 'HEAD') {
        return { valid: true };
    }

    if (ref.length > 255) {
        return { valid: false, error: 'Reference must be 255 characters or fewer' };
    }

    if (/^[0-9a-f]{7,40}$/i.test(ref)) {
        return { valid: true };
    }

    if (/\s/.test(ref) || /[\x00-\x1f\x7f]/.test(ref)) {
        return { valid: false, error: 'Reference must not contain whitespace or control characters' };
    }

    if (ref.includes('..') || ref.includes('@{') || ref.includes('//')) {
        return { valid: false, error: 'Reference contains invalid git ref sequences' };
    }

    if (/[~^:?*[\]\\]/.test(ref)) {
        return { valid: false, error: 'Reference contains invalid git ref characters' };
    }

    if (ref.startsWith('/') || ref.endsWith('/') || ref.endsWith('.') || ref.endsWith('.lock')) {
        return { valid: false, error: 'Reference has an invalid prefix or suffix' };
    }

    if (ref.startsWith('.')) {
        return { valid: false, error: 'Reference must not start with a dot' };
    }

    return { valid: true };
}

/**
 * InputAdapterService
 */
export class InputAdapterService {
    private s3Client: any;
    private tempDir: string;
    private readonly syftImage: string;
    private readonly commandRunner: (command: string) => Promise<{ stdout: string; stderr: string }>;

    constructor(deps: {
        s3Client?: any;
        tempDir?: string;
        syftImage?: string;
        commandRunner?: (command: string) => Promise<{ stdout: string; stderr: string }>;
    } = {}) {
        this.s3Client = deps.s3Client || new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
        this.tempDir = deps.tempDir || process.env.VIBESCAN_INPUT_ADAPTER_TMP_DIR || join(process.cwd(), '.runtime', 'source-processing');
        this.syftImage = deps.syftImage || DEFAULT_SYFT_IMAGE;
        this.commandRunner = deps.commandRunner || execAsync;
        if (!existsSync(this.tempDir)) {
            mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Process source ZIP file
     * @param s3Key - S3 key of the ZIP file
     * @returns Normalized components
     */
    async fromSourceZip(s3Key: string): Promise<InputAdapterResult> {
        const workspaceDir = join(this.tempDir, generateUUID());
        const zipPath = join(workspaceDir, 'source.zip');
        const sbomDir = join(workspaceDir, 'output');
        const sbomPath = join(sbomDir, 'sbom.json');
        let processingError: any = null;

        mkdirSync(sbomDir, { recursive: true });

        try {
            const metadata = await this.s3Client.send(new HeadObjectCommand({
                Bucket: BUCKET_SOURCES,
                Key: s3Key
            }));
            enforceSourceZipSizeLimit(metadata.ContentLength);

            const data = await this.s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_SOURCES,
                Key: s3Key
            }));

            const stream = createWriteStream(zipPath);
            await pipeline(data.Body as any, stream);

            await this.generateSbomInIsolatedContainer(zipPath, sbomPath);

            const sbomRaw = JSON.parse(readFileSync(sbomPath, 'utf8'));
            const components = this.normalizeComponents(sbomRaw);

            const sbomS3Key = `sboms/${generateUUID()}.json`;
            await uploadFile(BUCKET_SBOMS, sbomS3Key, JSON.stringify(sbomRaw), 'application/json');

            return {
                components,
                sbomRaw,
                sbomS3Key
            };
        } catch (error: any) {
            processingError = error;
            throw error;
        } finally {
            this.cleanupWorkspace(workspaceDir, processingError);
        }
    }

    /**
     * Process GitHub URL
     * @param repoUrl - GitHub repository URL
     * @param ref - Git reference (commit SHA, branch, tag)
     * @returns Normalized components
     */
    async fromGithubUrl(repoUrl: string, ref: string = 'HEAD'): Promise<InputAdapterResult> {
        const workspaceDir = join(this.tempDir, generateUUID());
        const repoPath = join(workspaceDir, 'repo');
        const sbomDir = join(workspaceDir, 'output');
        const sbomPath = join(sbomDir, 'sbom.json');
        let processingError: any = null;

        mkdirSync(sbomDir, { recursive: true });

        try {
            const { cloneUrl } = normalizeGithubRepository(repoUrl);

            await this.commandRunner(
                `git clone --depth=1 --branch ${shellEscape(ref)} ${shellEscape(cloneUrl)} ${shellEscape(repoPath)}`
            );
            await this.generateSbomInIsolatedContainer(repoPath, sbomPath);

            const sbomRaw = JSON.parse(readFileSync(sbomPath, 'utf8'));
            const components = this.normalizeComponents(sbomRaw);

            const sbomS3Key = `sboms/${generateUUID()}.json`;
            await uploadFile(BUCKET_SBOMS, sbomS3Key, JSON.stringify(sbomRaw), 'application/json');

            return {
                components,
                sbomRaw,
                sbomS3Key
            };
        } catch (error: any) {
            processingError = error;
            throw error;
        } finally {
            this.cleanupWorkspace(workspaceDir, processingError);
        }
    }

    private async generateSbomInIsolatedContainer(sourcePath: string, outputPath: string): Promise<void> {
        const command = buildIsolatedSyftCommand({
            sourcePath,
            outputPath,
            syftImage: this.syftImage
        });

        try {
            await this.commandRunner(command);
        } catch (error: any) {
            throw {
                code: 'runtime_isolation_error',
                message: 'Failed to generate SBOM in isolated container runtime',
                details: error?.message || String(error)
            };
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
        if (!document || typeof document !== 'object') {
            return {
                valid: false,
                errors: [{ field: 'document', message: 'SBOM document must be an object' }],
                specVersion: 'unknown'
            };
        }

        const specVersion = document.specVersion || 'unknown';
        if (!SUPPORTED_CYCLONEDX_VERSIONS.includes(specVersion)) {
            return {
                valid: false,
                errors: [{
                    field: '/specVersion',
                    message: `Unsupported CycloneDX specVersion "${specVersion}". Supported versions: ${SUPPORTED_CYCLONEDX_VERSIONS.join(', ')}`
                }],
                specVersion
            };
        }

        const validator = cycloneDxValidators.get(specVersion);
        if (!validator) {
            return {
                valid: false,
                errors: [{ field: '/specVersion', message: `No validator available for ${specVersion}` }],
                specVersion
            };
        }

        const valid = validator(document);
        const errors = valid ? [] : formatAjvErrors(validator.errors);

        return {
            valid: Boolean(valid),
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
        if (!existsSync(dir)) return;

        const entries = readdirSync(dir);

        for (const entry of entries) {
            const path = join(dir, entry);
            // Use lstat to handle broken symlinks in cloned repositories.
            let stats;
            try {
                stats = lstatSync(path);
            } catch (error: any) {
                if (error?.code === 'ENOENT') {
                    continue;
                }
                throw error;
            }

            if (stats.isDirectory() && !stats.isSymbolicLink()) {
                this.cleanupDirectory(path);
            } else {
                unlinkSync(path);
            }
        }

        rmdirSync(dir);
    }

    private cleanupWorkspace(workspaceDir: string, processingError: any): void {
        if (!existsSync(workspaceDir)) {
            return;
        }

        try {
            this.cleanupDirectory(workspaceDir);
        } catch (cleanupError: any) {
            const cleanupMessage = cleanupError?.message || String(cleanupError);
            if (processingError) {
                throw {
                    ...processingError,
                    cleanup_error: cleanupMessage
                };
            }

            throw {
                code: 'runtime_cleanup_error',
                message: 'Failed to destroy temporary source workspace',
                details: cleanupMessage
            };
        }
    }
}

export const inputAdapterService = new InputAdapterService();

export default inputAdapterService;
