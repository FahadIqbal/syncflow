import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    await sql.begin(async (tx) => {
      // 1. Reset inventory back to max
      await tx`
        UPDATE inventory 
        SET available_quantity = total_quantity, last_updated = NOW()
        WHERE event_id = ${eventId}
      `;
      
      // 2. Clear transaction logs for this event to keep the demo clean
      await tx`
        DELETE FROM transactions
        WHERE event_id = ${eventId}
      `;
    });

    return NextResponse.json({ success: true, message: 'Inventory reset successfully.' });

  } catch (error) {
    console.error('Error resetting inventory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
