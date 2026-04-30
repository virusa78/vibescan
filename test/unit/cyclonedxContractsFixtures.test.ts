import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fromCycloneDX,
  type CycloneDxFixtureManifestEntry,
} from '../../wasp-app/src/ingestion/cyclonedx-contracts';

function loadManifest(): CycloneDxFixtureManifestEntry[] {
  const raw = readFileSync(resolve(process.cwd(), 'test/fixtures/cyclonedx/manifest.json'), 'utf8');
  return JSON.parse(raw) as CycloneDxFixtureManifestEntry[];
}

describe('cyclonedx contract fixtures', () => {
  it('validates all fixtures from manifest with expected ingestion status', () => {
    const fixtures = loadManifest();
    expect(fixtures.length).toBeGreaterThan(0);

    for (const fixture of fixtures) {
      const payloadRaw = readFileSync(resolve(process.cwd(), fixture.filePath), 'utf8');
      const payload = JSON.parse(payloadRaw) as Record<string, unknown>;
      const result = fromCycloneDX(payload, {
        scanId: `fixture-${fixture.id}`,
        scannerId: fixture.scannerId,
      });

      expect(result.status).toBe(fixture.expected.status);

      if (fixture.expected.status === 'ingested') {
        expect(result.status).toBe('ingested');
        if (result.status !== 'ingested') continue;

        expect(result.payload._originalDocument.specVersion).toBe(fixture.specVersion);
        if (typeof fixture.expected.componentCount === 'number') {
          expect(result.payload.stats.componentCount).toBe(fixture.expected.componentCount);
        }
        if (typeof fixture.expected.vulnerabilityCount === 'number') {
          expect(result.payload.stats.vulnerabilityCount).toBe(fixture.expected.vulnerabilityCount);
        }
        if (fixture.expected.severityCounts) {
          expect(result.payload.stats.severityCounts).toMatchObject(fixture.expected.severityCounts);
        }
      } else {
        expect(result.status).toBe('rejected');
        if (result.status !== 'rejected') continue;

        if (fixture.expected.errorType) {
          expect(result.error.type).toBe(fixture.expected.errorType);
        }
      }
    }
  });

  it('keeps supplier mapped while preserving unknown catalog candidates', () => {
    const raw = readFileSync(
      resolve(process.cwd(), 'test/fixtures/cyclonedx/enterprise-1.6-unknowns.json'),
      'utf8',
    );
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const result = fromCycloneDX(payload, {
      scanId: 'fixture-mapping-rule',
      scannerId: 'enterprise',
    });

    expect(result.status).toBe('ingested');
    if (result.status !== 'ingested') return;

    const component = result.payload.components[0];
    expect(component.name).toBe('axios');
    expect(component._rawFields?.supplier).toBe('axios-team');

    const unknownPaths = Array.from(result.payload._unknownFields.keys());
    expect(unknownPaths).toContain('$.xScannerMetadata');
    expect(unknownPaths).toContain('$.components[0].xTeamRisk');
    expect(unknownPaths).not.toContain('$.components[0].supplier');
  });

  it('keeps legacy and cutover vulnerability totals consistent on golden fixtures', () => {
    const fixtures = loadManifest().filter((fixture) => fixture.expected.status === 'ingested');

    for (const fixture of fixtures) {
      const raw = readFileSync(resolve(process.cwd(), fixture.filePath), 'utf8');
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const result = fromCycloneDX(payload, {
        scanId: `fixture-regression-${fixture.id}`,
        scannerId: fixture.scannerId,
      });

      expect(result.status).toBe('ingested');
      if (result.status !== 'ingested') continue;

      const cutoverTotal = result.payload.stats.vulnerabilityCount;
      const legacyTotal = fixture.expected.vulnerabilityCount || 0;
      expect(cutoverTotal).toBe(legacyTotal);

      const cutoverSeverity = result.payload.stats.severityCounts;
      expect(cutoverSeverity).toMatchObject(fixture.expected.severityCounts || {});
    }
  });
});
