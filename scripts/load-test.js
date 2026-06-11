// eslint-disable-next-line @typescript-eslint/no-require-imports
const fetch = require('node-fetch'); // We will use native fetch if available (Node 18+) or install node-fetch

async function runLoadTest() {
  const CONCURRENT_REQUESTS = 10000;
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  console.log(`🚀 Starting massive load test: ${CONCURRENT_REQUESTS} parallel requests...`);
  console.log(`Connecting to: ${BASE_URL}`);

  // 1. Fetch the event ID first
  let eventId;
  try {
    const statusRes = await fetch(`${BASE_URL}/api/status`);
    const statusData = await statusRes.json();
    eventId = statusData.events[0].id;
    console.log(`✅ Targeting Event ID: ${eventId}`);
    console.log(`Initial Available Tickets: ${statusData.events[0].available_quantity}`);
  } catch {
    console.error('❌ Failed to fetch event status. Is the server running?');
    process.exit(1);
  }

  // 2. Prepare the request promises
  console.log(`⏳ Firing ${CONCURRENT_REQUESTS} requests at exactly the same time...`);
  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const userId = `bot_${Math.random().toString(36).substring(7)}`;
    
    // We don't await here, we fire them all simultaneously
    const req = fetch(`${BASE_URL}/api/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, userId })
    }).then(async res => {
      if (res.ok) return 'SUCCESS';
      if (res.status === 409) return 'SOLD_OUT';
      return 'ERROR';
    }).catch(() => 'NETWORK_ERROR');

    promises.push(req);
  }

  // 3. Wait for all requests to finish
  const results = await Promise.all(promises);
  const endTime = Date.now();

  // 4. Tally results
  const tally = {
    SUCCESS: 0,
    SOLD_OUT: 0,
    ERROR: 0,
    NETWORK_ERROR: 0
  };

  results.forEach(res => tally[res]++);

  console.log('\n=============================================');
  console.log(`📊 LOAD TEST RESULTS (Completed in ${(endTime - startTime) / 1000}s)`);
  console.log('=============================================');
  console.log(`🎫 Successful Purchases:   ${tally.SUCCESS}`);
  console.log(`🚫 Denied (Sold Out):      ${tally.SOLD_OUT}`);
  console.log(`❌ Server Errors:          ${tally.ERROR}`);
  console.log(`⚠️ Network Errors:         ${tally.NETWORK_ERROR}`);
  console.log('=============================================');
  
  if (tally.SUCCESS > 100) {
    console.log('\n❌ FAILURE: System double-booked tickets!');
  } else if (tally.SUCCESS === 100) {
    console.log('\n✅ PERFECT: Exactly 100 tickets sold. Zero double-bookings. Strict Serializability maintained!');
  } else {
    console.log(`\n⚠️ Note: Only ${tally.SUCCESS} tickets sold. You may need to reset the database and try again.`);
  }
}

runLoadTest();
