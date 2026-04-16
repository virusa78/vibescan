import { describe, expect, it } from '@jest/globals';
import {
    SOURCE_ZIP_MAX_SIZE_BYTES,
    buildIsolatedSyftCommand,
    enforceSourceZipSizeLimit
} from '../../src/services/inputAdapterService.js';

describe('InputAdapter runtime hardening', () => {
    it('builds isolated syft command with required runtime controls', () => {
        const command = buildIsolatedSyftCommand({
            sourcePath: '/var/lib/vibescan/workspace/source.zip',
            outputPath: '/var/lib/vibescan/workspace/output/sbom.json',
            syftImage: 'anchore/syft:v1.0.0'
        });

        expect(command).toContain('docker run --rm');
        expect(command).toContain('--network=none');
        expect(command).toContain('--read-only');
        expect(command).toContain('--user 65534:65534');
        expect(command).toContain(':/workspace/source:ro');
        expect(command).toContain(':/workspace/output:rw');
    });

    it('rejects ZIP payloads larger than 50MB', () => {
        expect(() => enforceSourceZipSizeLimit(SOURCE_ZIP_MAX_SIZE_BYTES + 1)).toThrow(
            expect.objectContaining({
                code: 'payload_too_large'
            })
        );
    });

    it('allows ZIP payloads at or below 50MB', () => {
        expect(() => enforceSourceZipSizeLimit(SOURCE_ZIP_MAX_SIZE_BYTES)).not.toThrow();
        expect(() => enforceSourceZipSizeLimit(1024)).not.toThrow();
    });
});
