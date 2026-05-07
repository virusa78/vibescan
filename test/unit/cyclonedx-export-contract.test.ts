import { describe, expect, it, jest } from '@jest/globals';
import { validateCycloneDX } from '../../wasp-app/src/ingestion/cyclonedx-contracts';

jest.mock('wasp/server', () => {
  class HttpError extends Error {
    statusCode: number;
    details?: Record<string, unknown>;

    constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
      super(message);
      this.statusCode = statusCode;
      this.details = details;
    }
  }

  return { HttpError };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildCycloneDxSbom: buildInputAdapterCycloneDxSbom } = require('../../wasp-app/src/server/services/inputAdapterService');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateCycloneDxSbom: generateGrypeCycloneDxSbom } = require('../../wasp-app/src/server/lib/scanners/grypeScannerUtil');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildCycloneDxSbom: buildJohnnyCycloneDxSbom } = require('../../wasp-app/src/server/lib/scanners/codescoringJohnnyRuntime');

const components = [
  {
    name: 'axios',
    version: '1.16.0',
    purl: 'pkg:npm/axios@1.16.0',
    type: 'library',
  },
  {
    name: 'left-pad',
    version: '1.3.0',
    purl: 'pkg:npm/left-pad@1.3.0',
    type: 'library',
  },
];

describe('CycloneDX export contract', () => {
  it('validates the shared SBOM builder used by SBOM and ZIP inputs', () => {
    const bom = buildInputAdapterCycloneDxSbom(components);

    expect(bom).toMatchObject({
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      version: 1,
    });
    expect(validateCycloneDX(bom).valid).toBe(true);
  });

  it('validates the Grype SBOM exporter', () => {
    const bomJson = generateGrypeCycloneDxSbom(components);
    const bom = JSON.parse(bomJson) as Record<string, unknown>;

    expect(bom).toMatchObject({
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      version: 1,
    });
    expect(validateCycloneDX(bom).valid).toBe(true);
  });

  it('validates the Johnny SBOM exporter', () => {
    const bom = buildJohnnyCycloneDxSbom(components);

    expect(bom).toMatchObject({
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      version: 1,
    });
    expect(validateCycloneDX(bom).valid).toBe(true);
  });
});
