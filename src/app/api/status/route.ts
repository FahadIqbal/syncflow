import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Opt out of caching so we always get the latest live inventory count
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ 
        error: 'Database not configured', 
        events: [] 
      }, { status: 503 });
    }

    // Fetch all events with their current inventory
    const events = await sql`
      SELECT 
        e.id, 
        e.name, 
        e.description, 
        e.price,
        i.total_quantity, 
        i.available_quantity
      FROM events e
      JOIN inventory i ON e.id = i.event_id
      ORDER BY e.created_at DESC
    `;

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
