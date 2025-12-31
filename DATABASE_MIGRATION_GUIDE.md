# Database Migration Guide for DBeaver

This guide explains how to run the database migration script (`sql/03-migration-backend-requirements.sql`) using DBeaver.

## 📋 Prerequisites

- DBeaver installed and configured
- Database connection established to your PostgreSQL database
- Connection credentials (from your `.env` file or database configuration)
- Database schema `nesta` exists (or will be created automatically if `01-schema.sql` was run)

## 🔍 Step-by-Step Instructions

### Step 1: Connect to Your Database in DBeaver

1. **Open DBeaver** and ensure you're connected to your PostgreSQL database
2. **Verify the connection** by e xpanding the database tree in the Database Navigator panel (left side)
3. **Locate your database** (should be `postgres` based on your config)
4. **Check if the `nesta` schema exists:**
   - Expand: `Databases` → `postgres` → `Schemas` → `nesta`
   - If `nesta` schema doesn't exist, run `sql/01-schema.sql` first

### Step 2: Open the Migration Script

**Option A: Open from DBeaver File Menu**
1. Click **File** → **Open SQL Script ** (or press `Ctrl+O` / `Cmd+O`)
2. Navigate to: `sql/03-migration-backend-requirements.sql`
3. Click **Open**

**Option B: Open from File System**
1. Navigate to the file in your file explorer:
   ```
   /Users/amitkumar/Desktop/Amit&Co./Nesta Toys/Main Code/Nesta-toys-Backend/sql/03-migration-backend-requirements.sql
   ```
2. Right-click the file → **Open With** → **DBeaver**
   - Or simply drag and drop the file into DBeaver

### Step 3: Verify Database Connection in SQL Editor

1. **Check the connection indicator** at the bottom-right of the SQL Editor
2. **Ensure the correct database is selected:**
   - Look at the connection dropdown in the toolbar (should show your database name)
   - If wrong connection is selected, click the dropdown and choose the correct one

### Step 4: Review the Script (Recommended)

Before executing, review the script to understand what it will do:

- ✅ Adds new columns to `nesta.users` table
- ✅ Creates indexes for better performance
- ✅ Creates/updates `nesta.projects` table
- ✅ Creates `nesta.user_activity` table
- ✅ Updates existing projects table structure if needed

### Step 5: Execute the Migration Script

**Important:** This script uses PostgreSQL-specific features (DO blocks, conditional statements). DBeaver handles these well.

**Method 1: Execute Entire Script (Recommended)**

1. **Click the "Execute SQL Script" button** in the toolbar (looks like a play button with lines, or press `Alt+X`)
   - Or right-click in the SQL Editor → **Execute** → **Execute SQL Script**
   - Or press `Ctrl+Alt+X` (Windows/Linux) or `Cmd+Alt+X` (Mac)

2. **DBeaver will execute the entire script** in a transaction

3. **Wait for execution to complete** - you'll see progress in the "Scripts" tab at the bottom

**Method 2: Execute Statement-by-Statement**

If you prefer to run it step by step:

1. **Place cursor** at the beginning of a statement
2. Press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac) to execute that statement
3. **Repeat** for each statement

⚠️ **Note:** Method 1 is recommended because some statements depend on previous ones (especially the DO block at the end).

### Step 6: Check for Errors

After execution:

1. **Check the "Scripts" or "Log" tab** at the bottom of DBeaver
2. **Look for:**
   - ✅ **Success messages** (usually green or no errors)
   - ❌ **Error messages** (usually red)

**Common Issues:**

- **"schema nesta does not exist"**
  - **Solution:** Run `sql/01-schema.sql` first to create the schema
  
- **"column already exists"**
  - **Solution:** This is fine! The script uses `IF NOT EXISTS`, so it should skip existing columns
  
- **"permission denied"**
  - **Solution:** Check that your database user has ALTER TABLE and CREATE TABLE permissions

### Step 7: Verify the Migration

After successful execution, verify the changes:

#### 7.1 Verify New Columns in Users Table

Run this query in a new SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'nesta' 
  AND table_name = 'users'
ORDER BY ordinal_position;
```

**Expected new columns:**
- `role` (character varying)
- `age` (integer)
- `date_of_birth` (date)
- `parent_email` (character varying)
- `parent_consent` (boolean)
- `country` (character varying)
- `city` (character varying)
- `last_login_at` (timestamp with time zone)
- `last_known_country` (character varying)
- `last_known_city` (character varying)

#### 7.2 Verify Projects Table

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'nesta' 
  AND table_name = 'projects'
ORDER BY ordinal_position;
```

