# Backend Requirements Documentation

This document outlines all backend changes needed to support the frontend features.

## Table of Contents
1. [Authentication & Registration Updates](#1-authentication--registration-updates)
2. [Analytics Dashboard API Endpoints](#2-analytics-dashboard-api-endpoints)
3. [Database Schema Changes](#3-database-schema-changes)

---

## 1. Authentication & Registration Updates

### 1.1 User Registration Endpoint

**Endpoint:** `POST /api/auth/signup`

**Request Body:**
```json
{
  "username": "string (required, min 3, max 20)",
  "email": "string (required, valid email)",
  "password": "string (required, min 6, max 40)",
  "role": "student | parent | teacher (required)",
  "age": "number (optional, only for students, 3-150)",
  "dateOfBirth": "string (optional, ISO date format, only for students)",
  "parentEmail": "string (optional, valid email, required if student < 18)",
  "parentConsent": "boolean (optional, required if student < 18)",
  "country": "string (optional, from geolocation)",
  "city": "string (optional, from geolocation)"
}
```

**Response:**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "roles": ["ROLE_USER", "ROLE_ADMIN", ...],
  "role": "student | parent | teacher",
  "age": "number (if student)",
  "dateOfBirth": "string (if student)",
  "parentEmail": "string (if student < 18)",
  "parentConsent": "boolean (if student < 18)",
  "country": "string",
  "city": "string",
  "createdAt": "ISO timestamp"
}
```

**Validation Rules:**
- If `role` is "student":
  - `dateOfBirth` is required
  - Calculate age from `dateOfBirth` and validate: 3 ≤ age ≤ 150
  - If age < 18:
    - `parentEmail` is required
    - `parentConsent` must be `true`
- `country` and `city` are optional (can be null)
- Store location data for analytics

---

### 1.2 User Login Endpoint

**Endpoint:** `POST /api/auth/signin`

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)",
  "country": "string (optional, from geolocation)",
  "city": "string (optional, from geolocation)"
}
```

**Response:**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "roles": ["ROLE_USER", "ROLE_ADMIN", ...],
  "role": "student | parent | teacher",
  "country": "string",
  "city": "string"
}
```

**Notes:**
- `country` and `city` are optional (can be null)
- Update user's last known location on login (for analytics)
- Store login timestamp for active user tracking

---

## 2. Analytics Dashboard API Endpoints

All analytics endpoints require `ROLE_ADMIN` authentication.

### 2.1 Get All Users

**Endpoint:** `GET /api/analytics/users`

**Response:**
```json
[
  {
    "id": "string",
    "username": "string",
    "email": "string",
    "role": "student | parent | teacher",
    "age": "number (if student)",
    "dateOfBirth": "string (if student)",
    "parentEmail": "string (if student < 18)",
    "country": "string | null",
    "city": "string | null",
    "createdAt": "ISO timestamp",
    "lastLoginAt": "ISO timestamp | null"
  },
  ...
]
```

---

### 2.2 Get User Statistics

**Endpoint:** `GET /api/analytics/users/stats`

**Response:**
```json
{
  "totalUsers": "number",
  "students": "number",
  "parents": "number",
  "teachers": "number",
  "activeUsers": "number (users active in last 30 days)",
  "newUsersToday": "number",
  "newUsersThisWeek": "number",
  "newUsersThisMonth": "number"
}
```

---

### 2.3 Get All Projects

**Endpoint:** `GET /api/analytics/projects`

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string | null",
    "owner": {
      "id": "string",
      "username": "string"
    },
    "blocks": "array (block data)",
    "created": "ISO timestamp",
    "lastModified": "ISO timestamp"
  },
  ...
]
```

---

### 2.4 Get Project Statistics

**Endpoint:** `GET /api/analytics/projects/stats`

**Response:**
```json
{
  "totalProjects": "number",
  "projectsThisWeek": "number",
  "projectsThisMonth": "number",
  "averageProjectsPerUser": "number (decimal)"
}
```

---

### 2.5 Get Location Analytics

**Endpoint:** `GET /api/analytics/location`

**Response:**
```json
[
  {
    "country": "string",
    "city": "string",
    "userCount": "number"
  },
  ...
]
```

**Notes:**
- Group users by country and city
- Count users per location
- Sort by userCount descending
- Exclude null/empty locations

**PostgreSQL Query Example:**
```sql
SELECT 
  country,
  city,
  COUNT(*) as user_count
FROM users
WHERE country IS NOT NULL 
  AND city IS NOT NULL
  AND country != ''
  AND city != ''
GROUP BY country, city
ORDER BY user_count DESC
LIMIT 50; -- Top 50 locations
```

---

### 2.6 Get Registration Trends

**Endpoint:** `GET /api/analytics/registrations/trends?days=30`

**Query Parameters:**
- `days` (optional, default: 30): Number of days to include

**Response:**
```json
[
  {
    "date": "YYYY-MM-DD",
    "count": "number"
  },
  ...
]
```

**Notes:**
- Return daily registration counts
- Include all dates in the range (even if count is 0)
- Sort by date ascending

**PostgreSQL Query Example:**
```sql
-- Generate date series and join with registrations
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE,
    '1 day'::interval
  )::date AS date
)
SELECT 
  ds.date,
  COALESCE(COUNT(u.id), 0) as count
FROM date_series ds
LEFT JOIN users u ON DATE(u.created_at) = ds.date
GROUP BY ds.date
ORDER BY ds.date ASC;
```

---

### 2.7 Get Roles Distribution

**Endpoint:** `GET /api/analytics/users/roles`

**Response:**
```json
[
  {
    "role": "student",
    "count": "number",
    "percentage": "number (0-100)"
  },
  {
    "role": "parent",
    "count": "number",
    "percentage": "number (0-100)"
  },
  {
    "role": "teacher",
    "count": "number",
    "percentage": "number (0-100)"
  }
]
```

**Notes:**
- Calculate percentage: (count / totalUsers) * 100
- Include all three roles even if count is 0

**PostgreSQL Query Example:**
```sql
WITH role_counts AS (
  SELECT 
    role,
    COUNT(*) as count
  FROM users
  WHERE role IS NOT NULL
  GROUP BY role
),
total_users AS (
  SELECT COUNT(*) as total FROM users
)
SELECT 
  COALESCE(rc.role, roles.role) as role,
  COALESCE(rc.count, 0) as count,
  ROUND((COALESCE(rc.count, 0)::numeric / NULLIF(tu.total, 0)) * 100, 2) as percentage
FROM (VALUES ('student'), ('parent'), ('teacher')) AS roles(role)
LEFT JOIN role_counts rc ON roles.role = rc.role
CROSS JOIN total_users tu
ORDER BY rc.count DESC NULLS LAST;
```

---

### 2.8 Get Active Users

**Endpoint:** `GET /api/analytics/users/active?days=30`

**Query Parameters:**
- `days` (optional, default: 30): Number of days to check

**Response:**
```json
{
  "activeUsers": "number (users who logged in within specified days)",
  "totalUsers": "number",
  "activePercentage": "number (0-100)"
}
```

---

### 2.9 Get Dashboard Overview

**Endpoint:** `GET /api/analytics/overview`

**Response:**
```json
{
  "users": {
    "total": "number",
    "active": "number",
    "newToday": "number",
    "newThisWeek": "number",
    "newThisMonth": "number"
  },
  "projects": {
    "total": "number",
    "thisWeek": "number",
    "thisMonth": "number",
    "averagePerUser": "number"
  },
  "roles": [
    {
      "role": "student",
      "count": "number",
      "percentage": "number"
    },
    ...
  ],
  "topLocations": [
    {
      "country": "string",
      "city": "string",
      "userCount": "number"
    },
    ...
  ]
}
```

**Notes:**
- Combined endpoint for faster initial dashboard load
- Returns top 10 locations only

---

## 3. Database Schema Changes

### 3.1 Users Table Updates

**PostgreSQL Syntax:** Add the following columns to your `users` table:

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) CHECK (role IN ('student', 'parent', 'teacher'));
ALTER TABLE users ADD COLUMN age INTEGER CHECK (age >= 3 AND age <= 150);
ALTER TABLE users ADD COLUMN date_of_birth DATE;
ALTER TABLE users ADD COLUMN parent_email VARCHAR(255);
ALTER TABLE users ADD COLUMN parent_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN country VARCHAR(100);
ALTER TABLE users ADD COLUMN city VARCHAR(100);
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN last_known_country VARCHAR(100);
ALTER TABLE users ADD COLUMN last_known_city VARCHAR(100);
```

**Note:** If you need to add multiple columns in one statement (PostgreSQL):
```sql
ALTER TABLE users 
  ADD COLUMN role VARCHAR(20) CHECK (role IN ('student', 'parent', 'teacher')),
  ADD COLUMN age INTEGER CHECK (age >= 3 AND age <= 150),
  ADD COLUMN date_of_birth DATE,
  ADD COLUMN parent_email VARCHAR(255),
  ADD COLUMN parent_consent BOOLEAN DEFAULT FALSE,
  ADD COLUMN country VARCHAR(100),
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN last_login_at TIMESTAMP,
  ADD COLUMN last_known_country VARCHAR(100),
  ADD COLUMN last_known_city VARCHAR(100);
