-- SQL schema for backend requirements
-- Creates schema and all necessary tables for the application
-- Create schema for better organization
CREATE SCHEMA IF NOT EXISTS nesta;

-- User table with complete structure
CREATE TABLE IF NOT EXISTS nesta.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Store hashed passwords with fixed length
    roles TEXT[] DEFAULT ARRAY['user'],
    role VARCHAR(20) CHECK (role IN ('student', 'parent', 'teacher')),
    age INTEGER CHECK (age >= 3 AND age <= 150),
    date_of_birth DATE,
    parent_email VARCHAR(255),
    country VARCHAR(100),
    city VARCHAR(100),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_known_country VARCHAR(100),
    last_known_city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON nesta.users(email);
CREATE INDEX IF NOT EXISTS idx_users_roles ON nesta.users USING gin(roles);
CREATE INDEX IF NOT EXISTS idx_users_role ON nesta.users(role);
CREATE INDEX IF NOT EXISTS idx_users_country ON nesta.users(country);
CREATE INDEX IF NOT EXISTS idx_users_city ON nesta.users(city);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON nesta.users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON nesta.users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_date_of_birth ON nesta.users(date_of_birth);

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

-- Create projects table if it doesn't exist (with proper schema reference)
CREATE TABLE IF NOT EXISTS nesta.projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id INTEGER NOT NULL,
  blocks JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES nesta.users(id) ON DELETE CASCADE
);

-- Create indexes for projects table
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON nesta.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON nesta.projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON nesta.projects(updated_at);

-- Create update trigger for projects table
CREATE TRIGGER projects_update_timestamp
BEFORE UPDATE ON nesta.projects
FOR EACH ROW
EXECUTE FUNCTION nesta.update_timestamp();

-- Create user_activity table for tracking user activities
CREATE TABLE IF NOT EXISTS nesta.user_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'login', 'project_created', 'project_modified', 'project_deleted'
  country VARCHAR(100),
  city VARCHAR(100),
  metadata JSONB, -- Store additional data like project_id, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES nesta.users(id) ON DELETE CASCADE
);

-- Create indexes for user_activity table
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON nesta.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON nesta.user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON nesta.user_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON nesta.user_activity(user_id, created_at);

-- Note: PostgreSQL doesn't support CHECK constraints that reference other columns at the table level
-- So the constraints for role='student' requiring date_of_birth and parent_email/consent for age<18
-- need to be enforced at the application level

-- Note on Admin Roles:
-- To grant admin access, update the user's roles array to include 'admin':
-- UPDATE nesta.users SET roles = ARRAY['admin'] WHERE email = 'admin@example.com';
-- The backend will automatically convert 'admin' to 'ROLE_ADMIN' in JWT tokens.
-- Users with 'ROLE_ADMIN' in their JWT token can access analytics endpoints.

