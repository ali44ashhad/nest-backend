// import { Pool } from "pg";

// const pool = new Pool({
//   user: "postgres",
//   host: "nestatoys.cbua6wyael21.ap-south-1.rds.amazonaws.com",
//   database: "postgres",
//   password: "wsaioAEXCzqJFFOdyeXT",
//   port: 5432,
//    ssl: { rejectUnauthorized: false },
// });


// export default pool;


import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const FALLBACK_DB_SCHEMA = "nesta"; //localdb for testing, production db is "nesta"
export const DB_SCHEMA = process.env.DB_SCHEMA?.trim() || FALLBACK_DB_SCHEMA;

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "nestatoys.cbua6wyael21.ap-south-1.rds.amazonaws.com",
  database: process.env.DB_DATABASE || "postgres",
  password: process.env.DB_PASSWORD || "wsaioAEXCzqJFFOdyeXT",
  port: Number(process.env.DB_PORT) || 5432,
  ssl: process.env.SSL === "true" ? { rejectUnauthorized: false } : false,
  // Connection pool configuration for better performance
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Test the database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;