```

**Indexes:**
```sql
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_country ON users(country);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);
```

**Constraints:**
- If `role` = 'student', `date_of_birth` is required
- If `role` = 'student' AND age < 18:
  - `parent_email` is required
  - `parent_consent` must be TRUE
- `country` and `city` can be NULL

---

### 3.2 Projects Table (if not exists)

Ensure your `projects` table has:

```sql
CREATE TABLE projects (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id VARCHAR(255) NOT NULL,
  blocks JSONB,
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_created ON projects(created);
CREATE INDEX idx_projects_last_modified ON projects(last_modified);
```

---

### 3.3 User Activity Tracking (Recommended Implementation)

**Since there's no existing activity tracking system, create a simple database table:**

**PostgreSQL Syntax:**
```sql
CREATE TABLE user_activity (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'login', 'project_created', 'project_modified', 'project_deleted'
  country VARCHAR(100),
  city VARCHAR(100),
  metadata JSONB, -- Store additional data like project_id, etc. (PostgreSQL JSONB type)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_created ON user_activity(created_at);
CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, created_at);
```

**PostgreSQL JSONB Usage Example:**
```sql
-- Insert activity with metadata
INSERT INTO user_activity (user_id, activity_type, country, city, metadata)
VALUES ('user123', 'project_created', 'United States', 'New York', '{"project_id": "proj456", "project_name": "My Project"}'::jsonb);

-- Query activities with metadata
SELECT * FROM user_activity WHERE metadata->>'project_id' = 'proj456';
```

**Implementation Notes:**
- **On Login:** INSERT into `user_activity` with `activity_type = 'login'` and location data
- **On Project Creation:** INSERT with `activity_type = 'project_created'`, store `project_id` in metadata
- **On Project Modification:** INSERT with `activity_type = 'project_modified'`
- **On Project Deletion:** INSERT with `activity_type = 'project_deleted'`
- **For Active Users Analytics:** Query users who have activity within X days using this table
- This provides detailed tracking without requiring external services or infrastructure

**Alternative (Simpler):** If you only need basic activity tracking, you can skip this table and just use the `last_login_at` column in the users table. However, the activity table provides more detailed insights.

---

## 4. Implementation Notes

### 4.1 Age Calculation
- Calculate age from `dateOfBirth` on registration
- Validate age is between 3 and 150 years
- Store calculated age in `age` column for quick queries

### 4.2 Location Data
- Store location on both registration and login
- Update `last_known_country` and `last_known_city` on each login
- Use this for analytics even if user's profile location is null

### 4.3 Active Users
- Consider a user "active" if they logged in within the specified days
- Use `last_login_at` timestamp OR query `user_activity` table for login activities
- If using activity table: `SELECT DISTINCT user_id FROM user_activity WHERE activity_type = 'login' AND created_at >= NOW() - INTERVAL 'X days'`

### 4.4 Data Privacy
- Ensure `parentEmail` is stored securely
- Consider GDPR compliance for location data
- Allow users to update/delete their location data

### 4.5 Performance & Caching

**Since Redis/caching infrastructure is not available, use one of these approaches:**

#### Option 1: In-Memory Caching (Recommended)
Implement simple in-memory caching in your backend application:

**Node.js/Express Example:**
```javascript
// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Usage in analytics endpoint
app.get('/api/analytics/users/stats', async (req, res) => {
  const cached = getCachedData('user_stats');
  if (cached) {
    return res.json(cached);
  }
  
  const stats = await calculateUserStats();
  setCachedData('user_stats', stats);
  res.json(stats);
});

// Clear cache when data changes
app.post('/api/auth/signup', async (req, res) => {
  // ... registration logic ...
  cache.delete('user_stats'); // Invalidate cache
  cache.delete('analytics_overview');
});
```

**Python/Flask Example:**
```python
from functools import lru_cache
from datetime import datetime, timedelta

cache = {}
CACHE_TTL = timedelta(minutes=5)

def get_cached_data(key):
    if key in cache:
        data, timestamp = cache[key]
        if datetime.now() - timestamp < CACHE_TTL:
            return data
        del cache[key]
    return None

def set_cached_data(key, data):
    cache[key] = (data, datetime.now())
```

**Cache Keys to Use:**
- `user_stats` - User statistics
- `project_stats` - Project statistics
- `location_analytics` - Location data
- `roles_distribution` - Role distribution
- `registration_trends_30` - Registration trends
- `analytics_overview` - Dashboard overview

**Cache Invalidation:**
- Clear relevant cache keys when:
  - New user registers
  - New project is created
  - User logs in (for active users count)
  - Project is modified/deleted

**Benefits:**
- No external dependencies
- Fast for small to medium traffic
- Easy to implement
- Works immediately

**Limitations:**
- Lost on server restart (acceptable for analytics)
- Not shared across multiple servers (if you scale, consider Redis later)
- Memory usage grows over time (implement cache size limits if needed)

#### Option 2: Database Query Optimization
If you prefer not to use caching:

1. **Optimize SQL Queries:**
   - Use proper indexes (already specified in schema)
   - Aggregate data in database, not in application
   - Use efficient SQL with COUNT, GROUP BY, etc.

2. **Example Optimized Query (PostgreSQL):**
```sql
-- Instead of fetching all users and counting in app
-- Single query to get all user statistics
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
  COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
  COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
  COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN 1 END) as active_users,
  COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_today,
  COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as new_this_week,
  COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
