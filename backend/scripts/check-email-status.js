#!/usr/bin/env node
/**
 * Check email delivery status by Message ID
 * Usage: node scripts/check-email-status.js <messageId>
 */

require('dotenv').config();
const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3';

async function checkStatus() {
  const messageId = process.argv[2];

  if (!messageId) {
    console.log('Usage: node scripts/check-email-status.js <messageId>');
    console.log('\nExample: node scripts/check-email-status.js "202604121600.46502122847@smtp-relay.mailin.fr"');
    console.log('\n📧 Latest Message ID from test-email: 202604121600.46502122847@smtp-relay.mailin.fr');
    process.exit(0);
  }

  if (!BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY not set');
    process.exit(1);
  }

  try {
    console.log(`\n📊 Checking email delivery status...\n`);
    console.log(`Message ID: ${messageId}`);

    const response = await axios.get(`${BREVO_API_URL}/smtp/log`, {
      headers: {
        'api-key': BREVO_API_KEY,
      },
      params: {
        messageId: messageId,
      },
      timeout: 10000,
    });

    const events = response.data || [];

    if (events.length === 0) {
      console.log('⚠ No delivery events found for this message ID.');
      console.log('\n💡 Possible reasons:');
      console.log('   1. Message ID may be incorrect');
      console.log('   2. Email may still be in queue (check after a few seconds)');
      console.log('   3. Recipient email may not have received it yet');
    } else {
      console.log(`\n📧 Found ${events.length} event(s):\n`);
      events.forEach((event, idx) => {
        console.log(`Event ${idx + 1}:`);
        console.log(`  Status: ${event.event || 'unknown'}`);
        console.log(`  Email: ${event.email}`);
        console.log(`  Timestamp: ${event.date}`);
        if (event.reason) console.log(`  Reason: ${event.reason}`);
        console.log();
      });
    }
  } catch (err) {
    console.error('❌ Error checking status:');
    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

checkStatus();
