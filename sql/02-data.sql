-- Use proper schema name and pre-hashed passwords (bcrypt hashes)
-- These are example hashes of 'password123' - DO NOT USE IN PRODUCTION
INSERT INTO nesta.users (name, email, password, roles)
VALUES 
  ('Shudhanshu', 'shudhanshujaiswal5@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', ARRAY['admin']),
  ('Amit', 'amitkumar34@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', ARRAY['moderator']),
  ('User', 'user@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', ARRAY['user']);

-- Note: In production, each user should have a unique, randomly generated password hash
-- NEVER commit real user data or passwords to version control!