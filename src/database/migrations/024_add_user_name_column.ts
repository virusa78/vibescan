/**
 * Migration 024: Add name column to users table
 *
 * Aligns user profile settings read/write paths with schema.
 */
export const up = `
ALTER TABLE users
ADD COLUMN IF NOT EXISTS name VARCHAR(100);
`;

export const down = `
ALTER TABLE users
DROP COLUMN IF EXISTS name;
`;

export default {
  up,
  down,
  name: '024_add_user_name_column',
  description: 'Add name column to users table',
};