FROM users;
```

**PostgreSQL Date Functions Used:**
- `NOW()` - Current timestamp
- `CURRENT_DATE` - Current date (midnight)
- `DATE_TRUNC('week', date)` - Start of week
- `DATE_TRUNC('month', date)` - Start of month
- `INTERVAL '30 days'` - 30-day interval

3. **Create Database Views (PostgreSQL):**
```sql
CREATE OR REPLACE VIEW user_stats_view AS
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
  COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
  COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
  COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN 1 END) as active_users,
  COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_today,
  COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as new_this_week,
  COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
FROM users;

-- Then query: SELECT * FROM user_stats_view;
-- Note: Views are recalculated on each query, so they're always up-to-date
```

#### Option 3: HTTP Cache Headers
Set cache headers on responses:

```javascript
// Set cache headers
res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
res.json(analyticsData);
```

**Recommendation:** Start with **Option 1 (In-Memory Caching)** for best performance with minimal complexity. You can always add Redis later if you scale to multiple servers.

### 4.6 Pagination
- Use pagination for large user/project lists if needed
- Suggested: 50-100 items per page
- Add `page` and `limit` query parameters to list endpoints

---

## 5. Testing Checklist

- [ ] Registration with all role types works
- [ ] Student registration validates age requirements
- [ ] Under-18 students require parent email and consent
- [ ] Location data is stored on registration/login
- [ ] All analytics endpoints return correct data
- [ ] Analytics endpoints require admin authentication
- [ ] Role distribution percentages are accurate
- [ ] Registration trends include all dates in range
- [ ] Active users calculation is correct
- [ ] Location analytics groups correctly

---

## 6. Example API Calls

### Registration Example
```bash
POST /api/auth/signup
Content-Type: application/json

