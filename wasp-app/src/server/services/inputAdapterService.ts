/**
 * Input Adapter Service - component extraction and SBOM helpers.
 * The live path uses GitHub repo cloning + Syft fallback parsing.
 * SBOM/ZIP helpers stay available for project-level scan coverage.
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { join, basename, resolve, isAbsolute, sep } from 'path';
import { HttpError } from 'wasp/server';
import {
  fromCycloneDX,
  validateCycloneDX,
} from '../../ingestion/cyclonedx-contracts.js';
import { execSync } from 'child_process';

/**
 * Normalized component format - consistent across all input sources
 */
export interface NormalizedComponent {
  name: string;
  version: string;
  purl?: string;
  type?: string;
}

const runtimeTempRoot = process.env.VIBESCAN_RUNTIME_TMP_DIR
  ?? join(process.cwd(), 'test-results', 'runtime-temp');
const defaultTrustedScanInputRoot = join(runtimeTempRoot, 'scan-inputs');

function ensureRuntimeTempRoot() {
  mkdirSync(runtimeTempRoot, { recursive: true });
  return runtimeTempRoot;
}

function ensureTrustedScanInputRoot() {
  const root = process.env.VIBESCAN_SCAN_INPUT_DIR ?? defaultTrustedScanInputRoot;
  mkdirSync(root, { recursive: true });
  return root;
}

export function isJohnnyInstalled(): boolean {
  try {
    execSync('johnny --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function isSyftInstalled(): boolean {
  try {
    execSync('syft --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function resolveTrustedScanInputPath(inputRef: string): string {
  const trimmed = inputRef.trim();
  if (!trimmed) {
    throw new HttpError(422, 'invalid_input_reference', {
      detail: 'Input reference cannot be empty',
    });
  }

  const root = resolve(ensureTrustedScanInputRoot());
  const candidate = isAbsolute(trimmed) ? resolve(trimmed) : resolve(root, trimmed);
  const safeRoot = root.endsWith(sep) ? root : `${root}${sep}`;

  if (candidate !== root && !candidate.startsWith(safeRoot)) {
    throw new HttpError(422, 'unsafe_input_reference', {
      detail: 'SBOM and ZIP inputs must live under the trusted scan input root',
    });
  }

  if (!existsSync(candidate)) {
    throw new HttpError(422, 'input_not_found', {
      detail: `Input file does not exist: ${trimmed}`,
    });
  }

  return candidate;
}

export function buildCycloneDxSbom(components: NormalizedComponent[]) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    version: 1,
    components: components.map((component) => ({
      type: component.type || 'library',
      name: component.name,
      version: component.version,
      purl: component.purl,
    })),
  };
}

/**
 * Validate and parse CycloneDX SBOM format
 * Expected: { components: [...] }
 */
export function validateAndExtractSBOM(rawText: string): {
  components: NormalizedComponent[];
  totalComponents: number;
} {
  const validation = validateCycloneDX(rawText);
  if (!validation.valid) {
    throw new HttpError(422, 'invalid_sbom', {
      validation_errors: validation.errors,
    });
  }

  const ingestion = fromCycloneDX(rawText, {
    scannerId: 'sbom',
    stage: 'validation',
    source: 'sbom',
    ingestedAt: new Date(),
  });

  if (ingestion.status !== 'ingested') {
    throw new HttpError(422, 'invalid_sbom', {
      validation_errors: [
        ingestion.error.message,
        ...(Array.isArray(ingestion.error.details?.errors) ? (ingestion.error.details?.errors as string[]) : []),
      ],
    });
  }

  const normalized: NormalizedComponent[] = ingestion.payload.components.map((component) => ({
    name: component.name,
    version: component.version,
    purl: component.purl,
    type: component.type,
  }));

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

function normalizeScanInputType(inputType: string): 'github' | 'sbom' | 'source_zip' {
  switch (inputType) {
    case 'github':
    case 'github_app':
    case 'ci_plugin':
      return 'github';
    case 'sbom':
    case 'sbom_upload':
      return 'sbom';
    case 'source_zip':
      return 'source_zip';
    default:
      throw new HttpError(422, 'unsupported_scan_input', {
        detail: `Unsupported scan input type: ${inputType}`,
      });
  }
}

export async function loadScanArtifacts(inputType: string, inputRef: string): Promise<{
  components: NormalizedComponent[];
  sbomRaw: Record<string, unknown>;
}> {
  switch (normalizeScanInputType(inputType)) {
    case 'github': {
      validateGitHubUrl(inputRef);
      const components = await normalizeComponents(await cloneGitHubAndScanWithSBOMGenerator(inputRef));
      return {
        components,
        sbomRaw: buildCycloneDxSbom(components),
      };
    }
    case 'sbom': {
      const rawText = readFileSync(resolveTrustedScanInputPath(inputRef), 'utf8').trim();
      const sbomResult = validateAndExtractSBOM(rawText);
      const components = await normalizeComponents(sbomResult.components);
      return {
        components,
        sbomRaw: JSON.parse(rawText) as Record<string, unknown>,
      };
    }
    case 'source_zip': {
      const components = await extractZipAndScanWithSBOMGenerator(resolveTrustedScanInputPath(inputRef));
      return {
        components,
        sbomRaw: buildCycloneDxSbom(components),
      };
    }
  }
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
    const version = comp.version?.trim();
    if (!version || version === 'unknown') {
      continue;
    }

    // Prefer purl-based deduplication and fall back to the semantic tuple.
    const key = comp.purl?.trim() || `${comp.name.trim()}@${version}@${comp.type || ''}`;

    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({
        name: comp.name.trim(),
        version,
        purl: comp.purl?.trim(),
        type: comp.type,
      });
    }
  }

  return normalized;
}

function componentFromPackage(name: string, version: string, type = 'library'): NormalizedComponent {
  return {
    name: name.trim(),
    version: version.trim() || 'unknown',
    type,
    purl: `pkg:npm/${name.replace(/^@/, '')}@${version}`,
  };
}

function parsePackageJsonManifest(filePath: string): NormalizedComponent[] {
  let parsed: any;

  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    console.warn(`[InputAdapter] Skipping invalid package.json at ${filePath}`);
    return [];
  }

  const dependencies = {
    ...(parsed.dependencies || {}),
    ...(parsed.devDependencies || {}),
    ...(parsed.optionalDependencies || {}),
  } as Record<string, string>;

  return Object.entries(dependencies).map(([name, version]) =>
    componentFromPackage(name, String(version)),
  );
}

