/**
 * Database migration runner
 *
 * Manages migration execution, tracking, and rollback.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration interface
interface Migration {
    name: string;
    description: string;
    up: string;
    down: string;
}

// Load all migrations
async function loadMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js'));

    const migrations: Migration[] = [];
    for (const file of files) {
        const migrationModule = await import(`./migrations/${file}`);
        migrations.push({
            name: migrationModule.name || file.replace('.js', ''),
            description: migrationModule.description || '',
            up: migrationModule.up || '',
            down: migrationModule.down || ''
        });
    }
    return migrations;
}

// Migration state tracking
interface MigrationState {
    id: string;
    name: string;
    description: string;
    executed_at: string;
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<MigrationState[]> {
    const pool = getPool();

    // Create migration tracking table if it doesn't exist
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const result = await pool.query(
        'SELECT id, name, description, executed_at FROM schema_migrations ORDER BY executed_at'
    );
    return result.rows;
}

/**
 * Check if a migration has been applied
 */
async function isMigrationApplied(name: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [name]
    );
    return result.rowCount > 0;
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: Migration): Promise<void> {
    const pool = getPool();

    console.log(`Applying migration: ${migration.name}`);

    // Execute the migration
    await pool.query(migration.up);

    // Record the migration
    await pool.query(
        'INSERT INTO schema_migrations (name, description) VALUES ($1, $2)',
        [migration.name, migration.description]
    );

    console.log(`Migration ${migration.name} applied successfully`);
}

/**
 * Rollback a single migration
 */
async function rollbackMigration(migration: Migration): Promise<void> {
    const pool = getPool();

    console.log(`Rolling back migration: ${migration.name}`);

    // Execute the rollback
    await pool.query(migration.down);

    // Remove the migration record
    await pool.query('DELETE FROM schema_migrations WHERE name = $1', [migration.name]);

    console.log(`Migration ${migration.name} rolled back successfully`);
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
    const pool = getPool();

    console.log('Starting database migrations...');

    try {
        // Begin transaction
        await pool.query('BEGIN');

        const migrations = await loadMigrations();
        const applied = await getAppliedMigrations();
        const appliedNames = new Set(applied.map(m => m.name));

        // Find and apply pending migrations
        const pending = migrations.filter(m => !appliedNames.has(m.name));

        if (pending.length === 0) {
            console.log('No pending migrations found.');
            await pool.query('COMMIT');
            return;
        }

        console.log(`Found ${pending.length} pending migrations.`);

        for (const migration of pending) {
            try {
                await applyMigration(migration);
            } catch (error) {
                console.error(`Failed to apply migration ${migration.name}:`, error);
                await pool.query('ROLLBACK');
                throw error;
            }
        }

        await pool.query('COMMIT');
        console.log('All migrations applied successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

/**
 * Rollback the last migration
 */
export async function rollbackLastMigration(): Promise<void> {
    const pool = getPool();

    console.log('Rolling back last migration...');

    try {
        await pool.query('BEGIN');

        const applied = await getAppliedMigrations();

        if (applied.length === 0) {
            console.log('No migrations to rollback.');
            await pool.query('COMMIT');
            return;
        }

        const lastMigration = applied[applied.length - 1];
        const migrations = await loadMigrations();
        const migration = migrations.find(m => m.name === lastMigration.name);

        if (!migration) {
            throw new Error(`Migration ${lastMigration.name} not found in migrations directory`);
        }

        await rollbackMigration(migration);
        await pool.query('COMMIT');
        console.log('Last migration rolled back successfully!');

    } catch (error) {
        console.error('Rollback failed:', error);
        await pool.query('ROLLBACK');
        throw error;
    }
}

/**
 * Reset database to initial state
 */
export async function resetDatabase(): Promise<void> {
    const pool = getPool();

    console.log('Resetting database...');

    try {
        await pool.query('BEGIN');

        // Get all applied migrations in reverse order
        const applied = await getAppliedMigrations();
        const migrations = await loadMigrations();

        // Rollback in reverse order
        for (const migration of [...applied].reverse()) {
            const migrationDef = migrations.find(m => m.name === migration.name);
            if (migrationDef) {
                await rollbackMigration(migrationDef);
            }
        }

        // Drop schema_migrations table
        await pool.query('DROP TABLE IF EXISTS schema_migrations');

        await pool.query('COMMIT');
        console.log('Database reset successfully!');

    } catch (error) {
        console.error('Reset failed:', error);
        await pool.query('ROLLBACK');
        throw error;
    }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<{
    applied: number;
    pending: number;
    appliedMigrations: MigrationState[];
    pendingMigrations: Migration[];
}> {
    const migrations = await loadMigrations();
    const applied = await getAppliedMigrations();
    const appliedNames = new Set(applied.map(m => m.name));

    const pending = migrations.filter(m => !appliedNames.has(m.name));

    return {
        applied: applied.length,
        pending: pending.length,
        appliedMigrations: applied,
        pendingMigrations: pending
    };
}

export default {
    runMigrations,
    rollbackLastMigration,
    resetDatabase,
    getMigrationStatus,
    applyMigration,
    rollbackMigration
};
