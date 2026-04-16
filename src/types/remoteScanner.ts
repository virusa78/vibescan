export type RemoteScannerScenario = 'github_app' | 'source_zip' | 'sbom_upload';

export type RemoteScannerEngine = 'free' | 'grype_like';

export type RemoteScannerProviderId = string;

export interface RemoteScannerBaseRequest {
    scenario: RemoteScannerScenario;
    inputRef: string;
}

export interface GithubAppScenarioRequest extends RemoteScannerBaseRequest {
    scenario: 'github_app';
    github: {
        repo: string;
        ref: string;
    };
}

export interface SourceZipScenarioRequest extends RemoteScannerBaseRequest {
    scenario: 'source_zip';
    sourceZip: {
        s3Key: string;
    };
}

export interface SbomUploadScenarioRequest extends RemoteScannerBaseRequest {
    scenario: 'sbom_upload';
    sbom: {
        raw?: any;
        s3Key?: string;
    };
}

export type NormalizedScenarioRequest =
    | GithubAppScenarioRequest
    | SourceZipScenarioRequest
    | SbomUploadScenarioRequest;

export type ScenarioInput =
    | {
        scenario: 'github_app';
        repo: string;
        ref?: string;
        inputRef?: string;
    }
    | {
        scenario: 'source_zip';
        s3Key: string;
        inputRef?: string;
    }
    | {
        scenario: 'sbom_upload';
        sbomRaw?: any;
        sbomS3Key?: string;
        inputRef?: string;
    };

export interface ProviderSelection {
    engine: RemoteScannerEngine;
    provider: RemoteScannerProviderId;
}

export interface ProviderRequestPayload {
    provider: RemoteScannerProviderId;
    engine: RemoteScannerEngine;
    inputRef: string;
    target: {
        type: 'github_repo' | 'source_zip' | 'sbom';
        repo?: string;
        ref?: string;
        s3Key?: string;
        sbomRaw?: any;
    };
}

export interface RemoteScannerProvider {
    id: RemoteScannerProviderId;
    execute(payload: ProviderRequestPayload): Promise<any>;
}

export interface NormalizedScannerVulnerability {
    cve_id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    cvss_score: number;
    package_name: string;
    package_ecosystem: 'npm' | 'pypi' | 'maven' | 'cargo' | 'gem' | 'nuget' | 'go' | 'other';
    installed_version: string;
    fixed_version: string | null;
    purl: string;
    epss_score: number | null;
    is_exploitable: boolean;
    description: string;
    references: string[];
    source: 'free' | 'enterprise';
}

export interface NormalizedProviderResult {
    scanId: string;
    source: 'free' | 'enterprise';
    rawOutput: any;
    vulnerabilities: NormalizedScannerVulnerability[];
    scannerVersion: string;
    cveDbTimestamp: string;
    durationMs: number;
}
