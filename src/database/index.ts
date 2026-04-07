/**
 * Database module exports
 *
 * Provides unified access to database functionality.
 */

export { pool, encryptData, decryptData, generateSecureString, generateUUID, testConnection, closeConnection, getPool } from './client.js';
export { runMigrations, rollbackLastMigration, resetDatabase, getMigrationStatus } from './migrate.js';

// Re-export migration files for easy reference
export * as migrations from './migrations/index.js';