#### 7.3 Verify User Activity Table

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'nesta' 
  AND table_name = 'user_activity'
ORDER BY ordinal_position;
```

#### 7.4 Verify Indexes

```sql
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'nesta'
  AND tablename IN ('users', 'projects', 'user_activity')
ORDER BY tablename, indexname;
```

**Expected indexes for users table:**
- `idx_users_role`
- `idx_users_country`
- `idx_users_city`
- `idx_users_created_at`
- `idx_users_last_login`
- `idx_users_date_of_birth`

## 🎯 Alternative: Running from Command Line

If you prefer using command line (psql):

```bash
# Set your database credentials
export PGHOST=nestatoys.cbua6wyael21.ap-south-1.rds.amazonaws.com
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD=your_password_here

# Run the migration
psql -f sql/03-migration-backend-requirements.sql

# Or with explicit connection string
psql "host=nestatoys.cbua6wyael21.ap-south-1.rds.amazonaws.com port=5432 dbname=postgres user=postgres password=your_password sslmode=require" -f sql/03-migration-backend-requirements.sql
```

## 🔧 Troubleshooting

### Issue: "Could not find or load main class"

**Solution:** This is a Java error. Update DBeaver or check Java installation.

### Issue: Script Execution Hangs

**Solution:**
1. Check database connection status
2. Look for locks on tables (other processes might be using them)
3. Cancel execution and try again

### Issue: Transaction Rolled Back

**Solution:**
- Check the error message in the Log tab
- Fix the specific error and re-run the script
- The script is designed to be idempotent (safe to run multiple times)

### Issue: Foreign Key Constraint Errors

**Solution:**
- Ensure `nesta.users` table exists first
- Run `sql/01-schema.sql` if you haven't already

### Issue: SSL Connection Required

If you're connecting to AWS RDS and get SSL errors:

1. **In DBeaver connection settings:**
   - Right-click your connection → **Edit Connection**
   - Go to **SSL** tab
   - Check **"Use SSL"**
   - Set **SSL Mode:** `require` or `verify-full`
   - Click **Test Connection** → **OK**

## ✅ Post-Migration Checklist

After successful migration:

- [ ] All new columns added to `nesta.users` table
- [ ] Indexes created successfully
- [ ] `nesta.projects` table exists with all columns
- [ ] `nesta.user_activity` table created
- [ ] No errors in DBeaver log

## 🔐 Grant Admin Access (Optional but Recommended)

After migration, grant admin access to your user account:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE nesta.users 
SET roles = ARRAY['admin'] 
WHERE email = 'your-email@example.com';
```

**Verify admin role:**
```sql
SELECT id, name, email, roles 
FROM nesta.users 
WHERE email = 'your-email@example.com';
```

## 📝 Notes

1. **Safe to Run Multiple Times:** The script uses `IF NOT EXISTS` clauses, so it's safe to run multiple times without causing errors.

2. **Transaction Safety:** DBeaver typically runs scripts in a transaction. If any part fails, the entire script can be rolled back (depending on your DBeaver settings).

3. **DO Block:** The script contains a PostgreSQL DO block (lines 78-121) that handles conditional table updates. DBeaver executes this correctly.

4. **Schema Name:** All tables are in the `nesta` schema. Make sure you're connected to the correct database.

## 🆘 Need Help?

If you encounter issues:

1. **Check DBeaver Log:**
   - Window → Show View → Log
   - Look for detailed error messages

2. **Verify Connection:**
   - Right-click connection → **Edit Connection** → **Test Connection**

3. **Check Database Permissions:**
   - Ensure your user has CREATE, ALTER, and INDEX permissions

4. **Review Error Messages:**
   - Copy the exact error message from the Log tab
   - Search for solutions specific to that error

## 🎉 Success Indicators

You'll know the migration succeeded when:

- ✅ Script execution completes without errors
- ✅ You see "Script execution finished" in the Scripts tab
- ✅ Verification queries show all new columns and tables
- ✅ No error messages in the Log tab

---

**Migration Script Location:** `sql/03-migration-backend-requirements.sql`

**Created:** Backend Requirements Implementation
**Last Updated:** [Current Date]

