import postgres from 'postgres';

// Ensure the connection string is provided
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // We log a warning instead of throwing so the build doesn't crash if the env var is missing during Vercel build
  console.warn('⚠️ DATABASE_URL environment variable is not set. Database operations will fail.');
}

// Initialize the postgres client. 
// We use a singleton pattern to avoid too many connections in serverless environments.
const globalForPostgres = global as unknown as { sql: postgres.Sql | undefined };

export const sql =
  globalForPostgres.sql ??
  postgres(connectionString || '', {
    // Basic options. DSQL supports the standard Postgres protocol.
    max: 10, // max connections
    idle_timeout: 20, // idle connection timeout
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForPostgres.sql = sql;
