import config from '../config/index.js';

export type PlatformArea = 'auth' | 'api_keys' | 'billing' | 'settings' | 'core_workflow';

const ALL_PLATFORM_AREAS: PlatformArea[] = [
    'auth',
    'api_keys',
    'billing',
    'settings',
    'core_workflow',
];

const DEFAULT_PLATFORM_AREAS: PlatformArea[] = [
    'auth',
    'api_keys',
    'billing',
    'settings',
];

/**
 * Practical cutover scope for this repo.
 * core_workflow stays backend-owned until a dedicated migration step.
 */
const DELEGATABLE_PLATFORM_AREAS: PlatformArea[] = [
    'auth',
    'api_keys',
    'billing',
    'settings',
];

/**
 * Route groups that can be handed off to OpenSaaS/Wasp over time.
 * This is intentionally a lightweight reference map for migration clarity.
 */
export const PLATFORM_ROUTE_OWNERSHIP: Record<PlatformArea, string[]> = {
    auth: ['/auth/*', '/v1/me', '/v1/me/email/*'],
    api_keys: ['/api-keys/*', '/v1/api-keys/*'],
    billing: ['/billing/*'],
    settings: ['/settings/*', '/v1/settings/*'],
    core_workflow: ['/scans/*', '/reports/*', '/remediation/*'],
};

function isPlatformArea(value: string): value is PlatformArea {
    return ALL_PLATFORM_AREAS.includes(value as PlatformArea);
}

export function isOpenSaasModeEnabled(): boolean {
    return config.OPENSAAS_MODE;
}

export function getPlatformOwnedAreas(): Set<PlatformArea> {
    if (!config.OPENSAAS_MODE) {
        return new Set<PlatformArea>();
    }

    const parsedConfigured = config.OPENSAAS_PLATFORM_OWNED.filter(isPlatformArea);
    const configured = parsedConfigured.filter((area) => DELEGATABLE_PLATFORM_AREAS.includes(area));
    if (parsedConfigured.includes('core_workflow')) {
        console.warn('OPENSAAS_PLATFORM_OWNED includes core_workflow, but core workflow routes remain backend-owned in this cutover.');
    }
    if (configured.length > 0) {
        return new Set<PlatformArea>(configured);
    }

    return new Set<PlatformArea>(DEFAULT_PLATFORM_AREAS);
}

export function isPlatformOwned(area: PlatformArea): boolean {
    return getPlatformOwnedAreas().has(area);
}