function parseGoModManifest(filePath: string): NormalizedComponent[] {
  const text = readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const components: NormalizedComponent[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*([^\s]+)\s+(v[^\s]+)\s*(\/\/.*)?$/);
    if (match && !match[1].startsWith('module') && !match[1].startsWith('go')) {
      components.push(componentFromPackage(match[1], match[2], 'golang'));
    }
  }

  return components;
}

function parseRequirementsTxt(filePath: string): NormalizedComponent[] {
  const text = readFileSync(filePath, 'utf8');
  const components: NormalizedComponent[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z0-9_.-]+)\s*(==|>=|<=|~=|>|<)\s*([^\s#;]+)$/);
    if (match) {
      components.push(componentFromPackage(match[1], match[3], 'python'));
    }
  }

  return components;
}

function parseCargoLock(filePath: string): NormalizedComponent[] {
  const text = readFileSync(filePath, 'utf8');
  const components: NormalizedComponent[] = [];
  const packageBlocks = text.split('[[package]]');

  for (const block of packageBlocks) {
    const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
    const versionMatch = block.match(/version\s*=\s*"([^"]+)"/);
    if (nameMatch && versionMatch) {
      components.push(componentFromPackage(nameMatch[1], versionMatch[1], 'cargo'));
    }
  }

  return components;
}

function collectRepoComponents(repoPath: string): NormalizedComponent[] {
  const manifests: NormalizedComponent[] = [];
  const stack = [repoPath];
  const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next']);

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      switch (basename(fullPath)) {
        case 'package.json':
          manifests.push(...parsePackageJsonManifest(fullPath));
          break;
        case 'go.mod':
          manifests.push(...parseGoModManifest(fullPath));
          break;
        case 'requirements.txt':
          manifests.push(...parseRequirementsTxt(fullPath));
          break;
        case 'Cargo.lock':
          manifests.push(...parseCargoLock(fullPath));
          break;
      }
    }
  }

  return manifests;
}

/**
 * Extract ZIP file and scan with Syft
 * Returns normalized components array
 * 
 * @param filePath Absolute path to ZIP file
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
 * @returns Normalized components from scan
 */
