/**
 * E2E Tests for VibeScan API
 *
 * Tests all API endpoints using Playwright
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Global auth header for authenticated tests
let authHeader: { Authorization: string } | null = null;

// Helper function to create and login a user
async function createAndLoginUser(request: any, emailPrefix: string) {
    const email = `${emailPrefix}+${Date.now()}@example.com`;
    console.log(`Creating user with email: ${email}`);
    const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
            email,
            password: 'Test123!@#',
            name: 'E2E Test',
            plan: 'free_trial',
            region: 'OTHER'
        }
    });
    console.log(`Register status: ${registerResponse.status()}`);
    expect(registerResponse.status()).toBe(201);

    const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
            email,
            password: 'Test123!@#'
        }
    });
    console.log(`Login status: ${loginResponse.status()}`);
    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    console.log(`Login data:`, JSON.stringify(loginData));
    return { token: loginData.data.accessToken, email };
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
                password: 'Test123!@#',
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
                password: 'Test123!@#',
                name: 'Login Test',
                plan: 'free_trial',
                region: 'OTHER'
            }
        });
        expect(registerResponse.status()).toBe(201);

        const response = await request.post(`${API_BASE_URL}/auth/login`, {
            data: {
                email,
                password: 'Test123!@#'
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
    test.describe.configure({ mode: 'serial' });
    test.beforeAll(async ({ request }) => {
        console.log('02 - API Keys - beforeAll starting, authHeader:', authHeader ? 'SET' : 'NULL');
        if (!authHeader) {
            console.log('02 - API Keys - Creating new auth header');
            const result = await createAndLoginUser(request, 'apikey');
            authHeader = { Authorization: `Bearer ${result.token}` };
            console.log('02 - API Keys - authHeader created');
        } else {
            console.log('02 - API Keys - Using existing auth header');
        }
    });

    test('POST /api-keys - Generates API key', async ({ request }) => {
        console.log('02 - POST /api-keys - authHeader:', authHeader ? 'SET' : 'NULL');
        if (!authHeader) {
            throw new Error('authHeader not initialized');
        }
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
        if (!authHeader) {
            throw new Error('authHeader not initialized');
        }
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
    test.describe.configure({ mode: 'serial' });
    test.beforeAll(async ({ request }) => {
        console.log('03 - Scans - beforeAll starting, authHeader:', authHeader ? 'SET' : 'NULL');
        if (!authHeader) {
            console.log('03 - Scans - Creating new auth header');
            const result = await createAndLoginUser(request, 'scan');
            authHeader = { Authorization: `Bearer ${result.token}` };
            console.log('03 - Scans - authHeader created');
        } else {
            console.log('03 - Scans - Using existing auth header');
        }
    });

    test('POST /scans - Submits a scan', async ({ request }) => {
        if (!authHeader) {
            throw new Error('authHeader not initialized');
        }
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
        if (!authHeader) {
            throw new Error('authHeader not initialized');
        }
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
                password: 'Test123!@#'
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

test.describe('06 - Swagger Documentation', () => {
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