{
  "username": "john_student",
  "email": "john@example.com",
  "password": "password123",
  "role": "student",
  "dateOfBirth": "2010-05-15",
  "parentEmail": "parent@example.com",
  "parentConsent": true,
  "country": "United States",
  "city": "New York"
}
```

### Login Example
```bash
POST /api/auth/signin
Content-Type: application/json

{
  "username": "john_student",
  "password": "password123",
  "country": "United States",
  "city": "New York"
}
```

### Analytics Example
```bash
GET /api/analytics/users/stats
Authorization: Bearer <admin_jwt_token>
```

**JWT Token Structure Expected:**
```json
{
  "id": "user_id",
  "username": "admin_user",
  "email": "admin@example.com",
  "roles": ["ROLE_USER", "ROLE_ADMIN"]
}
```

**Authorization Check:**
- Verify JWT token is valid and not expired
- Check if `roles` array includes `"ROLE_ADMIN"`
- Return `403 Forbidden` if user is not admin

---

## 7. Error Handling

All endpoints should return appropriate HTTP status codes:
- `200 OK` - Success
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized (not admin for analytics)
- `500 Internal Server Error` - Server errors

Error response format:
```json
{
  "message": "Error description",
  "errors": {
    "field": ["Error message"]
  }
}
```

---

## Questions for Backend Team - Answers

1. **What database system are you using?** 
   - **Answer:** PostgreSQL
   - **Note:** All SQL examples in this document are PostgreSQL-compatible. Adjust syntax if needed for your specific version.

2. **Do you have an existing user activity tracking system?**
   - **Answer:** No
   - **Solution:** Use the `user_activity` table approach (Section 3.3)

3. **What authentication method are you using?**
   - **Answer:** JWT (JSON Web Tokens)
   - **Note:** Ensure JWT tokens include user roles for admin endpoint authorization checks.

4. **Do you need rate limiting on analytics endpoints?**
   - **Answer:** No
   - **Note:** Consider adding rate limiting in the future if traffic increases significantly.

5. **Should analytics data be cached? If so, for how long?**
   - **Answer:** No Redis/caching infrastructure available
   - **Solution:** Use in-memory caching (Section 4.5, Option 1) with 5-minute TTL

6. **Do you want real-time updates or is periodic refresh acceptable?**
   - **Answer:** Periodic refresh (on page refresh)
   - **Note:** Frontend will fetch fresh data when user navigates to analytics page or refreshes. No WebSocket/SSE needed.

---

## Implementation Summary Based on Answers

### Database: PostgreSQL
- All SQL examples use PostgreSQL syntax
- Use `SERIAL` for auto-incrementing IDs
- Use `JSONB` for metadata fields
- Use `TIMESTAMP` for date/time fields
- Use `INTERVAL` for date calculations (e.g., `NOW() - INTERVAL '30 days'`)

### Authentication: JWT
- Include user roles in JWT payload: `{ id, username, email, roles: ["ROLE_USER", "ROLE_ADMIN"] }`
- Verify JWT token on all analytics endpoints
- Check for `ROLE_ADMIN` in roles array for authorization
- Return `403 Forbidden` if user doesn't have admin role

### Caching: In-Memory
- Implement simple Map/Object-based cache
- 5-minute TTL for all analytics endpoints
- Clear cache on data mutations (user registration, project creation, etc.)

### Updates: Periodic Refresh
- No need for WebSocket or Server-Sent Events
- Frontend fetches data on component mount
- Cache on backend reduces database load

---

**Last Updated:** [Current Date]
**Version:** 1.0

