// Setup environment variables for tests
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.server');
dotenv.config({ path: envPath });

function buildDatabaseUrl(): string {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'vibescan_wasp';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || buildDatabaseUrl();
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
}
