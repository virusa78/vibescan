# Database initialization script
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a test user for development
INSERT INTO users (id, email, password_hash, plan, region)
VALUES (
    gen_random_uuid(),
    'dev@example.com',
    '$2a$10$dummyhashfordevonly', -- Replace with actual bcrypt hash
    'free_trial',
    'OTHER'
) ON CONFLICT (email) DO NOTHING;
