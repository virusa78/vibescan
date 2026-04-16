import { describe, expect, it } from '@jest/globals';
import { InputAdapterService } from '../../src/services/inputAdapterService.js';

describe('InputAdapterService CycloneDX schema validation', () => {
    const service = new InputAdapterService();

    it.each(['1.4', '1.5', '1.6'])('accepts valid CycloneDX %s documents', (specVersion) => {
        const validation = service.validateCycloneDX({
            bomFormat: 'CycloneDX',
            specVersion,
            components: [
                { type: 'library', name: 'lodash', version: '4.17.21' }
            ]
        });

        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
        expect(validation.specVersion).toBe(specVersion);
    });

    it('rejects unsupported CycloneDX versions with a clear field error', () => {
        const validation = service.validateCycloneDX({
            bomFormat: 'CycloneDX',
            specVersion: '1.3',
            components: [{ name: 'lodash', version: '4.17.21' }]
        });

        expect(validation.valid).toBe(false);
        expect(validation.errors[0]).toMatchObject({
            field: '/specVersion'
        });
    });

    it('rejects invalid component shape via JSON Schema validation', () => {
        const validation = service.validateCycloneDX({
            bomFormat: 'CycloneDX',
            specVersion: '1.6',
            components: [{ type: 'library', name: 'lodash' }]
        });

        expect(validation.valid).toBe(false);
        expect(validation.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: '/components/0'
                })
            ])
        );
    });
});
