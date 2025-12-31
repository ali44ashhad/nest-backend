-- Create schema for better organization
CREATE SCHEMA IF NOT EXISTS nesta;

-- User table with improved structure
CREATE TABLE IF NOT EXISTS nesta.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Store hashed passwords with fixed length
    roles TEXT[] DEFAULT ARRAY['user'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_users_email ON nesta.users(email);
CREATE INDEX IF NOT EXISTS idx_users_roles ON nesta.users USING gin(roles);

-- Create update trigger to maintain updated_at timestamp
CREATE OR REPLACE FUNCTION nesta.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_timestamp
BEFORE UPDATE ON nesta.users
FOR EACH ROW
EXECUTE FUNCTION nesta.update_timestamp();
