import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { eventId, userId } = await request.json();

    if (!eventId || !userId) {
      return NextResponse.json({ error: 'Missing eventId or userId' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // We use a Postgres transaction to safely decrement inventory and log the attempt.
    // Aurora DSQL handles distributed concurrency and strict serializability here.
    const result = await sql.begin(async (tx) => {
      // 1. Claim inventory using an atomic UPDATE that checks available_quantity
      const updatedInventory = await tx`
        UPDATE inventory 
        SET available_quantity = available_quantity - 1, last_updated = NOW()
        WHERE event_id = ${eventId} AND available_quantity > 0
        RETURNING available_quantity
      `;

      if (updatedInventory.length === 0) {
        // Sold out or event doesn't exist
        await tx`
          INSERT INTO transactions (event_id, user_id, status)
          VALUES (${eventId}, ${userId}, 'FAILED_SOLD_OUT')
        `;
        return { success: false, reason: 'SOLD_OUT' };
      }

      // 2. Success, log the transaction
      await tx`
        INSERT INTO transactions (event_id, user_id, status)
        VALUES (${eventId}, ${userId}, 'SUCCESS')
      `;
      
      return { success: true, remaining: updatedInventory[0].available_quantity };
    });

    if (!result.success) {
      // 409 Conflict is appropriate for "Sold Out"
      return NextResponse.json({ error: 'Sold Out', remaining: 0 }, { status: 409 });
    }

    return NextResponse.json({ success: true, remaining: result.remaining });

  } catch (error) {
    console.error('Error processing transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
