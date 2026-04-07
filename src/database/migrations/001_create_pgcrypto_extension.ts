/**
 * Migration 001: Create pgcrypto extension
 *
 * Enables cryptographic functions for PostgreSQL including:
 * - gen_random_uuid() for UUID generation
 * - pgp_sym_encrypt/pgp_sym_decrypt for symmetric encryption
 * - crypt/hash for password hashing
 * - digest for hash functions
 */

export const up = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create UUID-OSSP extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
`;

export const down = `
DROP EXTENSION IF EXISTS pgcrypto;
DROP EXTENSION IF EXISTS "uuid-ossp";
`;

export default {
  up,
  down,
  name: '001_create_pgcrypto_extension',
  description: 'Create pgcrypto and uuid-ossp extensions'
};
