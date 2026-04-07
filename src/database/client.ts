/**
 * Database client configuration
 *
 * Provides singleton PostgreSQL connection with connection pooling
 * and automatic encryption/decryption utilities.
 */

import { Pool, PoolConfig, QueryResult } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'vibescan',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: parseInt(process.env.DB_POOL_SIZE || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT || '5000'),
};

// Create connection pool
export const pool = new Pool(dbConfig);

// Encryption key (should be stored in AWS KMS or similar in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    console.warn('ENCRYPTION_KEY not set - sensitive data will not be encrypted');
}

/**
 * Encrypt data using PostgreSQL pgp_sym_encrypt
 */
export async function encryptData(data: string): Promise<string | null> {
    if (!ENCRYPTION_KEY) return null;

    const encrypted = await pool.query(
        "SELECT pgp_sym_encrypt($1, $2)",
        [data, ENCRYPTION_KEY]
    );
    return encrypted.rows[0].pgp_sym_encrypt;
}

/**
 * Decrypt data using PostgreSQL pgp_sym_decrypt
 */
export async function decryptData(encryptedData: Buffer | null): Promise<string | null> {
    if (!encryptedData || !ENCRYPTION_KEY) return null;

    try {
        const decrypted = await pool.query(
            "SELECT pgp_sym_decrypt($1::bytea, $2)",
            [encryptedData, ENCRYPTION_KEY]
        );
        return decrypted.rows[0].pgp_sym_decrypt;
    } catch (error) {
        console.error('Failed to decrypt data:', error);
        return null;
    }
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
    return crypto.randomUUID();
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        console.error('Database connection test failed:', error);
        return false;
    }
}

/**
 * Close all connections in the pool
 */
export async function closeConnection(): Promise<void> {
    await pool.end();
}

/**
 * Get the pool instance (for direct queries if needed)
 */
export function getPool(): Pool {
    return pool;
}

export default {
    pool,
    encryptData,
    decryptData,
    generateSecureString,
    generateUUID,
    testConnection,
    closeConnection,
    getPool
};
