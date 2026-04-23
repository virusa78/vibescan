import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';
import {
  generateOpenApiSpec,
  getOpenApiFallbackApis,
  getOpenApiPrimaryApis,
} from '../../wasp-app/src/server/swagger/openapiSpec';
import {
  normalizeWaspRoutePath,
  parseV1RoutesFromMainWasp,
  validateV1OpenApiContract,
} from '../../wasp-app/src/server/swagger/openapiContractPolicy';

describe('openapi v1 contract policy', () => {
  it('uses absolute manifest files for primary scan inputs', () => {
    const primaryApis = getOpenApiPrimaryApis();

    expect(primaryApis.length).toBeGreaterThan(0);
    for (const apiPath of primaryApis) {
      expect(path.isAbsolute(apiPath)).toBe(true);
      expect(apiPath.endsWith('swagger-docs.ts')).toBe(true);
    }
  });

  it('defines absolute glob paths for fallback scan inputs', () => {
    const fallbackApis = getOpenApiFallbackApis();

    expect(fallbackApis.length).toBeGreaterThan(0);
    for (const apiPath of fallbackApis) {
      expect(path.isAbsolute(apiPath)).toBe(true);
    }
  });

  it('falls back when primary scan returns empty v1 paths', async () => {
    const calls: string[][] = [];
    const generator = jest.fn((options: { apis: string[]; definition: Record<string, any> }) => {
      calls.push(options.apis);

      if (calls.length === 1) {
        return { ...options.definition, paths: {} };
      }

      return {
        ...options.definition,
        paths: {
          '/api/v1/scans': {
            get: {
              operationId: 'listScans',
              security: [{ bearerAuth: [] }],
              responses: { 200: { description: 'ok' } },
            },
          },
        },
      };
    });

    const spec = await generateOpenApiSpec({ generator });

    expect(generator).toHaveBeenCalledTimes(2);
    expect((spec as any).__generationSource).toBe('absolute-fallback-glob');
    expect(spec.paths?.['/api/v1/scans']?.get).toBeDefined();
  });

  it('fails fast with diagnostics when both scans are empty', async () => {
    const generator = jest.fn((options: { definition: Record<string, any> }) => ({
      ...options.definition,
      paths: {},
    }));

    await expect(generateOpenApiSpec({ generator })).rejects.toThrow(
      'OpenAPI generation failed: /api/v1 paths are empty after primary and fallback scan.',
    );

    expect(generator).toHaveBeenCalledTimes(2);
  });

  it('normalizes wasp path params to OpenAPI format', () => {
    expect(normalizeWaspRoutePath('/api/v1/scans/:scanId')).toBe('/api/v1/scans/{scanId}');
  });

  it('matches main.wasp /api/v1 routes against generated OpenAPI contract', async () => {
    const mainWaspSource = fs.readFileSync(path.resolve(process.cwd(), 'wasp-app/main.wasp'), 'utf8');
    const routes = parseV1RoutesFromMainWasp(mainWaspSource);

    expect(routes.length).toBeGreaterThan(0);

    const spec = await generateOpenApiSpec();
    const report = validateV1OpenApiContract({ mainWaspSource, spec });

    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.routeCountMainWasp).toBe(report.routeCountSpec);
  });
});
