/**
 * Input Adapter Service - Normalizes components from multiple input sources
 * - SBOM Upload (CycloneDX JSON)
 * - Source ZIP (extract + Syft scan)
 * - GitHub URL (clone + Syft scan)
 */

import * as z from 'zod';
import { HttpError } from 'wasp/server';

/**
 * Normalized component format - consistent across all input sources
 */
export interface NormalizedComponent {
  name: string;
  version: string;
  purl?: string;
  type?: string;
}

/**
 * Validate and parse CycloneDX SBOM format
 * Expected: { components: [...] }
 */
export function validateAndExtractSBOM(rawText: string): {
  components: NormalizedComponent[];
  totalComponents: number;
} {
  let sbomData: any;

  try {
    sbomData = JSON.parse(rawText);
  } catch (error) {
    throw new HttpError(
      422,
      'Invalid SBOM format',
      { detail: 'SBOM must be valid JSON' }
    );
  }

  // Validate CycloneDX structure
  if (!sbomData.components || !Array.isArray(sbomData.components)) {
    // Some CycloneDX versions have components in metadata
    const components = sbomData.components || [];
    if (!Array.isArray(components)) {
      throw new HttpError(
        422,
        'Invalid SBOM format',
        { detail: 'SBOM must contain components array' }
      );
    }
  }

  const components = sbomData.components || [];

  // Normalize components
  const normalized: NormalizedComponent[] = components
    .map((comp: any) => {
      if (!comp.name) return null;

      return {
        name: comp.name,
        version: comp.version || 'unknown',
        purl: comp.purl || undefined,
        type: comp.type || undefined,
      };
    })
    .filter((c: NormalizedComponent | null): c is NormalizedComponent => c !== null);

  return {
    components: normalized,
    totalComponents: normalized.length,
  };
}

/**
 * Validate GitHub URL format
 * Supports: https://github.com/owner/repo
 */
export function validateGitHubUrl(url: string): { owner: string; repo: string } {
  const urlPattern = /^https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/;
  const match = url.match(urlPattern);

  if (!match) {
    throw new HttpError(
      422,
      'Invalid GitHub URL',
      { detail: 'Must be in format: https://github.com/owner/repo' }
    );
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

/**
 * Parse Syft JSON output and extract components
 * Syft format: { artifacts: [...], source: {...} }
 */
export function parseSyftOutput(syftJson: string): NormalizedComponent[] {
  let syftData: any;

  try {
    syftData = JSON.parse(syftJson);
  } catch (error) {
    console.error('[InputAdapter] Failed to parse Syft output:', error);
    throw new HttpError(
      500,
      'Syft parsing failed',
      { detail: 'Failed to parse Syft SBOM output' }
    );
  }

  const artifacts = syftData.artifacts || [];

  // Normalize artifacts to components
  const normalized: NormalizedComponent[] = artifacts
    .map((artifact: any) => {
      if (!artifact.name) return null;

      return {
        name: artifact.name,
        version: artifact.version || 'unknown',
        purl: artifact.purl || undefined,
        type: artifact.type || undefined,
      };
    })
    .filter((c: NormalizedComponent | null): c is NormalizedComponent => c !== null);

  return normalized;
}

/**
 * Normalize components from any source into consistent format
 * Validates and deduplicates components
 */
export async function normalizeComponents(
  raw: NormalizedComponent[]
): Promise<NormalizedComponent[]> {
  if (!Array.isArray(raw)) {
    throw new HttpError(
      422,
      'Invalid component format',
      { detail: 'Components must be an array' }
    );
  }

  // Deduplicate by (name, version, purl)
  const seen = new Set<string>();
  const normalized: NormalizedComponent[] = [];

  for (const comp of raw) {
    if (!comp.name) continue;

    // Create dedup key
    const key = `${comp.name}@${comp.version}@${comp.purl || ''}`;

    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({
        name: comp.name.trim(),
        version: (comp.version || 'unknown').trim(),
        purl: comp.purl?.trim(),
        type: comp.type,
      });
    }
  }

  return normalized;
}

/**
 * Extract ZIP file and scan with Syft
 * Returns normalized components array
 * 
 * @param filePath Absolute path to ZIP file
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
 * @returns Normalized components from Syft scan
 */
export async function extractZipAndScanWithSyft(
  filePath: string,
  timeoutMs: number = 300000
): Promise<NormalizedComponent[]> {
  // For MVP, this is a placeholder that will be implemented with Docker
  // For now, throw informative error
  throw new HttpError(
    501,
    'ZIP extraction not yet implemented',
    { detail: 'ZIP scanning with Syft will be available in next phase' }
  );
}

/**
 * Clone GitHub repo and scan with Syft
 * Returns normalized components array
 * 
 * @param url GitHub repository URL
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes for Syft + 30s for clone)
 * @returns Normalized components from Syft scan
 */
export async function cloneGitHubAndScanWithSyft(
  url: string,
  timeoutMs: number = 330000
): Promise<NormalizedComponent[]> {
  // For MVP, this is a placeholder that will be implemented with Docker
  // For now, throw informative error
  throw new HttpError(
    501,
    'GitHub scanning not yet implemented',
    { detail: 'GitHub repository scanning will be available in next phase' }
  );
}
