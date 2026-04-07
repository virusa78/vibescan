/**
 * Application configuration
 *
 * Centralized configuration management with validation.
 */

import 'dotenv/config';

// Environment validation
interface EnvConfig {
    // Database
    DB_HOST: string;
    DB_PORT: number;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_POOL_SIZE: number;

    // Redis
    REDIS_URL: string;

    // S3/AWS
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    S3_BUCKET_SOURCES: string;
    S3_BUCKET_SBOMS: string;
    S3_BUCKET_PDFS: string;

    // Application
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: number;
    ENCRYPTION_KEY: string;

    // JWT
    JWT_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;

    // Scanning
    GRYPE_IMAGE: string;
    MAX_SOURCE_SIZE_MB: number;
    CVE_UPDATE_INTERVAL_HOURS: number;

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
}

// Configuration validation
function validateEnv(): void {
    const required = [
        'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
        'REDIS_URL',
        'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
        'ENCRYPTION_KEY', 'JWT_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.warn('Missing environment variables:', missing);
        console.warn('Using default values - this may not work in production!');
    }
}

// Configuration object
const config: EnvConfig = {
    // Database
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    DB_NAME: process.env.DB_NAME || 'vibescan',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
    DB_POOL_SIZE: parseInt(process.env.DB_POOL_SIZE || '20'),

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    // S3/AWS
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    S3_BUCKET_SOURCES: process.env.S3_BUCKET_SOURCES || 'vibescan-sources',
    S3_BUCKET_SBOMS: process.env.S3_BUCKET_SBOMS || 'vibescan-sboms',
    S3_BUCKET_PDFS: process.env.S3_BUCKET_PDFS || 'vibescan-pdfs',

    // Application
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    PORT: parseInt(process.env.PORT || '3000'),
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-only-key-change-in-production',

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-in-production',
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '30d',

    // Scanning
    GRYPE_IMAGE: process.env.GRYPE_IMAGE || 'anchore/grype:latest',
    MAX_SOURCE_SIZE_MB: parseInt(process.env.MAX_SOURCE_SIZE_MB || '50'),
    CVE_UPDATE_INTERVAL_HOURS: parseInt(process.env.CVE_UPDATE_INTERVAL_HOURS || '6'),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
};

// Validate environment
validateEnv();

export default config;