export async function extractZipAndScanWithSBOMGenerator(
  filePath: string,
  timeoutMs: number = 300000
): Promise<NormalizedComponent[]> {
  if (!existsSync(filePath)) {
    throw new HttpError(
      422,
      'ZIP file not found',
      { detail: `ZIP file does not exist: ${filePath}` }
    );
  }

  const tempRoot = mkdtempSync(join(ensureRuntimeTempRoot(), 'vibescan-zip-'));
  const extractDir = join(tempRoot, 'extract');
  mkdirSync(extractDir, { recursive: true });

  try {
    try {
      execFileSync(
        'python3',
        [
          '-c',
          [
            'import os, sys, zipfile',
            'zip_path = sys.argv[1]',
            'target_dir = os.path.abspath(sys.argv[2])',
            'with zipfile.ZipFile(zip_path) as archive:',
            '    for member in archive.infolist():',
            '        member_path = member.filename',
            '        if member_path.startswith("/") or member_path.startswith("\\\\"):',
            '            raise ValueError(f"Unsafe ZIP entry: {member_path}")',
            '        destination = os.path.abspath(os.path.join(target_dir, member_path))',
            '        if destination != target_dir and not destination.startswith(target_dir + os.sep):',
            '            raise ValueError(f"Unsafe ZIP entry: {member_path}")',
            '        if member.is_dir():',
            '            os.makedirs(destination, exist_ok=True)',
            '            continue',
            '        os.makedirs(os.path.dirname(destination), exist_ok=True)',
            '        with archive.open(member, "r") as source, open(destination, "wb") as target:',
            '            target.write(source.read())',
          ].join('\n'),
          filePath,
          extractDir,
        ],
        { timeout: timeoutMs, stdio: 'pipe' },
      );
    } catch (error) {
      throw new HttpError(
        422,
        'ZIP extraction failed',
        { detail: `Unable to extract ${filePath}: ${error instanceof Error ? error.message : String(error)}` },
      );
    }

    // Try Johnny first if installed (as requested by user integration snippet), then Syft
    if (isJohnnyInstalled()) {
      try {
        console.log(`[InputAdapter] Using Johnny to scan ZIP: ${filePath}`);
        const johnnyOutput = execFileSync(
          'johnny',
          ['--input', extractDir, '--output-format', 'cyclonedx-json'],
          { timeout: timeoutMs, encoding: 'utf8' },
        );
        return parseCycloneDXOutput(johnnyOutput);
      } catch (error) {
        console.warn(`[InputAdapter] Johnny scan failed for ZIP ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }

    if (isSyftInstalled()) {
      try {
        const syftOutput = execFileSync(
          'syft',
          [`dir:${extractDir}`, '-o', 'cyclonedx-json'],
          { timeout: timeoutMs, encoding: 'utf8' },
        );
        return parseCycloneDXOutput(syftOutput);
      } catch (error) {
        console.warn(`[InputAdapter] syft scan failed for ZIP ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.warn(`[InputAdapter] No SBOM generators (Johnny/Syft) available or successful for ZIP ${filePath}, falling back to manifest parsing`);
    return normalizeComponents(collectRepoComponents(extractDir));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

/**
 * Helper to parse CycloneDX output from Johnny or Syft
 */
async function parseCycloneDXOutput(jsonOutput: string): Promise<NormalizedComponent[]> {
  const parsed = JSON.parse(jsonOutput);
  const components = Array.isArray(parsed?.components)
    ? parsed.components
        .map((component: any) => {
          if (!component?.name) return null;
          return {
            name: String(component.name),
            version: String(component.version || 'unknown'),
            purl: component.purl || undefined,
            type: component.type || 'library',
          } satisfies NormalizedComponent;
        })
        .filter((component: NormalizedComponent | null): component is NormalizedComponent => component !== null)
    : [];

  return await normalizeComponents(components);
}

/**
 * Clone GitHub repo and scan with best available SBOM generator (Johnny or Syft)
 * Returns normalized components array
 * 
 * @param url GitHub repository URL
 * @param timeoutMs Timeout in milliseconds
 * @returns Normalized components from scan
 */
export async function cloneGitHubAndScanWithSBOMGenerator(
  url: string,
  timeoutMs: number = 330000
): Promise<NormalizedComponent[]> {
  const { owner, repo } = validateGitHubUrl(url);
  const tempRoot = mkdtempSync(join(ensureRuntimeTempRoot(), 'vibescan-github-'));
  const repoPath = join(tempRoot, `${owner}-${repo}`);

  try {
    try {
      execFileSync(
        'git',
        ['clone', '--depth', '1', '--filter=blob:none', '--quiet', url, repoPath],
        { timeout: timeoutMs, stdio: 'pipe' },
      );
    } catch (error) {
      throw new HttpError(
        422,
        'GitHub repository clone failed',
        { detail: `Unable to clone ${url}: ${error instanceof Error ? error.message : String(error)}` },
      );
    }

    // Try Johnny first if installed, then Syft
    if (isJohnnyInstalled()) {
      try {
        console.log(`[InputAdapter] Using Johnny to scan repo: ${url}`);
        const johnnyOutput = execFileSync(
          'johnny',
          ['--input', repoPath, '--output-format', 'cyclonedx-json'],
          { timeout: timeoutMs, encoding: 'utf8' },
        );
        return parseCycloneDXOutput(johnnyOutput);
      } catch (error) {
        console.warn(`[InputAdapter] Johnny scan failed for ${url}:`, error instanceof Error ? error.message : String(error));
      }
    }

    if (isSyftInstalled()) {
      try {
        const syftOutput = execFileSync(
          'syft',
          [`dir:${repoPath}`, '-o', 'cyclonedx-json'],
          { timeout: timeoutMs, encoding: 'utf8' },
        );
        return parseCycloneDXOutput(syftOutput);
      } catch (error) {
        console.warn(`[InputAdapter] syft scan failed for ${url}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.warn(`[InputAdapter] No SBOM generators available or successful for ${url}, falling back to manifest parsing`);
    return normalizeComponents(collectRepoComponents(repoPath));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
