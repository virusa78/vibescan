/**
 * Codescoring/BlackDuck API Client - Handles enterprise vulnerability scanning
 * Supports both real API and mock mode for MVP testing
 */

import type { NormalizedComponent } from '../../services/inputAdapterService.js';

export interface CodescoringFinding {
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvssScore: number;
  source: 'enterprise';
}

interface ApiRetryConfig {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: ApiRetryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Codescoring API client
 */
class CodescoringApiClient {
  private apiKey: string;
  private apiUrl: string;
  private requestTimeoutMs: number = 30000;

  constructor(apiKey: string, apiUrl: string = 'https://api.codescoring.example.com') {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    retryConfig: ApiRetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const url = `${this.apiUrl}${endpoint}`;
        const headers: any = {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        };

        const options: any = {
          method,
          headers,
          timeout: this.requestTimeoutMs,
        };

        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        // Handle rate limiting with backoff
        if (response.status === 429) {
          if (attempt < retryConfig.maxRetries) {
            const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt);
            console.log(`[Codescoring] Rate limited, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Handle server errors with retry
        if (response.status >= 500) {
          if (attempt < retryConfig.maxRetries) {
            const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt);
            console.log(`[Codescoring] Server error (${response.status}), retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Handle auth errors (don't retry)
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication failed (${response.status})`);
        }

        // Handle not found
        if (response.status === 404) {
          throw new Error('Project not found');
        }

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retryConfig.maxRetries) {
          const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt);
          console.log(`[Codescoring] Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('API request failed after all retries');
  }

  /**
   * Create a new project for scanning
   */
  async createProject(projectName: string): Promise<string> {
    console.log(`[Codescoring] Creating project: ${projectName}`);
    const response = await this.makeRequest('POST', '/api/v3/projects', {
      name: projectName,
    });
    return response.id;
  }

  /**
   * Upload SBOM to project
   */
  async uploadSbom(projectId: string, components: NormalizedComponent[]): Promise<void> {
    console.log(`[Codescoring] Uploading SBOM to project ${projectId}`);
    
    const sbomPayload = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      version: 1,
      components: components.map(c => ({
        type: c.type || 'library',
        name: c.name,
        version: c.version,
        purl: c.purl,
      })),
    };

    await this.makeRequest('POST', `/api/v3/projects/${projectId}/sbom`, sbomPayload);
  }

  /**
   * Poll project status until complete
   */
  async pollProjectStatus(projectId: string, maxAttempts: number = 30): Promise<void> {
    console.log(`[Codescoring] Polling project ${projectId} status`);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.makeRequest('GET', `/api/v3/projects/${projectId}/status`);
      
      if (response.status === 'completed' || response.status === 'completed_with_errors') {
        console.log(`[Codescoring] Project scan completed`);
        return;
      }

      if (response.status === 'failed') {
        throw new Error(`Project scan failed: ${response.error || 'Unknown error'}`);
      }

      console.log(`[Codescoring] Status: ${response.status}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before next poll
    }

    throw new Error('Project scan polling timed out');
  }

  /**
   * Get vulnerabilities from completed project
   */
  async getVulnerabilities(projectId: string): Promise<any> {
    console.log(`[Codescoring] Fetching vulnerabilities for project ${projectId}`);
    return this.makeRequest('GET', `/api/v3/projects/${projectId}/vulnerabilities`);
  }

  /**
   * Delete project (cleanup)
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      console.log(`[Codescoring] Deleting project ${projectId}`);
      await this.makeRequest('DELETE', `/api/v3/projects/${projectId}`);
    } catch (error) {
      console.error(`[Codescoring] Failed to delete project:`, error);
      // Don't throw - cleanup errors shouldn't fail the scan
    }
  }
}

/**
 * Generate mock Codescoring findings for MVP testing
 */
function generateMockFindings(components: NormalizedComponent[]): CodescoringFinding[] {
  // Return mock enterprise findings for known vulnerable packages
  const mockVulnerabilities: Record<string, CodescoringFinding[]> = {
    'lodash': [
      {
        cveId: 'CVE-2024-5678',
        severity: 'critical',
        package: 'lodash',
        version: '1.0.0',
        fixedVersion: '1.0.2',
        description: 'Enterprise vulnerability in lodash',
        cvssScore: 9.2,
        source: 'enterprise',
      },
    ],
    'express': [
      {
        cveId: 'CVE-2024-1111',
        severity: 'high',
        package: 'express',
        version: '4.0.0',
        fixedVersion: '4.18.0',
        description: 'Express authentication bypass',
        cvssScore: 8.1,
        source: 'enterprise',
      },
    ],
  };

  const findings: CodescoringFinding[] = [];
  for (const component of components) {
    const vulns = mockVulnerabilities[component.name] || [];
    findings.push(...vulns);
  }

  return findings;
}

/**
 * Parse Codescoring API response into normalized findings
 */
function parseCodescoringResponse(apiResponse: any): CodescoringFinding[] {
  if (!apiResponse || !apiResponse.vulnerabilities || !Array.isArray(apiResponse.vulnerabilities)) {
    return [];
  }

  const findings: CodescoringFinding[] = [];

  for (const vuln of apiResponse.vulnerabilities) {
    const finding: CodescoringFinding = {
      cveId: vuln.cveId || vuln.id || 'UNKNOWN',
      severity: (vuln.severity || 'info').toLowerCase() as any,
      package: vuln.packageName || vuln.component || 'unknown',
      version: vuln.version || 'unknown',
      fixedVersion: vuln.fixedVersion,
      description: vuln.description || '',
      cvssScore: parseFloat(vuln.cvssScore || '0') || 0,
      source: 'enterprise',
    };

    findings.push(finding);
  }

  return findings;
}

/**
 * Main function: Scan components with Codescoring API
 * Falls back to mock if API key not configured
 * @param components Normalized components to scan
 * @param scanId Unique scan ID
 * @param timeoutMs Timeout in milliseconds
 * @returns Array of vulnerabilities found
 */
export async function scanWithCodescoring(
  components: NormalizedComponent[],
  scanId: string,
  timeoutMs: number = 300000
): Promise<CodescoringFinding[]> {
  const apiKey = process.env.CODESCORING_API_KEY;
  const apiUrl = process.env.CODESCORING_API_URL || 'https://api.codescoring.example.com';

  // Use mock mode if API key not configured
  if (!apiKey) {
    console.log('[Codescoring] Using mock Codescoring results (real API not configured)');
    return generateMockFindings(components);
  }

  let projectId: string | null = null;

  try {
    const client = new CodescoringApiClient(apiKey, apiUrl);
    const projectName = `scan-${scanId}-${Date.now()}`;

    // Create project
    projectId = await client.createProject(projectName);
    console.log(`[Codescoring] Created project ${projectId}`);

    // Upload SBOM
    await client.uploadSbom(projectId, components);
    console.log(`[Codescoring] Uploaded SBOM to project ${projectId}`);

    // Poll for completion
    const startTime = Date.now();
    await client.pollProjectStatus(projectId);
    const durationMs = Date.now() - startTime;
    console.log(`[Codescoring] Scan completed in ${durationMs}ms`);

    // Get vulnerabilities
    const apiResponse = await client.getVulnerabilities(projectId);
    const findings = parseCodescoringResponse(apiResponse);
    console.log(`[Codescoring] Found ${findings.length} vulnerabilities`);

    // Cleanup
    await client.deleteProject(projectId);

    return findings;
  } catch (error) {
    console.error('[Codescoring] Scan failed:', error);

    // Attempt cleanup on error
    if (projectId) {
      try {
        const client = new CodescoringApiClient(apiKey, apiUrl);
        await client.deleteProject(projectId);
      } catch (cleanupError) {
        console.error('[Codescoring] Failed to cleanup project:', cleanupError);
      }
    }

    throw error;
  }
}

/**
 * Check if Codescoring API is configured
 */
export function isCodescoringConfigured(): boolean {
  return !!process.env.CODESCORING_API_KEY;
}
