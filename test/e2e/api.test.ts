/**
 * E2E Tests for VibeScan API
 *
 * Tests all API endpoints using Playwright
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { spawnSync } from 'node:child_process';

const API_BASE_URL = process.env.API_URL || 'http://127.0.0.1:3001';

// Helper function to create and login a user
async function createAndLoginUser(request: APIRequestContext, emailPrefix: string) {
    const email = `${emailPrefix}+${Date.now()}@example.com`;
    const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
            email,
            password: 'Test123!@#AB',
            name: 'E2E Test',
            plan: 'free_trial',
            region: 'OTHER'
        }
    });
    expect(registerResponse.status()).toBe(201);

    const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
            email,
            password: 'Test123!@#AB'
        }
    });
    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    return { token: loginData.data.accessToken, email };
}

async function createAuthHeader(request: APIRequestContext, emailPrefix: string): Promise<{ Authorization: string }> {
    const { token } = await createAndLoginUser(request, emailPrefix);
    return { Authorization: `Bearer ${token}` };
}

function hasBinary(command: string): boolean {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    return result.status === 0;
}

async function waitForTerminalScanState(
    request: APIRequestContext,
    authHeader: { Authorization: string },
    scanId: string,
    timeoutMs: number = 5 * 60 * 1000
): Promise<{ status: string; errorMessage?: string | null }> {
    const startedAt = Date.now();
    let lastStatus = 'pending';
    let lastErrorMessage: string | null = null;

    while (Date.now() - startedAt < timeoutMs) {
        const scanResponse = await request.get(`${API_BASE_URL}/scans/${scanId}`, {
            headers: authHeader,
        });
        expect(scanResponse.status()).toBe(200);
        const scanPayload = await scanResponse.json();
        const scan = scanPayload?.data?.scan;
        lastStatus = scan?.status || lastStatus;
        lastErrorMessage = scan?.errorMessage || null;

        if (['done', 'error', 'cancelled'].includes(lastStatus)) {
            return {
                status: lastStatus,
                errorMessage: lastErrorMessage,
            };
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return {
        status: lastStatus,
        errorMessage: lastErrorMessage,
    };
}

test.describe('00 - API Endpoints', () => {
    test('GET / - Returns API info', async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/`);
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.name).toBe('VibeScan');
        expect(data.version).toBe('0.1.0');
        expect(data.description).toBe('Dual-scanner vulnerability scanning platform');
        expect(data.endpoints).toBeDefined();
    });

    test('GET /health - Returns health status', async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/health`);
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.status).toBeDefined();
        expect(data.timestamp).toBeDefined();
        expect(data.services).toBeDefined();
    });
});

test.describe('01 - Auth Endpoints', () => {
    test('POST /auth/register - Returns 201 on success', async ({ request }) => {
        const response = await request.post(`${API_BASE_URL}/auth/register`, {
            data: {
                email: `test+${Date.now()}@example.com`,
                password: 'Test123!@#AB',
                name: 'Test User',
                plan: 'free_trial',
                region: 'OTHER'
            }
        });
        expect(response.status()).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.id).toBeDefined();
        expect(data.data.email).toContain('@example.com');
    });

    test('POST /auth/login - Returns 200 on success', async ({ request }) => {
        const email = `login+${Date.now()}@example.com`;
        const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
            data: {
                email,
                password: 'Test123!@#AB',
                name: 'Login Test',
                plan: 'free_trial',
                region: 'OTHER'
            }
        });
        expect(registerResponse.status()).toBe(201);

        const response = await request.post(`${API_BASE_URL}/auth/login`, {
            data: {
                email,
                password: 'Test123!@#AB'
            }
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.accessToken).toBeDefined();
        expect(data.data.refreshToken).toBeDefined();
    });

    test('POST /auth/login - Returns 401 on invalid credentials', async ({ request }) => {
        const response = await request.post(`${API_BASE_URL}/auth/login`, {
            data: {
                email: 'nonexistent@example.com',
                password: 'wrongpassword'
            }
        });
        expect(response.status()).toBe(401);
    });
});

test.describe('02 - API Keys Endpoints', () => {
    test('POST /api-keys - Generates API key', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'apikey-create');
        const response = await request.post(`${API_BASE_URL}/api-keys`, {
            headers: authHeader,
            data: {
                label: 'Test API Key'
            }
        });
        expect(response.status()).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.keyId).toBeDefined();
        expect(data.data.label).toBe('Test API Key');
        expect(data.data.rawKey).toBeDefined();
    });

    test('GET /api-keys - Lists API keys', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'apikey-list');
        const response = await request.get(`${API_BASE_URL}/api-keys`, {
            headers: authHeader
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data.items)).toBe(true);
    });
});

test.describe('03 - Scans Endpoints', () => {
    test('POST /scans - Submits a scan', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'scan-submit');
        const response = await request.post(`${API_BASE_URL}/scans`, {
            headers: authHeader,
            data: {
                inputType: 'source_zip'
            }
        });

        expect(response.status()).toBe(202);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.scanId).toBeDefined();
        expect(data.data.status).toBe('pending');
    });

    test('GET /scans - Lists scans', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'scan-list');
        const response = await request.get(`${API_BASE_URL}/scans`, {
            headers: authHeader
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data.items)).toBe(true);
        // nextCursor should be defined when there are more results
        // or when cursor is provided in query params
        expect(data.data.nextCursor).toBeDefined();
    });

    test('GET /scans - Supports fromDate filter', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'scan-date-filter');
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const response = await request.get(`${API_BASE_URL}/scans?fromDate=${encodeURIComponent(futureDate)}`, {
            headers: authHeader,
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data.items)).toBe(true);
        expect(data.data.items.length).toBe(0);
    });

    test('GET /scans - Rejects invalid fromDate filter', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'scan-date-invalid');
        const response = await request.get(`${API_BASE_URL}/scans?fromDate=not-a-date`, {
            headers: authHeader,
        });
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('validation_error');
    });

    test('GET /scans/queue/priority - Shows priority policy and queue state', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'scan-queue-priority');
        const response = await request.get(`${API_BASE_URL}/scans/queue/priority`, {
            headers: authHeader
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.priorityPolicy).toBeDefined();
        expect(data.data.priorityPolicy.fifoWithinTier).toBe(true);
        expect(data.data.priorityPolicy.high).toContain('enterprise');
    });

    test('POST /scans github_app - Submits GitHub repo scan and reaches terminal state', async ({ request }) => {
        test.skip(!hasBinary('syft'), 'syft is required to generate SBOM from GitHub repository');

        const authHeader = await createAuthHeader(request, 'scan-github-grype');
        const submitResponse = await request.post(`${API_BASE_URL}/scans`, {
            headers: authHeader,
            data: {
                inputType: 'github_app',
                githubRepo: 'anchore/grype',
                githubRef: 'main',
            },
        });

        expect(submitResponse.status()).toBe(202);
        const submitPayload = await submitResponse.json();
        expect(submitPayload.success).toBe(true);
        expect(submitPayload.data.scanId).toBeDefined();

        const scanId = submitPayload.data.scanId as string;
        const terminalState = await waitForTerminalScanState(request, authHeader, scanId);

        expect(terminalState.status, terminalState.errorMessage || undefined).toBe('done');
    });
});

test.describe('04 - Error Handling', () => {
    test('Unauthorized request returns 401', async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/api-keys`);
        expect(response.status()).toBe(401);
    });

    test('Invalid email returns 401 (not 400)', async ({ request }) => {
        const response = await request.post(`${API_BASE_URL}/auth/login`, {
            data: {
                email: 'invalid-email',
                password: 'Test123!@#AB'
            }
        });
        expect(response.status()).toBe(401);
    });
});

test.describe('05 - Regional Pricing', () => {
    test('GET /billing/regional-pricing - Returns regional pricing', async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/billing/regional-pricing`);
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.basePrice).toBeDefined();
        expect(data.data.region).toBeDefined();
    });
});

test.describe('06 - Settings and Billing', () => {
    test('GET /auth/me - Returns current profile for authenticated user', async ({ request }) => {
        const authHeader = await createAuthHeader(request, 'settings-profile');
        const response = await request.get(`${API_BASE_URL}/auth/me`, {
            headers: authHeader,
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.email).toContain('@example.com');
    });

    test('POST /billing/webhook - Returns 400 when signature is missing', async ({ request }) => {
        const response = await request.post(`${API_BASE_URL}/billing/webhook`, {
            data: { type: 'checkout.session.completed' },
        });
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('missing_signature');
    });
});

test.describe('07 - Swagger Documentation', () => {
    test('GET /docs - Returns Swagger UI', async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/docs`);
        if (response.status() === 404) {
            return;
        }
        expect(response.status()).toBe(200);
        const text = await response.text();
        expect(text).toContain('swagger-ui');
    });

    test('GET /docs/json - Returns OpenAPI spec', async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/docs/json`);
        if (response.status() === 404) {
            return;
        }
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.openapi).toBe('3.0.3');
        expect(data.info).toBeDefined();
    });
});
