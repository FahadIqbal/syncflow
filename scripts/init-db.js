/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const sql = postgres(connectionString);

async function initDb() {
  console.log('⏳ Initializing database schema...');

  try {
    // Drop existing tables for a clean slate (useful for hackathons)
    await sql`DROP TABLE IF EXISTS transactions`;
    await sql`DROP TABLE IF EXISTS inventory`;
    await sql`DROP TABLE IF EXISTS events`;

    console.log('✅ Dropped old tables (if any).');

    // 1. Create the events table
    await sql`
      CREATE TABLE events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        drop_time TIMESTAMP WITH TIME ZONE NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('✅ Created events table.');

    // 2. Create the inventory table
    await sql`
      CREATE TABLE inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES events(id) ON DELETE CASCADE,
        total_quantity INT NOT NULL,
        available_quantity INT NOT NULL CHECK (available_quantity >= 0),
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    // Create an index for faster lookups
    await sql`CREATE INDEX idx_inventory_event_id ON inventory(event_id);`;
    console.log('✅ Created inventory table.');

    // 3. Create the transactions table (logs every purchase)
    await sql`
      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES events(id),
        user_id VARCHAR(255) NOT NULL, -- in a real app, references a users table
        status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED_SOLD_OUT'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('✅ Created transactions table.');

    // --- Seed Data ---
    console.log('⏳ Seeding initial data...');
    const result = await sql`
      INSERT INTO events (name, description, drop_time, price)
      VALUES (
        'The Matrix Resurrections Premiere VIP Tickets',
        'Exclusive VIP access to the world premiere.',
        NOW() + INTERVAL '1 hour',
        199.99
      )
      RETURNING id;
    `;
    
    const eventId = result[0].id;

    // Seed 100 tickets available
    await sql`
      INSERT INTO inventory (event_id, total_quantity, available_quantity)
      VALUES (${eventId}, 100, 100);
    `;
    console.log('✅ Seeded 100 tickets for the VIP Drop.');

    console.log('🎉 Database initialization complete!');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
  } finally {
    await sql.end();
  }
}

initDb();
