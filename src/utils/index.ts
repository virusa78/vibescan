/**
 * Utility functions
 *
 * Shared utility functions for the application.
 */

import crypto from 'crypto';

// Severity type
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

// Severity helpers
export function getSeverityOrder(severity: Severity): number {
    const order: Record<Severity, number> = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
        INFO: 4
    };
    return order[severity] ?? 5;
}

export function getSeverityColor(severity: Severity): string {
    const colors: Record<Severity, string> = {
        CRITICAL: '#d32f2f',
        HIGH: '#f57c00',
        MEDIUM: '#fbc02d',
        LOW: '#7cb342',
        INFO: '#1976d2'
    };
    return colors[severity] ?? '#9e9e9e';
}

export function severityGte(severity1: Severity, severity2: Severity): boolean {
    return getSeverityOrder(severity1) <= getSeverityOrder(severity2);
}

// Re-export types for convenience
export type { Severity };

// UUID generation
export function generateUUID(): string {
    return crypto.randomUUID();
}

// Secure random string generation
export function generateSecureString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

// Hash generation
export function generateHash(data: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
}

// HMAC generation
export function generateHMAC(data: string, key: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
}

// Date formatting
export function formatDate(date: Date | string, format: 'iso' | 'utc' | 'local' = 'iso'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    switch (format) {
        case 'iso':
            return d.toISOString();
        case 'utc':
            return d.toUTCString();
        case 'local':
            return d.toLocaleString();
    }
}

// Month formatting
export function formatMonth(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Reset date calculation
export function getResetDate(month: string): Date {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(year, m, 1);
    date.setMonth(date.getMonth() + 1);
    return date;
}

// Validation helpers
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export function isHttpsUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// Array helpers
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export function deduplicateBy<T>(array: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    return array.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Object helpers
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}

// Error helpers
export function createError(code: string, message: string, details?: Record<string, any>): Error & { code: string; details?: any } {
    const error = new Error(message) as any;
    error.code = code;
    if (details) {
        error.details = details;
    }
    return error;
}

// Rate limit helpers
export function calculateRateLimitReset(windowMs: number, now: number = Date.now()): number {
    return Math.ceil((now % windowMs) / 1000);
}

// Pagination helpers
export function getPaginationParams(cursor?: string, limit: number = 20): { offset: number; limit: number } {
    if (!cursor) {
        return { offset: 0, limit };
    }

    try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        const { offset = 0, limit: cursorLimit = limit } = JSON.parse(decoded);
        return { offset, limit: cursorLimit };
    } catch {
        return { offset: 0, limit };
    }
}

export function createCursor(offset: number, limit: number): string {
    return Buffer.from(JSON.stringify({ offset, limit })).toString('base64');
}

// File size helpers
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function parseBytes(size: string): number {
    const match = size.match(/^(\d+)([KMGT]B?)?$/i);
    if (!match) return 0;

    const num = parseInt(match[1], 10);
    const unit = (match[2] || 'B').toUpperCase();

    const units: Record<string, number> = {
        B: 1,
        KB: 1024,
        MB: 1024 * 1024,
        GB: 1024 * 1024 * 1024,
        TB: 1024 * 1024 * 1024 * 1024
    };

    return num * (units[unit] || 1);
}

// JSON helpers
export function safeJsonParse(str: string, defaultValue: any = null): any {
    try {
        return JSON.parse(str);
    } catch {
        return defaultValue;
    }
}

export function safeJsonStringify(obj: any, space?: number): string {
    try {
        return JSON.stringify(obj, null, space);
    } catch {
        return 'null';
    }
}

