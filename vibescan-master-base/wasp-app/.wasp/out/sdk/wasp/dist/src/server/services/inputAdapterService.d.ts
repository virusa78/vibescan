/**
 * Input Adapter Service - component extraction and SBOM helpers.
 * The live path uses GitHub repo cloning + Syft fallback parsing.
 * SBOM/ZIP helpers stay available for project-level scan coverage.
 */
import { type PersistedGitHubScanContext } from './githubAppService';
/**
 * Normalized component format - consistent across all input sources
 */
export interface NormalizedComponent {
    name: string;
    version: string;
    purl?: string;
    type?: string;
}
export declare function isJohnnyInstalled(): boolean;
export declare function isSyftInstalled(): boolean;
export declare function resolveTrustedScanInputPath(inputRef: string): string;
export declare function buildCycloneDxSbom(components: NormalizedComponent[]): {
    bomFormat: string;
    specVersion: string;
    version: number;
    components: {
        type: string;
        name: string;
        version: string;
        purl: string | undefined;
    }[];
};
/**
 * Validate and parse CycloneDX SBOM format
 * Expected: { components: [...] }
 */
export declare function validateAndExtractSBOM(rawText: string): {
    components: NormalizedComponent[];
    totalComponents: number;
};
/**
 * Validate GitHub URL format
 * Supports: https://github.com/owner/repo
 */
export declare function validateGitHubUrl(url: string): {
    owner: string;
    repo: string;
};
export declare function loadScanArtifacts(inputType: string, inputRef: string, options?: {
    githubContext?: PersistedGitHubScanContext | null;
}): Promise<{
    components: NormalizedComponent[];
    sbomRaw: Record<string, unknown>;
}>;
/**
 * Parse Syft JSON output and extract components
 * Syft format: { artifacts: [...], source: {...} }
 */
export declare function parseSyftOutput(syftJson: string): NormalizedComponent[];
/**
 * Normalize components from any source into consistent format
 * Validates and deduplicates components
 */
export declare function normalizeComponents(raw: NormalizedComponent[]): Promise<NormalizedComponent[]>;
/**
 * Extract ZIP file and scan with Syft
 * Returns normalized components array
 *
 * @param filePath Absolute path to ZIP file
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
 * @returns Normalized components from scan
 */
export declare function extractZipAndScanWithSBOMGenerator(filePath: string, timeoutMs?: number): Promise<NormalizedComponent[]>;
/**
 * Clone GitHub repo and scan with best available SBOM generator (Johnny or Syft)
 * Returns normalized components array
 *
 * @param url GitHub repository URL
 * @param timeoutMs Timeout in milliseconds
 * @returns Normalized components from scan
 */
export declare function cloneGitHubAndScanWithSBOMGenerator(url: string, timeoutMs?: number, options?: {
    githubContext?: PersistedGitHubScanContext | null;
}): Promise<NormalizedComponent[]>;
//# sourceMappingURL=inputAdapterService.d.ts.map